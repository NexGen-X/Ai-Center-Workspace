/**
 * Swarm & Hierarchical Multi-Agent Mesh Routes — AI Agent Command Center
 */

import { Router, Request, Response } from 'express';
import { SwarmService } from '../services/swarmService.js';
import { systemLogger } from '../services/logger.js';

const router = Router();

/**
 * POST /api/swarm/plan
 * Decomposes an objective into a structured DAG subtask preview without execution
 */
router.post('/plan', async (req: Request, res: Response) => {
  try {
    const { objective, workspaceId } = req.body;
    if (!objective || typeof objective !== 'string' || !objective.trim()) {
      return res.status(400).json({ error: { message: 'Objektif misi wajib diisi.' } });
    }

    const plan = await SwarmService.planMission(objective, workspaceId);
    return res.json(plan);
  } catch (err: any) {
    systemLogger.error('API', `Gagal merencanakan misi swarm: ${err.message}`);
    return res.status(500).json({ error: { message: err.message || 'Gagal merencanakan misi swarm.' } });
  }
});

/**
 * POST /api/swarm/dispatch
 * Launches an autonomous multi-agent swarm mission
 */
router.post('/dispatch', async (req: Request, res: Response) => {
  try {
    const { objective, title, subtasks, coordinatorAgentId, workspaceId } = req.body;
    if (!objective || typeof objective !== 'string' || !objective.trim()) {
      return res.status(400).json({ error: { message: 'Objektif misi wajib diisi.' } });
    }

    const mission = await SwarmService.dispatchMission({
      objective,
      title,
      subtasks,
      coordinatorAgentId,
      workspaceId
    });

    return res.status(201).json(mission);
  } catch (err: any) {
    systemLogger.error('API', `Gagal meluncurkan misi swarm: ${err.message}`);
    return res.status(500).json({ error: { message: err.message || 'Gagal meluncurkan misi swarm.' } });
  }
});

/**
 * GET /api/swarm/missions
 * List recent swarm missions
 */
router.get('/missions', async (req: Request, res: Response) => {
  try {
    const workspaceId = (req.query.workspaceId as string) || 'ws-default-command-center';
    const limit = parseInt(req.query.limit as string) || 20;

    const missions = await SwarmService.listMissions(workspaceId, limit);
    return res.json({ missions });
  } catch (err: any) {
    systemLogger.error('API', `Gagal mengambil riwayat misi swarm: ${err.message}`);
    return res.status(500).json({ error: { message: err.message || 'Gagal mengambil riwayat misi swarm.' } });
  }
});

/**
 * GET /api/swarm/missions/:id
 * Retrieve details of a specific swarm mission and all inter-agent messages
 */
router.get('/missions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const details = await SwarmService.getMission(id);
    return res.json(details);
  } catch (err: any) {
    systemLogger.error('API', `Gagal mengambil detail misi swarm [${req.params.id}]: ${err.message}`);
    return res.status(404).json({ error: { message: err.message || 'Misi swarm tidak ditemukan.' } });
  }
});

/**
 * POST /api/swarm/missions/:id/cancel
 * Cancel an active swarm mission
 */
router.post('/missions/:id/cancel', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const success = await SwarmService.cancelMission(id);
    return res.json({
      success,
      message: success ? 'Misi swarm berhasil dibatalkan.' : 'Misi swarm tidak sedang berjalan atau tidak ditemukan.'
    });
  } catch (err: any) {
    systemLogger.error('API', `Gagal membatalkan misi swarm [${req.params.id}]: ${err.message}`);
    return res.status(500).json({ error: { message: err.message || 'Gagal membatalkan misi swarm.' } });
  }
});

export default router;
