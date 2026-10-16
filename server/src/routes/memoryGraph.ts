/**
 * Cognitive Memory Graph Explorer API Routes — AI Agent Command Center
 */

import { Router, Request, Response, NextFunction } from 'express';
import { MemoryGraphService } from '../services/memoryGraphService.js';
import {
  PruneMemoriesRequest,
  ShareMemoryRequest,
  ConsolidateMemoriesRequest
} from '../../../shared/types.js';

const router = Router();

// GET /api/memory-graph — Retrieve cognitive memory graph nodes, edges, and statistics
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = (req.query.workspaceId as string) || 'ws-default-command-center';
    const agentId = req.query.agentId as string | undefined;
    const minSimilarity = req.query.minSimilarity ? parseFloat(req.query.minSimilarity as string) : 0.30;
    const memoryType = req.query.memoryType as string | undefined;
    const searchQuery = req.query.searchQuery as string | undefined;

    const graphData = await MemoryGraphService.getMemoryGraph(workspaceId, {
      agentId,
      minSimilarity,
      memoryType,
      searchQuery
    });

    res.json(graphData);
  } catch (err) {
    next(err);
  }
});

// POST /api/memory-graph/prune — Prune decayed memories
router.post('/prune', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = req.body as PruneMemoriesRequest;
    const result = await MemoryGraphService.pruneMemories(payload);
    res.json({
      success: true,
      ...result
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/memory-graph/share — Replicate memory to other agents
router.post('/share', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = req.body as ShareMemoryRequest;
    if (!payload.memoryId || !Array.isArray(payload.targetAgentIds) || payload.targetAgentIds.length === 0) {
      return res.status(400).json({ error: { message: 'memoryId dan targetAgentIds wajib diisi.' } });
    }

    const result = await MemoryGraphService.shareMemory(payload);
    res.json({
      success: true,
      ...result,
      message: `Berhasil membagikan memori ke ${result.sharedCount} agen target.`
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/memory-graph/consolidate — Synthesize multiple memories into a single consolidated rule
router.post('/consolidate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = req.body as ConsolidateMemoriesRequest;
    if (!Array.isArray(payload.memoryIds) || payload.memoryIds.length < 2) {
      return res.status(400).json({ error: { message: 'Minimal 2 memori diperlukan untuk konsolidasi.' } });
    }
    if (!payload.newKeyPoint || payload.newKeyPoint.trim().length === 0) {
      return res.status(400).json({ error: { message: 'newKeyPoint wajib diisi.' } });
    }

    const consolidated = await MemoryGraphService.consolidateMemories(payload);
    res.status(201).json({
      success: true,
      consolidated,
      message: 'Memori berhasil dikonsolidasi.'
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/memory-graph/seed — Force re-seed sample cognitive memories
router.post('/seed', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.body.workspaceId || 'ws-default-command-center';
    await MemoryGraphService.seedSampleMemoriesIfEmpty(workspaceId);
    res.json({ success: true, message: 'Sampel memori kognitif siap diakses.' });
  } catch (err) {
    next(err);
  }
});

export default router;
