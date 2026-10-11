/**
 * System Operations (Backup & Restore) — AI Agent Command Center
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';
import { systemLogger } from '../services/logger.js';
import { realtimeHub } from '../services/realtime.js';
import { WorkspaceBackup } from '../../../shared/types.js';

const router = Router();

// GET /api/system/backup — Generate full workspace backup JSON snapshot
router.get('/backup', async (req: Request, res: Response) => {
  try {
    const [projRes, taskRes, agentRes, docRes, provRes, actRes] = await Promise.all([
      pool.query('SELECT * FROM projects ORDER BY created_at ASC'),
      pool.query('SELECT * FROM tasks ORDER BY created_at ASC'),
      pool.query('SELECT * FROM ai_agents ORDER BY created_at ASC'),
      pool.query('SELECT * FROM documents ORDER BY created_at ASC'),
      pool.query('SELECT * FROM model_providers ORDER BY created_at ASC'),
      pool.query('SELECT * FROM activities ORDER BY created_at DESC LIMIT 500')
    ]);

    const backupPayload: WorkspaceBackup = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      workspaceId: 'ws-default-command-center',
      data: {
        projects: projRes.rows.map(r => ({
          id: r.id,
          workspaceId: r.workspace_id,
          name: r.name,
          description: r.description,
          status: r.status,
          progressPercentage: r.progress_percentage,
          dueDate: r.due_date,
          createdAt: r.created_at,
          updatedAt: r.updated_at
        })),
        tasks: taskRes.rows.map(r => ({
          id: r.id,
          workspaceId: r.workspace_id,
          projectId: r.project_id,
          title: r.title,
          description: r.description,
          status: r.status,
          priority: r.priority,
          assignedAgentId: r.assigned_agent_id,
          dueDate: r.due_date,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          completedAt: r.completed_at
        })),
        agents: agentRes.rows.map(r => ({
          id: r.id,
          workspaceId: r.workspace_id,
          name: r.name,
          role: r.role,
          description: r.description,
          systemPrompt: r.system_prompt,
          providerId: r.provider_id,
          modelId: r.model_id,
          capabilities: typeof r.capabilities === 'string' ? JSON.parse(r.capabilities) : (r.capabilities || []),
          parameters: typeof r.parameters_json === 'string' ? JSON.parse(r.parameters_json) : (r.parameters_json || {}),
          enabled: r.enabled,
          status: r.status,
          lastRunAt: r.last_run_at,
          createdAt: r.created_at,
          updatedAt: r.updated_at
        })),
        documents: docRes.rows.map(r => ({
          id: r.id,
          workspaceId: r.workspace_id,
          projectId: r.project_id,
          title: r.title,
          content: r.content,
          category: r.category,
          tags: typeof r.tags === 'string' ? JSON.parse(r.tags) : (r.tags || []),
          createdAt: r.created_at,
          updatedAt: r.updated_at
        })),
        providers: provRes.rows.map(r => ({
          id: r.id,
          name: r.name,
          providerType: r.provider_type,
          baseUrl: r.base_url,
          protocol: r.protocol,
          apiKeyMasked: '••••••••',
          enabled: r.enabled,
          connectionStatus: r.connection_status,
          lastCheckedAt: r.last_checked_at,
          createdAt: r.created_at,
          updatedAt: r.updated_at
        })),
        activities: actRes.rows.map(r => ({
          id: r.id,
          workspaceId: r.workspace_id,
          actorType: r.actor_type,
          actorId: r.actor_id,
          actorName: r.actor_name,
          eventType: r.event_type,
          summary: r.summary,
          targetType: r.target_type,
          targetId: r.target_id,
          createdAt: r.created_at
        }))
      }
    };

    if (req.query.download === 'true') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="ai-center-backup-${new Date().toISOString().slice(0, 10)}.json"`);
    }

    systemLogger.info('SYSTEM', `Snapshot backup dibuat (${backupPayload.data.tasks.length} tasks, ${backupPayload.data.agents.length} agents).`);
    res.json(backupPayload);
  } catch (err: any) {
    systemLogger.error('SYSTEM', `Gagal membuat backup snapshot: ${err.message}`);
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/system/restore — Restore workspace entities from validated JSON snapshot
router.post('/restore', async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const backup: WorkspaceBackup = req.body;
    if (!backup || !backup.data) {
      return res.status(400).json({ error: { message: 'Format backup tidak valid: atribut "data" wajib disertakan.' } });
    }

    await client.query('BEGIN');

    // 1. Restore Projects
    if (Array.isArray(backup.data.projects)) {
      for (const p of backup.data.projects) {
        await client.query(`
          INSERT INTO projects (id, workspace_id, name, description, status, progress_percentage, due_date)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            status = EXCLUDED.status,
            progress_percentage = EXCLUDED.progress_percentage,
            due_date = EXCLUDED.due_date,
            updated_at = CURRENT_TIMESTAMP;
        `, [p.id, p.workspaceId || 'ws-default-command-center', p.name, p.description || null, p.status || 'ACTIVE', p.progressPercentage || 0, p.dueDate || null]);
      }
    }

    // 2. Restore Documents
    if (Array.isArray(backup.data.documents)) {
      for (const d of backup.data.documents) {
        await client.query(`
          INSERT INTO documents (id, workspace_id, project_id, title, content, category, tags)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (id) DO UPDATE SET
            project_id = EXCLUDED.project_id,
            title = EXCLUDED.title,
            content = EXCLUDED.content,
            category = EXCLUDED.category,
            tags = EXCLUDED.tags,
            updated_at = CURRENT_TIMESTAMP;
        `, [d.id, d.workspaceId || 'ws-default-command-center', d.projectId || null, d.title, d.content, d.category, JSON.stringify(d.tags || [])]);
      }
    }

    // 3. Restore Tasks
    if (Array.isArray(backup.data.tasks)) {
      for (const t of backup.data.tasks) {
        await client.query(`
          INSERT INTO tasks (id, workspace_id, project_id, title, description, status, priority, assigned_agent_id, due_date, completed_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (id) DO UPDATE SET
            project_id = EXCLUDED.project_id,
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            status = EXCLUDED.status,
            priority = EXCLUDED.priority,
            assigned_agent_id = EXCLUDED.assigned_agent_id,
            due_date = EXCLUDED.due_date,
            completed_at = EXCLUDED.completed_at,
            updated_at = CURRENT_TIMESTAMP;
        `, [t.id, t.workspaceId || 'ws-default-command-center', t.projectId || null, t.title, t.description || null, t.status, t.priority, t.assignedAgentId || null, t.dueDate || null, t.completedAt || null]);
      }
    }

    await client.query('COMMIT');

    systemLogger.info('SYSTEM', 'Pemulihan data workspace berhasil diselesaikan dari file backup.');
    realtimeHub.broadcast('system.restored', { timestamp: new Date().toISOString() });

    res.json({
      success: true,
      message: 'Workspace berhasil dipulihkan dari snapshot backup.',
      restoredEntities: {
        projects: backup.data.projects?.length || 0,
        tasks: backup.data.tasks?.length || 0,
        documents: backup.data.documents?.length || 0
      }
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    systemLogger.error('SYSTEM', `Gagal memulihkan snapshot: ${err.message}`);
    res.status(500).json({ error: { message: `Gagal memulihkan database: ${err.message}` } });
  } finally {
    client.release();
  }
});

export default router;
