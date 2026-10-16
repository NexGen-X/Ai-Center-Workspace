/**
 * Authentication API Routes — AI Agent Command Center
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';
import { verifyPassword, hashPassword, generateSessionToken } from '../utils/auth.js';

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
    res.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        role: user.role,
        mustChangePassword: Boolean(user.must_change_password),
        lastLoginAt: user.last_login_at
      }
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
