/**
 * Platform Owner / Super Admin API Routes — AI Agent Command Center
 * Provides full user analytics, subscription management, and user controls for startup founders.
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';
import { hashPassword } from '../utils/auth.js';
import { systemLogger } from '../services/logger.js';
import { v4 as uuidv4 } from 'uuid';

export const adminRouter = Router();

// GET /api/admin/metrics — Overall Platform Founder Metrics & KPIs
adminRouter.get('/metrics', async (_req: Request, res: Response) => {
  try {
    // 1. Total Registered Users
    const usersCountRes = await pool.query('SELECT COUNT(*) as total FROM human_users;');
    const totalUsers = parseInt(usersCountRes.rows[0]?.total || '0', 10);

    // 2. Total Workspaces / Organizations
    const wsCountRes = await pool.query('SELECT COUNT(*) as total FROM workspaces;');
    const totalWorkspaces = parseInt(wsCountRes.rows[0]?.total || '0', 10);

    // 3. Active Users in last 24h & last 7 days
    const active24hRes = await pool.query(
      "SELECT COUNT(*) as total FROM human_users WHERE last_login_at >= NOW() - INTERVAL '24 hours';"
    );
    const activeUsers24h = parseInt(active24hRes.rows[0]?.total || '0', 10);

    // 4. Plan Distribution
    const planRes = await pool.query(`
      SELECT plan, COUNT(*) as count 
      FROM workspaces 
      GROUP BY plan;
    `);

    const planCounts: Record<string, number> = {
      FREE: 0,
      STARTER: 0,
      BUSINESS: 0,
      ENTERPRISE: 0
    };

    planRes.rows.forEach((r) => {
      const p = (r.plan || 'FREE').toUpperCase();
      planCounts[p] = parseInt(r.count || '0', 10);
    });

    // 5. Total Paid Revenue (Midtrans Invoices)
    const revRes = await pool.query(
      "SELECT COALESCE(SUM(amount_idr), 0) as total FROM workspace_invoices WHERE status = 'PAID';"
    );
    const totalRevenueIdr = parseInt(revRes.rows[0]?.total || '0', 10);

    // 6. Total Tasks Executed Platform-wide
    const tasksRes = await pool.query('SELECT COUNT(*) as total FROM tasks WHERE status = \'DONE\';');
    const totalTasksDone = parseInt(tasksRes.rows[0]?.total || '0', 10);

    res.json({
      success: true,
      metrics: {
        totalUsers,
        totalWorkspaces,
        activeUsers24h,
        planCounts,
        totalRevenueIdr,
        totalTasksDone,
        paidSubscribers: (planCounts.STARTER || 0) + (planCounts.BUSINESS || 0) + (planCounts.ENTERPRISE || 0),
        freeTrialUsers: planCounts.FREE || 0
      }
    });
  } catch (err: any) {
    systemLogger.error('API', `GET /api/admin/metrics error: ${err.message}`);
    res.status(500).json({ error: { message: err.message } });
  }
});

// GET /api/admin/users — Detailed list of all registered users across workspaces
adminRouter.get('/users', async (req: Request, res: Response) => {
  try {
    const search = (req.query.search as string || '').trim().toLowerCase();
    const filterPlan = (req.query.plan as string || '').trim().toUpperCase();

    let query = `
      SELECT 
        u.id,
        u.email,
        u.display_name as "displayName",
        u.role,
        u.created_at as "createdAt",
        u.last_login_at as "lastLoginAt",
        u.must_change_password as "mustChangePassword",
        w.id as "workspaceId",
        w.name as "workspaceName",
        w.plan,
        w.plan_status as "planStatus",
        w.task_quota_limit as "taskQuotaLimit",
        w.tasks_used_this_month as "tasksUsedThisMonth",
        wm.role as "workspaceRole"
      FROM human_users u
      LEFT JOIN workspace_members wm ON u.id = wm.user_id
      LEFT JOIN workspaces w ON wm.workspace_id = w.id
    `;

    const whereClauses: string[] = [];
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      whereClauses.push(`(LOWER(u.email) LIKE $${params.length} OR LOWER(u.display_name) LIKE $${params.length} OR LOWER(w.name) LIKE $${params.length})`);
    }

    if (filterPlan && filterPlan !== 'ALL') {
      params.push(filterPlan);
      whereClauses.push(`UPPER(w.plan) = $${params.length}`);
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    query += ` ORDER BY u.created_at DESC LIMIT 100;`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      users: result.rows
    });
  } catch (err: any) {
    systemLogger.error('API', `GET /api/admin/users error: ${err.message}`);
    res.status(500).json({ error: { message: err.message } });
  }
});

// PATCH /api/admin/users/:userId/plan — Founder grant plan or quota upgrade
adminRouter.patch('/users/:userId/plan', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { plan, taskQuotaLimit } = req.body;

    if (!plan) {
      return res.status(400).json({ error: { message: 'Nama paket (plan) wajib disertakan.' } });
    }

    // Determine default quota based on plan
    let quota = taskQuotaLimit;
    if (!quota) {
      if (plan === 'STARTER') quota = 500;
      else if (plan === 'BUSINESS') quota = 2500;
      else if (plan === 'ENTERPRISE') quota = 999999;
      else quota = 50; // Free
    }

    // Find user's workspace
    const memberRes = await pool.query(
      'SELECT workspace_id FROM workspace_members WHERE user_id = $1 LIMIT 1;',
      [userId]
    );

    if (memberRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Workspace pengguna tidak ditemukan.' } });
    }

    const wsId = memberRes.rows[0].workspace_id;

    await pool.query(`
      UPDATE workspaces
      SET plan = $1, plan_status = 'ACTIVE', task_quota_limit = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3;
    `, [plan.toUpperCase(), quota, wsId]);

    // Record Activity
    await pool.query(`
      INSERT INTO activities (id, workspace_id, actor_type, actor_name, event_type, summary, target_type, target_id)
      VALUES ($1, $2, 'SYSTEM', 'Founder SuperAdmin', 'admin.plan_granted', $3, 'WORKSPACE', $4);
    `, [
      `act-${uuidv4().slice(0, 8)}`,
      wsId,
      `Founder secara manual menetapkan paket ke "${plan.toUpperCase()}" (Kuota: ${quota} tugas).`,
      wsId
    ]);

    systemLogger.info('SYSTEM', `Founder updated user ${userId} workspace ${wsId} plan to ${plan}`);

    res.json({
      success: true,
      message: `Paket pengguna berhasil diubah ke ${plan.toUpperCase()} dengan kuota ${quota} tugas.`,
      plan: plan.toUpperCase(),
      taskQuotaLimit: quota
    });
  } catch (err: any) {
    systemLogger.error('API', `PATCH /api/admin/users/plan error: ${err.message}`);
    res.status(500).json({ error: { message: err.message } });
  }
});

// PATCH /api/admin/users/:userId/role — Founder update user role
adminRouter.patch('/users/:userId/role', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({ error: { message: 'Role wajib diisi.' } });
    }

    await pool.query('UPDATE human_users SET role = $1 WHERE id = $2;', [role.toUpperCase(), userId]);

    res.json({
      success: true,
      message: `Role pengguna berhasil diubah ke ${role.toUpperCase()}.`
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/admin/users/:userId/reset-password — Founder reset user password
adminRouter.post('/users/:userId/reset-password', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    const pwd = newPassword && newPassword.trim().length >= 6 ? newPassword.trim() : 'IdTech2026!';
    const pwdHash = hashPassword(pwd);

    await pool.query(
      'UPDATE human_users SET password_hash = $1, must_change_password = TRUE WHERE id = $2;',
      [pwdHash, userId]
    );

    res.json({
      success: true,
      message: `Password pengguna berhasil direset ke password sementara. Pengguna akan diminta mengganti password saat login berikutnya.`,
      tempPassword: pwd
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

export default adminRouter;
