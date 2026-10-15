/**
 * Outbound Alerting & Webhooks Route Handler
 * AI Agent Command Center
 */

import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/index.js';
import { AlertingService } from '../services/alertingService.js';
import {
  AlertWebhookItem,
  CreateAlertWebhookRequest,
  UpdateAlertWebhookRequest,
  AlertPayload
} from '../../../shared/types.js';

export const alertsRouter = Router();

// GET /api/alerts/webhooks — List configured webhooks
alertsRouter.get('/webhooks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = (req.query.workspaceId as string) || 'ws-default-command-center';
    const result = await pool.query(
      `SELECT id, workspace_id, name, platform, webhook_url, secret_token, events, is_active, created_at, updated_at
       FROM alert_webhooks
       WHERE workspace_id = $1
       ORDER BY created_at DESC`,
      [workspaceId]
    );

    const items: AlertWebhookItem[] = result.rows.map((r) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      name: r.name,
      platform: r.platform,
      webhookUrl: r.webhook_url,
      secretToken: r.secret_token || undefined,
      events: Array.isArray(r.events) ? r.events : JSON.parse(r.events || '[]'),
      isActive: r.is_active,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    res.json(items);
  } catch (err) {
    next(err);
  }
});

// POST /api/alerts/webhooks — Register a new alert webhook
alertsRouter.post('/webhooks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body: CreateAlertWebhookRequest = req.body;
    if (!body.name || !body.webhookUrl || !body.platform) {
      return res.status(400).json({ error: { message: 'name, platform, and webhookUrl are required.' } });
    }

    const id = `wh-${uuidv4().slice(0, 8)}`;
    const workspaceId = 'ws-default-command-center';
    const defaultEvents = ['SECURITY_ALERT', 'SWARM_COMPLETED', 'ACTION_PENDING', 'SCHEDULE_FAILED'];
    const events = body.events && body.events.length > 0 ? body.events : defaultEvents;
    const isActive = body.isActive !== undefined ? body.isActive : true;

    const result = await pool.query(
      `INSERT INTO alert_webhooks (id, workspace_id, name, platform, webhook_url, secret_token, events, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        workspaceId,
        body.name.trim(),
        body.platform,
        body.webhookUrl.trim(),
        body.secretToken ? body.secretToken.trim() : null,
        JSON.stringify(events),
        isActive
      ]
    );

    const r = result.rows[0];
    const item: AlertWebhookItem = {
      id: r.id,
      workspaceId: r.workspace_id,
      name: r.name,
      platform: r.platform,
      webhookUrl: r.webhook_url,
      secretToken: r.secret_token || undefined,
      events: Array.isArray(r.events) ? r.events : JSON.parse(r.events || '[]'),
      isActive: r.is_active,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };

    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

// PUT /api/alerts/webhooks/:id — Update existing webhook
alertsRouter.put('/webhooks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const body: UpdateAlertWebhookRequest = req.body;

    const check = await pool.query(`SELECT * FROM alert_webhooks WHERE id = $1`, [id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: { message: `Webhook "${id}" tidak ditemukan.` } });
    }

    const current = check.rows[0];
    const name = body.name !== undefined ? body.name.trim() : current.name;
    const platform = body.platform !== undefined ? body.platform : current.platform;
    const webhookUrl = body.webhookUrl !== undefined ? body.webhookUrl.trim() : current.webhook_url;
    const secretToken = body.secretToken !== undefined ? body.secretToken.trim() : current.secret_token;
    const events = body.events !== undefined ? JSON.stringify(body.events) : current.events;
    const isActive = body.isActive !== undefined ? body.isActive : current.is_active;

    const result = await pool.query(
      `UPDATE alert_webhooks
       SET name = $1, platform = $2, webhook_url = $3, secret_token = $4, events = $5, is_active = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [name, platform, webhookUrl, secretToken, events, isActive, id]
    );

    const r = result.rows[0];
    const item: AlertWebhookItem = {
      id: r.id,
      workspaceId: r.workspace_id,
      name: r.name,
      platform: r.platform,
      webhookUrl: r.webhook_url,
      secretToken: r.secret_token || undefined,
      events: Array.isArray(r.events) ? r.events : JSON.parse(r.events || '[]'),
      isActive: r.is_active,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };

    res.json(item);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/alerts/webhooks/:id — Delete webhook
alertsRouter.delete('/webhooks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`DELETE FROM alert_webhooks WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: `Webhook "${id}" tidak ditemukan.` } });
    }

    res.json({ success: true, message: `Webhook "${id}" berhasil dihapus.` });
  } catch (err) {
    next(err);
  }
});

// POST /api/alerts/webhooks/:id/test — Send test alert ping
alertsRouter.post('/webhooks/:id/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await AlertingService.testWebhook(id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/alerts/history — View recent delivery logs
alertsRouter.get('/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = (req.query.workspaceId as string) || 'ws-default-command-center';
    const limit = Math.min(Number(req.query.limit) || 50, 100);

    const result = await pool.query(
      `SELECT d.id, d.webhook_id, d.workspace_id, d.event_type, d.payload, d.status_code, d.success, d.error_message, d.created_at, w.name as webhook_name, w.platform
       FROM alert_deliveries d
       LEFT JOIN alert_webhooks w ON d.webhook_id = w.id
       WHERE d.workspace_id = $1
       ORDER BY d.created_at DESC
       LIMIT $2`,
      [workspaceId, limit]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/alerts/dispatch — Trigger an alert manually or from internal services
alertsRouter.post('/dispatch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const alert: AlertPayload = req.body;
    if (!alert.event || !alert.title || !alert.message) {
      return res.status(400).json({ error: { message: 'event, title, and message are required.' } });
    }

    const workspaceId = (req.query.workspaceId as string) || 'ws-default-command-center';
    await AlertingService.dispatchAlert(alert, workspaceId);

    res.json({ success: true, message: 'Alert queued for delivery.' });
  } catch (err) {
    next(err);
  }
});
