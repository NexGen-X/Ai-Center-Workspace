/**
 * Multi-Tenant Workspace & Organization Management API Routes
 * AI Agent Command Center
 */

import { Router, Response } from 'express';
import { pool } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { AuthenticatedRequest, requireRole } from '../middleware/auth.js';
import { systemLogger } from '../services/logger.js';
import { Workspace, WorkspaceMember } from '../../../shared/types.js';

const router = Router();

// GET /api/workspaces — List accessible workspaces for the current authenticated user
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: { message: 'Autentikasi diperlukan.' } });
    }

    let query: string;
    let params: any[] = [];

    if (user.role === 'ADMIN') {
      // System admin sees all workspaces with aggregate telemetry
      query = `
        SELECT 
          w.id, w.name, w.created_at, w.updated_at,
          COALESCE(wm.role, 'OWNER') as user_role,
          COUNT(DISTINCT m.user_id)::int as member_count,
          COUNT(DISTINCT a.id)::int as agent_count,
          COUNT(DISTINCT t.id)::int as task_count
        FROM workspaces w
        LEFT JOIN workspace_members wm ON w.id = wm.workspace_id AND wm.user_id = $1
        LEFT JOIN workspace_members m ON w.id = m.workspace_id
        LEFT JOIN ai_agents a ON w.id = a.workspace_id
        LEFT JOIN tasks t ON w.id = t.workspace_id
        GROUP BY w.id, w.name, w.created_at, w.updated_at, wm.role
        ORDER BY w.created_at ASC;
      `;
      params = [user.id];
    } else {
      // Standard users only see workspaces where they are members
      query = `
        SELECT 
          w.id, w.name, w.created_at, w.updated_at,
          wm.role as user_role,
          COUNT(DISTINCT m.user_id)::int as member_count,
          COUNT(DISTINCT a.id)::int as agent_count,
          COUNT(DISTINCT t.id)::int as task_count
        FROM workspaces w
        JOIN workspace_members wm ON w.id = wm.workspace_id AND wm.user_id = $1
        LEFT JOIN workspace_members m ON w.id = m.workspace_id
        LEFT JOIN ai_agents a ON w.id = a.workspace_id
        LEFT JOIN tasks t ON w.id = t.workspace_id
        GROUP BY w.id, w.name, w.created_at, w.updated_at, wm.role
        ORDER BY w.created_at ASC;
      `;
      params = [user.id];
    }

    const result = await pool.query(query, params);
    const workspaces: Workspace[] = result.rows.map(r => ({
      id: r.id,
      name: r.name,
      role: r.user_role || 'MEMBER',
      memberCount: r.member_count || 1,
      agentCount: r.agent_count || 0,
      taskCount: r.task_count || 0,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    res.json(workspaces);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/workspaces — Create a new tenant workspace
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: { message: 'Autentikasi diperlukan.' } });
    }

    const name = (req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ error: { message: 'Nama workspace wajib diisi.' } });
    }

    const workspaceId = `ws-${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();

    // 1. Create workspace
    await pool.query(
      `INSERT INTO workspaces (id, name, created_at, updated_at) VALUES ($1, $2, $3, $3)`,
      [workspaceId, name, now]
    );

    // 2. Add creator as OWNER
    const memberId = `wm-${uuidv4().slice(0, 8)}`;
    await pool.query(
      `INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at) VALUES ($1, $2, $3, 'OWNER', $4)`,
      [memberId, workspaceId, user.id, now]
    );

    systemLogger.info('SECURITY', `Pengguna [${user.email}] membuat tenant workspace baru: "${name}" (${workspaceId})`);

    res.status(201).json({
      success: true,
      workspace: {
        id: workspaceId,
        name,
        role: 'OWNER',
        memberCount: 1,
        agentCount: 0,
        taskCount: 0,
        createdAt: now,
        updatedAt: now
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// GET /api/workspaces/:id — Get single workspace details & member list
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const wsRes = await pool.query(`SELECT * FROM workspaces WHERE id = $1`, [id]);
    if (wsRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Workspace tidak ditemukan.' } });
    }

    const membersRes = await pool.query(`
      SELECT 
        wm.id, wm.workspace_id, wm.user_id, wm.role, wm.created_at,
        u.display_name, u.email
      FROM workspace_members wm
      JOIN human_users u ON wm.user_id = u.id
      WHERE wm.workspace_id = $1
      ORDER BY wm.created_at ASC;
    `, [id]);

    const members: WorkspaceMember[] = membersRes.rows.map(r => ({
      id: r.id,
      workspaceId: r.workspace_id,
      userId: r.user_id,
      displayName: r.display_name,
      email: r.email,
      role: r.role,
      createdAt: r.created_at
    }));

    res.json({
      workspace: wsRes.rows[0],
      members
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/workspaces/:id/members — Invite / add a member to the workspace
router.post('/:id/members', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user;
    const { id: workspaceId } = req.params;
    const { email, role = 'OPERATOR' } = req.body;

    if (!email) {
      return res.status(400).json({ error: { message: 'Email pengguna wajib diisi.' } });
    }

    // Check authorization: must be ADMIN or OWNER of this workspace
    if (user?.role !== 'ADMIN') {
      const authCheck = await pool.query(
        `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
        [workspaceId, user?.id]
      );
      if (authCheck.rows.length === 0 || !['OWNER', 'ADMIN'].includes(authCheck.rows[0].role)) {
        return res.status(403).json({ error: { message: 'Hanya OWNER atau ADMIN workspace yang dapat menambah anggota.' } });
      }
    }

    // Find target user
    const targetUser = await pool.query(`SELECT id, email, display_name FROM human_users WHERE email = $1`, [email.trim().toLowerCase()]);
    if (targetUser.rows.length === 0) {
      return res.status(404).json({ error: { message: `Pengguna dengan email "${email}" tidak terdaftar di sistem.` } });
    }

    const memberUserId = targetUser.rows[0].id;
    const memberId = `wm-${uuidv4().slice(0, 8)}`;

    await pool.query(
      `INSERT INTO workspace_members (id, workspace_id, user_id, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
      [memberId, workspaceId, memberUserId, role]
    );

    res.json({
      success: true,
      message: `Pengguna ${targetUser.rows[0].display_name} (${email}) berhasil ditambahkan sebagai ${role} di workspace.`
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// DELETE /api/workspaces/:id/members/:userId — Remove a member from the workspace
router.delete('/:id/members/:userId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id: workspaceId, userId } = req.params;
    const user = req.user;

    // Check authorization: must be ADMIN or OWNER of this workspace
    if (user?.role !== 'ADMIN') {
      const authCheck = await pool.query(
        `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
        [workspaceId, user?.id]
      );
      if (authCheck.rows.length === 0 || !['OWNER', 'ADMIN'].includes(authCheck.rows[0].role)) {
        return res.status(403).json({ error: { message: 'Hanya OWNER atau ADMIN workspace yang dapat menghapus anggota.' } });
      }
    }

    await pool.query(
      `DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, userId]
    );

    res.json({ success: true, message: 'Anggota berhasil dihapus dari workspace.' });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// PATCH /api/workspaces/:id — Rename workspace
router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: { message: 'Nama workspace baru wajib diisi.' } });
    }

    await pool.query(`UPDATE workspaces SET name = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [name.trim(), id]);
    res.json({ success: true, message: `Nama workspace berhasil diperbarui menjadi "${name.trim()}".` });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

export default router;
