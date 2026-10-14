/**
 * RAG & Semantic Vector Memory API Routes — AI Agent Command Center
 */

import { Router, Request, Response, NextFunction } from 'express';
import { RagService } from '../services/ragService.js';
import { RagSearchRequest, StoreMemoryRequest } from '../../../shared/types.js';

const router = Router();

// GET /api/rag/stats — RAG & pgvector status
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await RagService.getRagStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// POST /api/rag/index/:docId — Index single document
router.post('/index/:docId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { docId } = req.params;
    const result = await RagService.indexDocument(docId);
    res.json({
      success: true,
      documentId: docId,
      chunksIndexed: result.chunksIndexed,
      message: `Dokumen berhasil diindeks ke dalam ${result.chunksIndexed} vektor chunk.`
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/rag/index-all — Index all documents
router.post('/index-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await RagService.indexAllDocuments();
    res.json({
      success: true,
      totalIndexed: result.totalIndexed,
      documentsCount: result.documentsCount,
      message: `Berhasil mengindeks ${result.documentsCount} dokumen ke dalam ${result.totalIndexed} vektor chunk.`
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/rag/search — Semantic vector similarity search
router.post('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, limit = 5, minSimilarity = 0.35, category, projectId } = req.body as RagSearchRequest;
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ error: { message: 'Parameter "query" wajib diisi.' } });
    }

    const matches = await RagService.searchSimilarChunks('ws-default-command-center', query.trim(), {
      limit: Number(limit),
      minSimilarity: Number(minSimilarity),
      category,
      projectId
    });

    res.json({
      query: query.trim(),
      matchesCount: matches.length,
      matches
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/rag/memories — Retrieve agent memories
router.get('/memories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agentId = req.query.agentId as string | undefined;
    const limit = parseInt(req.query.limit as string || '50', 10);
    const memories = await RagService.getAgentMemories(agentId, limit);
    res.json(memories);
  } catch (err) {
    next(err);
  }
});

// POST /api/rag/memories — Store new episodic or factual memory
router.post('/memories', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agentId, taskId, memoryType = 'EPISODIC', keyPoint, context, importanceScore } = req.body as StoreMemoryRequest;
    if (!agentId || !keyPoint) {
      return res.status(400).json({ error: { message: 'Parameter "agentId" dan "keyPoint" wajib diisi.' } });
    }

    const item = await RagService.storeAgentMemory({
      agentId,
      taskId,
      memoryType,
      keyPoint,
      context,
      importanceScore
    });

    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/rag/memories/:id — Delete memory item
router.delete('/memories/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const deleted = await RagService.deleteAgentMemory(id);
    if (!deleted) {
      return res.status(404).json({ error: { message: 'Memori tidak ditemukan.' } });
    }
    res.json({ success: true, message: 'Memori berhasil dihapus.' });
  } catch (err) {
    next(err);
  }
});

export default router;
