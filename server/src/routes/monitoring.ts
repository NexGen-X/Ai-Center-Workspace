/**
 * Monitoring API Routes — AI Agent Command Center
 */

import { Router, Request, Response } from 'express';
import { collectServerMetrics } from '../services/monitoring.js';

const router = Router();

// GET /api/monitoring/summary
router.get('/summary', (_req: Request, res: Response) => {
  try {
    const metrics = collectServerMetrics();
    res.json(metrics);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

export default router;
