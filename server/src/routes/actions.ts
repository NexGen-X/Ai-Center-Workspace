/**
 * Agent Actions & Tool Calling Router — AI Agent Command Center
 */

import { Router, Request, Response } from 'express';
import { ActionManager } from '../services/actionManager.js';
import { AVAILABLE_TOOLS } from '../services/sandbox.js';
import { pool } from '../db/index.js';

const router = Router();

// GET /api/actions — List recent actions
router.get('/', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const actions = await ActionManager.listActions(status, limit);
    res.json({ actions });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// GET /api/actions/tools — List available sandbox tools and risk definitions
router.get('/tools', (_req: Request, res: Response) => {
  res.json({ tools: Object.values(AVAILABLE_TOOLS) });
});

// GET /api/actions/pending-count — Quick count of actions awaiting approval
router.get('/pending-count', async (_req: Request, res: Response) => {
  try {
    const countRes = await pool.query(
      "SELECT count(*) as count FROM agent_actions WHERE status = 'PENDING';"
    );
    res.json({ pendingCount: parseInt(countRes.rows[0].count, 10) });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/actions/request — Request a new tool execution
router.post('/request', async (req: Request, res: Response) => {
  try {
    const { agentId, toolName, toolInput, taskId, runId, autoApprove } = req.body;
    if (!agentId || !toolName || !toolInput) {
      return res.status(400).json({ error: { message: 'agentId, toolName, dan toolInput wajib diisi.' } });
    }

    const action = await ActionManager.requestAction({
      agentId,
      toolName,
      toolInput,
      taskId,
      runId,
      autoApprove
    });

    res.status(201).json(action);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';

// POST /api/actions/:id/approve — Operator approves an action (Protected)
router.post('/:id/approve', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const operatorId = authReq.user?.displayName || authReq.user?.id || 'lead-operator';
    const action = await ActionManager.executeAction(req.params.id, operatorId);
    res.json(action);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/actions/:id/reject — Operator rejects an action (Protected)
router.post('/:id/reject', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const operatorId = authReq.user?.displayName || authReq.user?.id || 'lead-operator';
    const reason = req.body.reason;
    const action = await ActionManager.rejectAction(req.params.id, operatorId, reason);
    res.json(action);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

export default router;
