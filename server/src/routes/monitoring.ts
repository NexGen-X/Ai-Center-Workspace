/**
 * Monitoring & Telemetry API Routes — AI Agent Command Center
 */

import { Router, Request, Response } from 'express';
import { collectServerMetrics } from '../services/monitoring.js';
import { systemLogger } from '../services/logger.js';

const router = Router();

// GET /api/monitoring/summary — Host server hardware & resource metrics
router.get('/summary', (_req: Request, res: Response) => {
  try {
    const metrics = collectServerMetrics();
    res.json(metrics);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// GET /api/monitoring/logs — Live telemetry & system event ring buffer
router.get('/logs', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const category = req.query.category as string | undefined;
    const level = req.query.level as string | undefined;

    const logs = systemLogger.getRecentLogs(limit, category, level);
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/monitoring/logs/clear — Clear system logs ring buffer
router.post('/logs/clear', (_req: Request, res: Response) => {
  try {
    systemLogger.clearLogs();
    res.json({ success: true, message: 'Buffer log sistem berhasil dibersihkan.' });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

export default router;
