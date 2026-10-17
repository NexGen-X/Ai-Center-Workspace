/**
 * Agents API Routes — AI Agent Command Center
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';
import { encryptSecret, decryptSecret } from '../utils/crypto.js';
import { v4 as uuidv4 } from 'uuid';
import { CreateAgentRequest, AIAgent } from '../../../shared/types.js';
import { realtimeHub } from '../services/realtime.js';
import { executeAgentTask } from '../services/orchestrator.js';
import { ConnectionRouter } from '../adapters/router.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// GET /api/agents — List all registered AI Team members
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        a.id, a.workspace_id, a.name, a.role, a.description, a.system_prompt,
        a.provider_id, a.model_id, a.capabilities, a.parameters_json,
        a.enabled, a.status, a.last_run_at, a.created_at, a.updated_at,
        p.name as provider_name, p.provider_type,
        COUNT(DISTINCT t.id)::int as total_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'DONE' THEN t.id END)::int as completed_tasks,
        COUNT(DISTINCT r.id)::int as total_runs
      FROM ai_agents a
      LEFT JOIN model_providers p ON a.provider_id = p.id
      LEFT JOIN tasks t ON a.id = t.assigned_agent_id
      LEFT JOIN agent_runs r ON a.id = r.agent_id
      GROUP BY a.id, p.name, p.provider_type
      ORDER BY a.created_at ASC;
    `);

    const agents: AIAgent[] = result.rows.map(row => ({
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      role: row.role,
      description: row.description || '',
      systemPrompt: row.system_prompt,
      providerId: row.provider_id,
      modelId: row.model_id,
      capabilities: row.capabilities || [],
      parameters: row.parameters_json || {},
      enabled: row.enabled,
      status: row.status,
      lastRunAt: row.last_run_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      providerName: row.provider_name,
      providerType: row.provider_type,
      totalTasks: row.total_tasks || 0,
      completedTasks: row.completed_tasks || 0,
      totalRuns: row.total_runs || 0
    }));

    res.json(agents);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/agents — Create new AI Team member
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const body: CreateAgentRequest = req.body;
    if (!body.name || !body.role || !body.systemPrompt) {
      return res.status(400).json({
        error: { message: 'Nama agen, peran (role), dan instruksi sistem (system prompt) wajib diisi.' }
      });
    }

    await client.query('BEGIN');

    let providerId = body.providerId;

    // Handle provider creation if adding a new provider inline
    if (body.providerMode === 'new_custom' || body.providerMode === 'new_preset' || body.providerMode === 'hermes_runtime') {
      if (!body.newProvider) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: { message: 'Konfigurasi provider baru belum lengkap.' } });
      }

      const newProvId = `prov-${uuidv4().slice(0, 8)}`;
      const encryptedKey = body.newProvider.apiKey ? encryptSecret(body.newProvider.apiKey) : null;
      const initialStatus = body.newProvider.providerType === 'hermes' ? 'UNAVAILABLE' : 'CONNECTION_OK';

      await client.query(`
        INSERT INTO model_providers (
          id, workspace_id, name, provider_type, base_url, protocol, api_key_encrypted, enabled, connection_status
        ) VALUES ($1, 'ws-default-command-center', $2, $3, $4, $5, $6, TRUE, $7);
      `, [
        newProvId,
        body.newProvider.name || `${body.name} Provider`,
        body.newProvider.providerType,
        body.newProvider.baseUrl,
        body.newProvider.protocol,
        encryptedKey,
        initialStatus
      ]);

      providerId = newProvId;
    }

    if (!providerId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: { message: 'Provider ID tidak valid atau tidak dipilih.' } });
    }

    const agentId = `agent-${uuidv4().slice(0, 8)}`;
    const capabilities = body.capabilities || ['general_reasoning', 'task_execution'];
    const parameters = body.parameters || { temperature: 0.7, maxTokens: 2048 };
    const agentStatus = body.providerMode === 'hermes_runtime' ? 'UNAVAILABLE' : 'READY';

    await client.query(`
      INSERT INTO ai_agents (
        id, workspace_id, name, role, description, system_prompt, provider_id, model_id,
        capabilities, parameters_json, enabled, status
      ) VALUES ($1, 'ws-default-command-center', $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10);
    `, [
      agentId,
      body.name,
      body.role,
      body.description || '',
      body.systemPrompt,
      providerId,
      body.modelId,
      JSON.stringify(capabilities),
      JSON.stringify(parameters),
      agentStatus
    ]);

    // Record activity
    await client.query(`
      INSERT INTO activities (id, workspace_id, actor_type, actor_id, actor_name, event_type, summary)
      VALUES ($1, 'ws-default-command-center', 'USER', 'user-admin', 'Lead Operator', 'agent.registered', $2);
    `, [`act-${uuidv4().slice(0, 8)}`, `Anggota AI Team baru didaftarkan: ${body.name} (${body.role})`]);

    await client.query('COMMIT');

    realtimeHub.broadcast('agent.registered', { id: agentId, name: body.name, role: body.role });
    realtimeHub.broadcast('activity.created', {
      actorName: 'Lead Operator',
      summary: `Anggota AI Team baru didaftarkan: ${body.name} (${body.role})`
    });

    res.status(201).json({ id: agentId, message: 'Anggota AI Team berhasil ditambahkan.' });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: { message: err.message } });
  } finally {
    client.release();
  }
});

// GET /api/agents/:id — Detail single agent
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        a.id, a.workspace_id, a.name, a.role, a.description, a.system_prompt,
        a.provider_id, a.model_id, a.capabilities, a.parameters_json,
        a.enabled, a.status, a.last_run_at, a.created_at, a.updated_at,
        p.name as provider_name, p.provider_type
      FROM ai_agents a
      LEFT JOIN model_providers p ON a.provider_id = p.id
      WHERE a.id = $1;
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Agent tidak ditemukan.' } });
    }

    const row = result.rows[0];
    res.json(row);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// PATCH /api/agents/:id — Update agent configuration
router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, role, description, systemPrompt, modelId, enabled, status, parameters } = req.body;
    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (name !== undefined) { updates.push(`name = $${idx++}`); values.push(name); }
    if (role !== undefined) { updates.push(`role = $${idx++}`); values.push(role); }
    if (description !== undefined) { updates.push(`description = $${idx++}`); values.push(description); }
    if (systemPrompt !== undefined) { updates.push(`system_prompt = $${idx++}`); values.push(systemPrompt); }
    if (modelId !== undefined) { updates.push(`model_id = $${idx++}`); values.push(modelId); }
    if (enabled !== undefined) {
      updates.push(`enabled = $${idx++}`);
      values.push(enabled);
      if (status === undefined) {
        updates.push(`status = $${idx++}`);
        values.push(enabled ? 'READY' : 'DISABLED');
      }
    }
    if (status !== undefined) { updates.push(`status = $${idx++}`); values.push(status); }
    if (parameters !== undefined) { updates.push(`parameters_json = $${idx++}`); values.push(JSON.stringify(parameters)); }

    if (updates.length === 0) {
      return res.status(400).json({ error: { message: 'Tidak ada field yang diperbarui.' } });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(req.params.id);

    const query = `
      UPDATE ai_agents
      SET ${updates.join(', ')}
      WHERE id = $${idx}
      RETURNING id;
    `;

    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Agent tidak ditemukan.' } });
    }

    const updatedRes = await pool.query(`
      SELECT 
        a.id, a.workspace_id, a.name, a.role, a.description, a.system_prompt,
        a.provider_id, a.model_id, a.capabilities, a.parameters_json,
        a.enabled, a.status, a.last_run_at, a.created_at, a.updated_at,
        p.name as provider_name, p.provider_type,
        COUNT(DISTINCT t.id)::int as total_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'DONE' THEN t.id END)::int as completed_tasks,
        COUNT(DISTINCT r.id)::int as total_runs
      FROM ai_agents a
      LEFT JOIN model_providers p ON a.provider_id = p.id
      LEFT JOIN tasks t ON a.id = t.assigned_agent_id
      LEFT JOIN agent_runs r ON a.id = r.agent_id
      WHERE a.id = $1
      GROUP BY a.id, p.name, p.provider_type;
    `, [req.params.id]);

    const updatedRow = updatedRes.rows[0];
    const fullAgent: AIAgent = {
      id: updatedRow.id,
      workspaceId: updatedRow.workspace_id,
      name: updatedRow.name,
      role: updatedRow.role,
      description: updatedRow.description || '',
      systemPrompt: updatedRow.system_prompt,
      providerId: updatedRow.provider_id,
      modelId: updatedRow.model_id,
      capabilities: updatedRow.capabilities || [],
      parameters: updatedRow.parameters_json || {},
      enabled: updatedRow.enabled,
      status: updatedRow.status,
      lastRunAt: updatedRow.last_run_at,
      createdAt: updatedRow.created_at,
      updatedAt: updatedRow.updated_at,
      providerName: updatedRow.provider_name,
      providerType: updatedRow.provider_type,
      totalTasks: updatedRow.total_tasks || 0,
      completedTasks: updatedRow.completed_tasks || 0,
      totalRuns: updatedRow.total_runs || 0
    };

    realtimeHub.broadcast('agent.updated', fullAgent);
    res.json(fullAgent);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/agents/:id/ping — Live test connection & latency for registered agent
router.post('/:id/ping', requireAuth, async (req: Request, res: Response) => {
  try {
    const agentRes = await pool.query(`
      SELECT 
        a.id, a.name, a.model_id, a.enabled,
        p.id as provider_id, p.provider_type, p.base_url, p.protocol, p.api_key_encrypted
      FROM ai_agents a
      JOIN model_providers p ON a.provider_id = p.id
      WHERE a.id = $1;
    `, [req.params.id]);

    if (agentRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Agent tidak ditemukan.' } });
    }

    const row = agentRes.rows[0];
    const apiKey = row.api_key_encrypted ? decryptSecret(row.api_key_encrypted) : undefined;
    const adapter = ConnectionRouter.getAdapter(row.provider_type);

    const testRes = await adapter.testConnection({
      baseUrl: row.base_url,
      apiKey,
      protocol: row.protocol,
      timeoutMs: 15000
    });

    const newStatus = testRes.success ? (row.enabled ? 'READY' : 'DISABLED') : 'UNAVAILABLE';
    await pool.query('UPDATE ai_agents SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;', [newStatus, req.params.id]);
    realtimeHub.broadcast('agent.status_changed', { agentId: req.params.id, status: newStatus });

    res.json({
      success: testRes.success,
      status: testRes.status,
      agentStatus: newStatus,
      latencyMs: testRes.latencyMs || 0,
      message: testRes.message,
      discoveredModels: testRes.discoveredModels
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// GET /api/agents/:id/runs — List runs for agent
router.get('/:id/runs', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, agent_id, task_id, model_id, status, input_prompt, output_result,
        error_code, error_message, duration_ms, tokens_prompt, tokens_completion, tokens_total,
        started_at, finished_at, created_at
      FROM agent_runs
      WHERE agent_id = $1
      ORDER BY created_at DESC
      LIMIT 20;
    `, [req.params.id]);

    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/agents/:id/execute — Execute agent directly with prompt
router.post('/:id/execute', requireAuth, async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: { message: 'Prompt eksekusi wajib diisi.' } });
    }

    const runResult = await executeAgentTask(req.params.id, prompt.trim(), undefined);
    res.json(runResult);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// DELETE /api/agents/:id — Delete agent
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await pool.query('DELETE FROM ai_agents WHERE id = $1 RETURNING name', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Agent tidak ditemukan.' } });
    }

    realtimeHub.broadcast('agent.deleted', { agentId: req.params.id });
    res.json({ success: true, message: `Agent "${result.rows[0].name}" berhasil dihapus.` });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

export default router;
