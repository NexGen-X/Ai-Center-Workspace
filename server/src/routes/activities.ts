/**
 * Activities API Routes — AI Agent Command Center
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';
import { Activity } from '../../../shared/types.js';

const router = Router();

// GET /api/activities
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = parseInt((req.query.limit as string) || '30', 10);
    const result = await pool.query(`
      SELECT id, workspace_id, actor_type, actor_id, actor_name, event_type, summary, target_type, target_id, created_at
      FROM activities
      ORDER BY created_at DESC
      LIMIT $1;
    `, [limit]);

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
