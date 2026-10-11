import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { realtimeHub } from '../services/realtime.js';
import { NotificationItem } from '../../../shared/types.js';

const router = Router();

// GET /api/notifications
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string, 10) || 30;
    const result = await pool.query(
      `SELECT id, workspace_id, title, message, type, is_read, target_type, target_id, created_at
       FROM notifications
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    const unreadCountRes = await pool.query(
      `SELECT COUNT(*)::int as unread_count FROM notifications WHERE is_read = FALSE`
    );

    const notifications: NotificationItem[] = result.rows.map((row: any) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      title: row.title,
      message: row.message,
      type: row.type,
      isRead: row.is_read,
      targetType: row.target_type,
      targetId: row.target_id,
      createdAt: row.created_at,
    }));

    res.json({
      notifications,
      unreadCount: unreadCountRes.rows[0]?.unread_count || 0,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/:id/read
router.post('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await pool.query(`UPDATE notifications SET is_read = TRUE WHERE id = $1`, [id]);
    res.json({ success: true, id });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications/read-all
router.post('/read-all', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await pool.query(`UPDATE notifications SET is_read = TRUE WHERE is_read = FALSE`);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/notifications (create notification)
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, message, type = 'INFO', targetType, targetId } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: { message: 'Title dan message wajib diisi.' } });
    }

    const id = `notif-${uuidv4().slice(0, 8)}`;
    const workspaceId = 'ws-default-command-center';

    const insertRes = await pool.query(
      `INSERT INTO notifications (id, workspace_id, title, message, type, is_read, target_type, target_id)
       VALUES ($1, $2, $3, $4, $5, FALSE, $6, $7)
       RETURNING *`,
      [id, workspaceId, title, message, type, targetType || null, targetId || null]
    );

    const row = insertRes.rows[0];
    const newNotif: NotificationItem = {
      id: row.id,
      workspaceId: row.workspace_id,
      title: row.title,
      message: row.message,
      type: row.type,
      isRead: row.is_read,
      targetType: row.target_type,
      targetId: row.target_id,
      createdAt: row.created_at,
    };

    // Broadcast in real-time to active UI clients
    realtimeHub.broadcast('notification', newNotif);

    res.status(201).json(newNotif);
  } catch (err) {
    next(err);
  }
});

export default router;
