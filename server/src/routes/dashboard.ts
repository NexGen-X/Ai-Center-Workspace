/**
 * Dashboard Summary API Route — AI Agent Command Center
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';
import { collectServerMetrics } from '../services/monitoring.js';
import { DashboardSummary } from '../../../shared/types.js';

const router = Router();

router.get('/summary', async (req: Request, res: Response) => {
  try {
    const wsId = (req.headers['x-workspace-id'] || req.query.workspaceId || '').toString().trim();
    const tasksRes = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') as running_tasks,
        COUNT(*) FILTER (WHERE status = 'DONE') as completed_tasks
      FROM tasks
      WHERE ($1 = '' OR workspace_id = $1);
    `, [wsId]);

    const agentsRes = await pool.query(`
      SELECT 
        COUNT(*) as total_agents,
        COUNT(*) FILTER (WHERE enabled = TRUE AND status != 'UNAVAILABLE') as online_agents
      FROM ai_agents;
    `);

    const projectsRes = await pool.query(`
      SELECT COUNT(*) as active_projects 
      FROM projects 
      WHERE status = 'ACTIVE' AND ($1 = '' OR workspace_id = $1);
    `, [wsId]);

    const metrics = collectServerMetrics();

    const summary: DashboardSummary = {
      runningTasksCount: parseInt(tasksRes.rows[0].running_tasks || '0', 10),
      completedTasksCount: parseInt(tasksRes.rows[0].completed_tasks || '0', 10),
      totalAgentsCount: parseInt(agentsRes.rows[0].total_agents || '0', 10),
      onlineAgentsCount: parseInt(agentsRes.rows[0].online_agents || '0', 10),
      activeProjectsCount: parseInt(projectsRes.rows[0].active_projects || '0', 10),
      systemStatus: metrics.status === 'CRITICAL' ? 'DEGRADED' : 'OPERATIONAL',
      serverMetrics: metrics
    };

    res.json(summary);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

export default router;
