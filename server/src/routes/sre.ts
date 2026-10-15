/**
 * Autonomous SRE & Self-Healing Incident Agent API Routes — AI Agent Command Center
 */

import { Router, Request, Response } from 'express';
import { SreAgentService } from '../services/sreAgentService.js';
import { systemLogger } from '../services/logger.js';

export const sreRouter = Router();

// GET /api/sre/incidents — List incidents with optional status filter
sreRouter.get('/incidents', async (req: Request, res: Response) => {
  try {
    const workspaceId = (req.query.workspaceId as string) || 'ws-default-command-center';
    const status = req.query.status as string | undefined;

    const incidents = await SreAgentService.getIncidents(workspaceId, status);
    res.json(incidents);
  } catch (err: any) {
    systemLogger.error('API', `Gagal mengambil daftar insiden SRE: ${err.message}`);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// GET /api/sre/incidents/:id — Get details of a single incident
sreRouter.get('/incidents/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const incident = await SreAgentService.getIncident(id);
    if (!incident) {
      return res.status(404).json({ error: `Insiden SRE dengan ID ${id} tidak ditemukan.` });
    }
    res.json(incident);
  } catch (err: any) {
    systemLogger.error('API', `Gagal mengambil insiden SRE [${req.params.id}]: ${err.message}`);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /api/sre/scan — Trigger system health scan and anomaly detection
sreRouter.post('/scan', async (req: Request, res: Response) => {
  try {
    const workspaceId = (req.body?.workspaceId as string) || 'ws-default-command-center';
    const result = await SreAgentService.scanSystemHealth(workspaceId);
    res.json(result);
  } catch (err: any) {
    systemLogger.error('API', `Gagal menjalankan pemindaian kesehatan SRE: ${err.message}`);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /api/sre/incidents/:id/investigate — Autonomous deep diagnostic investigation
sreRouter.post('/incidents/:id/investigate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await SreAgentService.investigateIncident(id);
    res.json(updated);
  } catch (err: any) {
    systemLogger.error('API', `Gagal menginvestigasi insiden SRE [${req.params.id}]: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

// POST /api/sre/incidents/:id/remediate — Execute remediation playbook
sreRouter.post('/incidents/:id/remediate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { operatorApproved } = req.body || {};
    const updated = await SreAgentService.remediateIncident(id, Boolean(operatorApproved));
    res.json(updated);
  } catch (err: any) {
    systemLogger.error('API', `Gagal mengeksekusi remediasi insiden SRE [${req.params.id}]: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

// POST /api/sre/incidents/:id/approve — Operator approves remediation and triggers execution
sreRouter.post('/incidents/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await SreAgentService.approveIncidentRemediation(id);
    res.json(updated);
  } catch (err: any) {
    systemLogger.error('API', `Gagal menyetujui remediasi insiden SRE [${req.params.id}]: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});
