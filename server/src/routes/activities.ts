/**
 * Activities API Routes — AI Agent Command Center
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';
import { Activity } from '../../../shared/types.js';

const router = Router();

// GET /api/activities/export — Export compliance audit trail
router.get('/export', async (req: Request, res: Response) => {
  try {
    const wsId = (req.headers['x-workspace-id'] || req.query.workspaceId || '').toString().trim();
    const format = (req.query.format as string || 'csv').toLowerCase();

    const result = await pool.query(`
      SELECT id, workspace_id, actor_type, actor_id, actor_name, event_type, summary, target_type, target_id, created_at
      FROM activities
      WHERE ($1 = '' OR workspace_id = $1)
      ORDER BY created_at DESC
      LIMIT 1000;
    `, [wsId]);

    if (format === 'json') {
      res.setHeader('Content-Disposition', `attachment; filename="audit-trail-${Date.now()}.json"`);
      res.setHeader('Content-Type', 'application/json');
      return res.json(result.rows);
    }

    const header = ['Timestamp', 'Event ID', 'Workspace', 'Actor Type', 'Actor ID', 'Actor Name', 'Event Type', 'Summary', 'Target Type', 'Target ID'];
    const rows = result.rows.map(r => [
      `"${new Date(r.created_at).toISOString()}"`,
      `"${r.id}"`,
      `"${r.workspace_id}"`,
      `"${r.actor_type}"`,
      `"${r.actor_id || ''}"`,
      `"${(r.actor_name || '').replace(/"/g, '""')}"`,
      `"${r.event_type}"`,
      `"${(r.summary || '').replace(/"/g, '""')}"`,
      `"${r.target_type || ''}"`,
      `"${r.target_id || ''}"`
    ].join(','));

    const csvContent = [header.join(','), ...rows].join('\n');

    res.setHeader('Content-Disposition', `attachment; filename="audit-trail-${Date.now()}.csv"`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// GET /api/activities
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = parseInt((req.query.limit as string) || '30', 10);
    const wsId = (req.headers['x-workspace-id'] || req.query.workspaceId || '').toString().trim();
    const result = await pool.query(`
      SELECT id, workspace_id, actor_type, actor_id, actor_name, event_type, summary, target_type, target_id, created_at
      FROM activities
      WHERE ($2 = '' OR workspace_id = $2)
      ORDER BY created_at DESC
      LIMIT $1;
    `, [limit, wsId]);

    const activities: Activity[] = result.rows.map(row => ({
      id: row.id,
      workspaceId: row.workspace_id,
      actorType: row.actor_type,
      actorId: row.actor_id,
      actorName: row.actor_name,
      eventType: row.event_type,
      summary: row.summary,
      targetType: row.target_type,
      targetId: row.target_id,
      createdAt: row.created_at
    }));

    res.json(activities);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

export default router;
