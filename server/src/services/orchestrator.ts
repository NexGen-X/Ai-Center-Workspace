/**
 * Task Orchestrator & Agent Run Execution Service — AI Agent Command Center
 */

import { pool } from '../db/index.js';
import { ConnectionRouter } from '../adapters/router.js';
import { decryptSecret } from '../utils/crypto.js';
import { realtimeHub } from './realtime.js';
import { v4 as uuidv4 } from 'uuid';
import { AgentRun } from '../../../shared/types.js';

export async function executeAgentTask(
  agentId: string,
  userPrompt: string,
  taskId?: string
): Promise<AgentRun> {
  const runId = `run-${uuidv4().slice(0, 8)}`;
  const startedAt = new Date().toISOString();

  // 1. Fetch agent and provider configuration
  const query = `
    SELECT 
      a.id, a.name, a.role, a.system_prompt, a.model_id, a.parameters_json,
      p.id as provider_id, p.name as provider_name, p.provider_type, p.base_url, p.protocol, p.api_key_encrypted
    FROM ai_agents a
    JOIN model_providers p ON a.provider_id = p.id
    WHERE a.id = $1 AND a.enabled = TRUE;
  `;
  const res = await pool.query(query, [agentId]);
  if (res.rows.length === 0) {
    throw new Error(`Agent dengan ID ${agentId} tidak ditemukan atau dinonaktifkan.`);
  }

  const row = res.rows[0];
  const apiKey = row.api_key_encrypted ? decryptSecret(row.api_key_encrypted) : undefined;

  // 2. Insert initial AgentRun record with QUEUED/RUNNING status
  await pool.query(`
    INSERT INTO agent_runs (
      id, agent_id, task_id, model_id, status, input_prompt, started_at
    ) VALUES ($1, $2, $3, $4, 'RUNNING', $5, $6);
  `, [runId, agentId, taskId || null, row.model_id, userPrompt, startedAt]);

  // Update agent status to BUSY
  await pool.query(`
    UPDATE ai_agents SET status = 'BUSY', last_run_at = CURRENT_TIMESTAMP WHERE id = $1;
  `, [agentId]);

  // If associated with a task, update task to IN_PROGRESS
  if (taskId) {
    await pool.query(`
      UPDATE tasks SET status = 'IN_PROGRESS', updated_at = CURRENT_TIMESTAMP WHERE id = $1;
    `, [taskId]);
  }

  // Broadcast status update
  realtimeHub.broadcast('agent.status_changed', { agentId, status: 'BUSY' });
  if (taskId) {
    realtimeHub.broadcast('task.updated', { taskId, status: 'IN_PROGRESS' });
  }

  // 3. Delegate to appropriate adapter
  const adapter = ConnectionRouter.getAdapter(row.provider_type);
  const result = await adapter.execute(
    {
      baseUrl: row.base_url,
      apiKey,
      protocol: row.protocol,
      timeoutMs: 45000
    },
    row.model_id,
    row.system_prompt,
    userPrompt,
    row.parameters_json
  );

  const finishedAt = new Date().toISOString();

  // 4. Update AgentRun record
  await pool.query(`
    UPDATE agent_runs SET
      status = $1,
      output_result = $2,
      error_code = $3,
      error_message = $4,
      duration_ms = $5,
      tokens_prompt = $6,
      tokens_completion = $7,
      tokens_total = $8,
      finished_at = $9
    WHERE id = $10;
  `, [
    result.status,
    result.outputResult || null,
    result.errorCode || null,
    result.errorMessage || null,
    result.durationMs,
    result.tokensUsed?.promptTokens || null,
    result.tokensUsed?.completionTokens || null,
    result.tokensUsed?.totalTokens || null,
    finishedAt,
    runId
  ]);

  // 5. Restore agent status to READY
  await pool.query(`
    UPDATE ai_agents SET status = 'READY', updated_at = CURRENT_TIMESTAMP WHERE id = $1;
  `, [agentId]);

  // If task was running, update task status based on result
  if (taskId) {
    const finalTaskStatus = result.success ? 'DONE' : 'TODO';
    await pool.query(`
      UPDATE tasks 
      SET status = $1, 
          completed_at = ${result.success ? 'CURRENT_TIMESTAMP' : 'NULL'}, 
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2;
    `, [finalTaskStatus, taskId]);

    // Record task history
    await pool.query(`
      INSERT INTO task_history (id, task_id, actor_type, actor_id, event_type, old_value, new_value)
      VALUES ($1, $2, 'AGENT', $3, 'status_changed', 'IN_PROGRESS', $4);
    `, [`hist-${uuidv4().slice(0, 8)}`, taskId, agentId, finalTaskStatus]);

    realtimeHub.broadcast('task.updated', { taskId, status: finalTaskStatus });
  }

  // 6. Record activity
  await pool.query(`
    INSERT INTO activities (id, workspace_id, actor_type, actor_id, actor_name, event_type, summary, target_type, target_id)
    VALUES ($1, 'ws-default-command-center', 'AGENT', $2, $3, $4, $5, 'RUN', $6);
  `, [
    `act-${uuidv4().slice(0, 8)}`,
    agentId,
    row.name,
    result.success ? 'run.succeeded' : 'run.failed',
    `${row.name} menyelesaikan eksekusi tugas (${result.status}) dalam ${result.durationMs}ms`,
    runId
  ]);

  realtimeHub.broadcast('agent.status_changed', { agentId, status: 'READY' });
  realtimeHub.broadcast('activity.created', {
    actorName: row.name,
    summary: `${row.name} menyelesaikan eksekusi tugas (${result.status})`
  });

  return {
    id: runId,
    agentId,
    taskId,
    modelId: row.model_id,
    status: result.status,
    inputPrompt: userPrompt,
    outputResult: result.outputResult,
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
    durationMs: result.durationMs,
    tokensUsed: result.tokensUsed,
    startedAt,
    finishedAt,
    createdAt: startedAt
  };
}
