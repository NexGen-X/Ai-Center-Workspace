/**
 * Authentication API Routes — AI Agent Command Center
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';
import { verifyPassword, hashPassword, generateSessionToken } from '../utils/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// POST /api/auth/login — Authenticate operator
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: { message: 'Email dan password wajib diisi.' } });
    }

    const result = await pool.query(`
      SELECT id, email, display_name, role, password_hash, must_change_password
      FROM human_users
      WHERE email = $1;
    `, [email.toLowerCase().trim()]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: { message: 'Email atau password salah.' } });
    }

    const user = result.rows[0];
    const isValid = user.password_hash && verifyPassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: { message: 'Email atau password salah.' } });
    }

    // Generate session token
    const token = generateSessionToken();
    await pool.query(`
      UPDATE human_users
      SET session_token = $1, last_login_at = CURRENT_TIMESTAMP
      WHERE id = $2;
    `, [token, user.id]);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role,
        mustChangePassword: Boolean(user.must_change_password)
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/auth/register — Self-service customer registration & workspace provisioning
router.post('/register', async (req: Request, res: Response) => {
  try {
    const displayName = req.body.displayName || req.body.name;
    const email = req.body.email;
    const password = req.body.password;
    const companyName = req.body.companyName || req.body.workspaceName;

    if (!displayName || !email || !password) {
      return res.status(400).json({ error: { message: 'Nama lengkap, email, dan kata sandi wajib diisi.' } });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: { message: 'Kata sandi minimal harus 6 karakter.' } });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await pool.query('SELECT id FROM human_users WHERE email = $1', [cleanEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: { message: 'Email sudah terdaftar. Silakan masuk menggunakan akun Anda.' } });
    }

    const userId = `usr-${uuidv4().slice(0, 8)}`;
    const workspaceId = `ws-${uuidv4().slice(0, 8)}`;
    const orgName = (companyName || `${displayName.trim()}'s Team`).trim();
    const token = generateSessionToken();
    const pwdHash = hashPassword(password);

    // 1. Create Human User
    await pool.query(`
      INSERT INTO human_users (id, email, display_name, password_hash, role, session_token, must_change_password)
      VALUES ($1, $2, $3, $4, 'OPERATOR', $5, FALSE);
    `, [userId, cleanEmail, displayName.trim(), pwdHash, token]);

    // 2. Create Tenant Workspace with Free Trial
    await pool.query(`
      INSERT INTO workspaces (
        id, name, plan, plan_status, task_quota_limit, tasks_used_this_month, billing_cycle_end, billing_email
      ) VALUES ($1, $2, 'FREE', 'TRIALING', 50, 0, CURRENT_TIMESTAMP + INTERVAL '14 days', $3);
    `, [workspaceId, orgName, cleanEmail]);

    // 3. Assign as OWNER of the workspace
    await pool.query(`
      INSERT INTO workspace_members (id, workspace_id, user_id, role)
      VALUES ($1, $2, $3, 'OWNER');
    `, [`mem-${uuidv4().slice(0, 8)}`, workspaceId, userId]);

    // 4. Record Activity
    await pool.query(`
      INSERT INTO activities (id, workspace_id, actor_type, actor_id, actor_name, event_type, summary, target_type, target_id)
      VALUES ($1, $2, 'USER', $3, $4, 'workspace.created', $5, 'WORKSPACE', $6);
    `, [
      `act-${uuidv4().slice(0, 8)}`,
      workspaceId,
      userId,
      displayName.trim(),
      `Akun baru terdaftar & Workspace "${orgName}" aktif dengan Free Trial 14 hari (50 tugas).`,
      workspaceId
    ]);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: userId,
        email: cleanEmail,
        displayName: displayName.trim(),
        role: 'OPERATOR',
        mustChangePassword: false
      },
      workspace: {
        id: workspaceId,
        name: orgName,
        plan: 'FREE',
        planStatus: 'TRIALING',
        taskQuotaLimit: 50
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// GET /api/auth/me — Validate session token
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ authenticated: false, message: 'Tidak ada token otentikasi.' });
    }

    const token = authHeader.split(' ')[1];
    const result = await pool.query(`
      SELECT id, email, display_name, role, must_change_password, last_login_at
      FROM human_users
      WHERE session_token = $1;
    `, [token]);

    if (result.rows.length === 0) {
      return res.status(401).json({ authenticated: false, message: 'Sesi kedaluwarsa atau tidak valid.' });
    }

    const user = result.rows[0];

    // Fetch primary workspace for tenant auto-selection
    const wsRes = await pool.query(`
      SELECT w.id, w.name, w.plan, w.plan_status, wm.role
      FROM workspace_members wm
      JOIN workspaces w ON wm.workspace_id = w.id
      WHERE wm.user_id = $1
      ORDER BY wm.created_at ASC
      LIMIT 1;
    `, [user.id]);

    res.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role,
        mustChangePassword: Boolean(user.must_change_password),
        lastLoginAt: user.last_login_at
      },
      primaryWorkspace: wsRes.rows[0] || null
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      await pool.query('UPDATE human_users SET session_token = NULL WHERE session_token = $1;', [token]);
    }
    res.json({ success: true, message: 'Berhasil keluar.' });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/auth/change-password
router.post('/change-password', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: { message: 'Tidak terotentikasi.' } });
    }

    const token = authHeader.split(' ')[1];
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: { message: 'Password baru minimal 8 karakter.' } });
    }

    const result = await pool.query(`
      SELECT id, password_hash FROM human_users WHERE session_token = $1;
    `, [token]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: { message: 'Sesi tidak valid.' } });
    }

    const user = result.rows[0];
    if (!verifyPassword(currentPassword, user.password_hash)) {
      return res.status(400).json({ error: { message: 'Password saat ini salah.' } });
    }

    const newHash = hashPassword(newPassword);
    await pool.query('UPDATE human_users SET password_hash = $1 WHERE id = $2;', [newHash, user.id]);

    res.json({ success: true, message: 'Password berhasil diubah.' });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// GET /api/auth/setup-hint — Ephemeral initial onboarding hint (Disabled once changed)
router.get('/setup-hint', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT email, must_change_password FROM human_users LIMIT 1;');
    if (result.rows.length === 0 || !result.rows[0].must_change_password) {
      return res.json({
        available: false,
        message: 'Kredensial sistem telah diamankan. Auto-fill dinonaktifkan.'
      });
    }

    res.json({
      available: true,
      defaultEmail: result.rows[0]?.email || 'operator@ai-center.local',
      hint: 'Default password awal: Admin#AiCenter2026!'
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/auth/update-credentials — Mandatory onboarding credential update
router.post('/update-credentials', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: { message: 'Tidak terotentikasi.' } });
    }

    const token = authHeader.split(' ')[1];
    const { newEmail, newDisplayName, newPassword } = req.body;

    if (!newEmail || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: { message: 'Email dan password baru (minimal 8 karakter) wajib diisi.' } });
    }

    const userRes = await pool.query(`
      SELECT id FROM human_users WHERE session_token = $1;
    `, [token]);

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: { message: 'Sesi tidak valid.' } });
    }

    const user = userRes.rows[0];
    const newHash = hashPassword(newPassword);

    await pool.query(`
      UPDATE human_users
      SET email = $1, display_name = $2, password_hash = $3, must_change_password = FALSE
      WHERE id = $4;
    `, [newEmail.toLowerCase().trim(), (newDisplayName || 'Command Operator').trim(), newHash, user.id]);

    res.json({
      success: true,
      message: 'Kredensial operator berhasil diperbarui.',
      user: {
        id: user.id,
        email: newEmail.toLowerCase().trim(),
        displayName: (newDisplayName || 'Command Operator').trim(),
        mustChangePassword: false
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

export default router;
