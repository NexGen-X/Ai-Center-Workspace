/**
 * Autonomous Web Research & Live Browser API Routes — AI Agent Command Center
 */

import { Router, Request, Response } from 'express';
import { WebResearchService } from '../services/webResearchService.js';
import { systemLogger } from '../services/logger.js';

export const webResearchRouter = Router();

// POST /api/web-research/search — Real-time web search
webResearchRouter.post('/search', async (req: Request, res: Response) => {
  try {
    const { query, limit } = req.body;
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'Parameter query wajib diisi.' });
    }

    const results = await WebResearchService.search(query.trim(), Number(limit) || 5);
    res.json(results);
  } catch (err: any) {
    systemLogger.error('API', `Gagal melakukan pencarian web: ${err.message}`);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /api/web-research/browse — Extract and sanitize web page to Markdown
webResearchRouter.post('/browse', async (req: Request, res: Response) => {
  try {
    const { url, maxLength } = req.body;
    if (!url || typeof url !== 'string' || !url.trim()) {
      return res.status(400).json({ error: 'Parameter url wajib diisi.' });
    }

    const browsed = await WebResearchService.browse(url.trim(), Number(maxLength) || 8000);
    res.json(browsed);
  } catch (err: any) {
    systemLogger.error('API', `Gagal menjelajahi URL [${req.body?.url}]: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

// POST /api/web-research/ingest — Autonomous Web Research & Auto-Ingestion to pgvector RAG
webResearchRouter.post('/ingest', async (req: Request, res: Response) => {
  try {
    const { query, documentTitle, category, tags, projectId } = req.body;
    const workspaceId = (req.body.workspaceId as string) || 'ws-default-command-center';

    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'Parameter query riset wajib diisi.' });
    }

    const result = await WebResearchService.researchAndIngest({
      query: query.trim(),
      documentTitle: documentTitle ? String(documentTitle).trim() : undefined,
      category,
      tags,
      projectId,
      workspaceId
    });

    res.status(201).json(result);
  } catch (err: any) {
    systemLogger.error('API', `Gagal melakukan riset web dan auto-ingestion: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});
