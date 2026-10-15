/**
 * Autonomous Data Analyst & Interactive Visualizer API Routes — AI Agent Command Center
 */

import { Router, Request, Response } from 'express';
import { DataAnalystService } from '../services/dataAnalystService.js';
import { systemLogger } from '../services/logger.js';
import { QuickDataQueryType } from '../../../shared/types.js';

export const dataAnalystRouter = Router();

// GET /api/data-analyst/sessions — List analysis sessions
dataAnalystRouter.get('/sessions', async (req: Request, res: Response) => {
  try {
    const workspaceId = (req.query.workspaceId as string) || 'ws-default-command-center';
    const sessions = await DataAnalystService.getSessions(workspaceId);
    res.json(sessions);
  } catch (err: any) {
    systemLogger.error('API', `Gagal mengambil riwayat analisis data: ${err.message}`);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// GET /api/data-analyst/sessions/:id — Get details of a single analysis session
dataAnalystRouter.get('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const session = await DataAnalystService.getSession(id);
    if (!session) {
      return res.status(404).json({ error: `Sesi analisis data dengan ID ${id} tidak ditemukan.` });
    }
    res.json(session);
  } catch (err: any) {
    systemLogger.error('API', `Gagal mengambil detail sesi analisis data [${req.params.id}]: ${err.message}`);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /api/data-analyst/analyze — Autonomous Data Analysis & Chart Generation
dataAnalystRouter.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { datasetName, sourceType, rawData, queryPrompt } = req.body;
    const workspaceId = (req.body?.workspaceId as string) || 'ws-default-command-center';

    if (!sourceType) {
      return res.status(400).json({ error: 'Parameter "sourceType" (CSV | JSON | TASK_ANALYTICS | SYSTEM_METRICS) wajib diisi.' });
    }
    if (!queryPrompt || typeof queryPrompt !== 'string' || !queryPrompt.trim()) {
      return res.status(400).json({ error: 'Parameter "queryPrompt" wajib diisi.' });
    }

    const session = await DataAnalystService.analyzeData({
      datasetName: datasetName ? String(datasetName).trim() : undefined,
      sourceType,
      rawData,
      queryPrompt: queryPrompt.trim(),
      workspaceId
    });

    res.json(session);
  } catch (err: any) {
    systemLogger.error('API', `Gagal memproses analisis data: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

// POST /api/data-analyst/quick-query — 1-Click Preset Queries
dataAnalystRouter.post('/quick-query', async (req: Request, res: Response) => {
  try {
    const { type } = req.body;
    const workspaceId = (req.body?.workspaceId as string) || 'ws-default-command-center';

    if (!type) {
      return res.status(400).json({ error: 'Parameter "type" wajib diisi.' });
    }

    const session = await DataAnalystService.getQuickQuery(type as QuickDataQueryType, workspaceId);
    res.json(session);
  } catch (err: any) {
    systemLogger.error('API', `Gagal menjalankan preset query data [${req.body?.type}]: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/data-analyst/sessions/:id — Delete analysis session
dataAnalystRouter.delete('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await DataAnalystService.deleteSession(id);
    if (!deleted) {
      return res.status(404).json({ error: `Sesi analisis ${id} tidak ditemukan.` });
    }
    res.json({ success: true, message: `Sesi ${id} berhasil dihapus.` });
  } catch (err: any) {
    systemLogger.error('API', `Gagal menghapus sesi analisis [${req.params.id}]: ${err.message}`);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});
