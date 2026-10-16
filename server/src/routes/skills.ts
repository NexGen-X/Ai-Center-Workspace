/**
 * No-Code Agent Skill Builder & Dynamic Tool Studio API Routes — AI Agent Command Center
 */

import { Router, Request, Response } from 'express';
import { SkillStudioService } from '../services/skillStudioService.js';
import { systemLogger } from '../services/logger.js';

export const skillsRouter = Router();

// GET /api/skills — List all custom skills
skillsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const workspaceId = (req.query.workspaceId as string) || 'ws-default-command-center';
    const isEnabledOnly = req.query.enabled === 'true';

    const skills = await SkillStudioService.listSkills(workspaceId, isEnabledOnly);
    res.json(skills);
  } catch (err: any) {
    systemLogger.error('API', `Gagal mengambil daftar skill kustom: ${err.message}`);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// GET /api/skills/:id — Get single skill details
skillsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const skill = await SkillStudioService.getSkill(id);
    if (!skill) {
      return res.status(404).json({ error: `Skill "${id}" tidak ditemukan.` });
    }
    res.json(skill);
  } catch (err: any) {
    systemLogger.error('API', `Gagal mengambil detail skill [${req.params.id}]: ${err.message}`);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /api/skills — Create new dynamic skill
skillsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const {
      name,
      displayName,
      description,
      category,
      riskLevel,
      requiresApproval,
      executionType,
      parametersSchema,
      restConfig,
      mockOutputTemplate,
      allowedAgentIds,
      isEnabled
    } = req.body;
    const workspaceId = (req.body?.workspaceId as string) || 'ws-default-command-center';

    const created = await SkillStudioService.createSkill({
      name,
      displayName,
      description,
      category,
      riskLevel,
      requiresApproval,
      executionType,
      parametersSchema,
      restConfig,
      mockOutputTemplate,
      allowedAgentIds,
      isEnabled,
      workspaceId
    });

    res.status(201).json(created);
  } catch (err: any) {
    systemLogger.error('API', `Gagal membuat skill kustom: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

// PUT /api/skills/:id — Update existing skill
skillsRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await SkillStudioService.updateSkill(id, req.body);
    res.json(updated);
  } catch (err: any) {
    systemLogger.error('API', `Gagal memperbarui skill [${req.params.id}]: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/skills/:id — Delete skill
skillsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await SkillStudioService.deleteSkill(id);
    if (!deleted) {
      return res.status(404).json({ error: `Skill "${id}" tidak ditemukan.` });
    }
    res.json({ success: true, message: `Skill ${id} berhasil dihapus.` });
  } catch (err: any) {
    systemLogger.error('API', `Gagal menghapus skill [${req.params.id}]: ${err.message}`);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// POST /api/skills/:id/test — Test execute skill with sample inputs
skillsRouter.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { input, agentId } = req.body || {};
    const result = await SkillStudioService.executeCustomSkill(id, input || {}, { agentId });
    res.json(result);
  } catch (err: any) {
    systemLogger.warn('API', `Pengujian eksekusi skill [${req.params.id}] gagal: ${err.message}`);
    res.status(400).json({ error: err.message });
  }
});
