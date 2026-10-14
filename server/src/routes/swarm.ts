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

/**
 * POST /api/swarm/missions/:id/resume
 * Resume an interrupted or paused swarm mission
 */
router.post('/missions/:id/resume', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const mission = await SwarmService.resumeMission(id);
    return res.json({ success: true, mission });
  } catch (err: any) {
    systemLogger.error('API', `Gagal melanjutkan misi swarm [${req.params.id}]: ${err.message}`);
    return res.status(500).json({ error: { message: err.message || 'Gagal melanjutkan misi swarm.' } });
  }
});

/**
 * GET /api/swarm/missions/:id/artifacts
 * Retrieve the full compiled artifact bundle (markdown report, extracted files, patch)
 */
router.get('/missions/:id/artifacts', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { SwarmArtifactService } = await import('../services/swarmArtifactService.js');
    const bundle = await SwarmArtifactService.generateArtifactBundle(id);
    return res.json({ success: true, data: bundle });
  } catch (err: any) {
    systemLogger.error('API', `Gagal memuat artefak misi swarm [${req.params.id}]: ${err.message}`);
    return res.status(500).json({ error: { message: err.message || 'Gagal menghasilkan artefak misi swarm.' } });
  }
});

/**
 * GET /api/swarm/missions/:id/artifacts/markdown
 * Download or retrieve the executive markdown report
 */
router.get('/missions/:id/artifacts/markdown', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { SwarmArtifactService } = await import('../services/swarmArtifactService.js');
    const bundle = await SwarmArtifactService.generateArtifactBundle(id);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="swarm-report-${id}.md"`);
    return res.send(bundle.markdownReport);
  } catch (err: any) {
    systemLogger.error('API', `Gagal mengunduh laporan markdown [${req.params.id}]: ${err.message}`);
    return res.status(500).json({ error: { message: err.message || 'Gagal mengunduh laporan.' } });
  }
});

/**
 * POST /api/swarm/missions/:id/artifacts/git-branch
 * Automate Git branch creation and commit of mission deliverables
 */
router.post('/missions/:id/artifacts/git-branch', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { branchName, commitMessage } = req.body || {};
    const { SwarmArtifactService } = await import('../services/swarmArtifactService.js');
    const result = await SwarmArtifactService.createGitBranch(id, { branchName, commitMessage });
    return res.json(result);
  } catch (err: any) {
    systemLogger.error('API', `Gagal membuat branch Git untuk misi [${req.params.id}]: ${err.message}`);
    return res.status(500).json({ error: { message: err.message || 'Gagal membuat branch Git.' } });
  }
});

export default router;

