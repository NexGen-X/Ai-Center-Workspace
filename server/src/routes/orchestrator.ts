/**
 * Autonomous Orchestrator Routes — AI Agent Command Center
 */

import { Router, Request, Response } from 'express';
import { taskRunner } from '../services/orchestrator.js';

const router = Router();

// GET /api/orchestrator/status — Get orchestrator daemon status
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const status = await taskRunner.getStatus();
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/orchestrator/toggle — Toggle or set autonomous orchestrator state
router.post('/toggle', async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;
    const isNowEnabled = taskRunner.toggle(enabled !== undefined ? Boolean(enabled) : undefined);
    const status = await taskRunner.getStatus();
    res.json({ success: true, enabled: isNowEnabled, status });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/orchestrator/run-now — Force immediate execution tick
router.post('/run-now', async (_req: Request, res: Response) => {
  try {
    await taskRunner.tick();
    const status = await taskRunner.getStatus();
    res.json({ success: true, message: 'Siklus orkestrasi otonom dijalankan.', status });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/orchestrator/config — Configure orchestrator interval
router.post('/config', async (req: Request, res: Response) => {
  try {
    const { intervalSeconds } = req.body;
    if (intervalSeconds && typeof intervalSeconds === 'number') {
      taskRunner.setIntervalSeconds(intervalSeconds);
    }
    const status = await taskRunner.getStatus();
    res.json({ success: true, status });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

export default router;
