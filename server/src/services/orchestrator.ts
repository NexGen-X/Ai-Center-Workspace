/**
 * Task Orchestrator & Agent Run Execution Service — AI Agent Command Center
 */

import { pool } from '../db/index.js';
import { ConnectionRouter } from '../adapters/router.js';
import { decryptSecret } from '../utils/crypto.js';
import { realtimeHub } from './realtime.js';
import { systemLogger } from './logger.js';
import { v4 as uuidv4 } from 'uuid';
import { AgentRun, OrchestratorStatus } from '../../../shared/types.js';

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

  systemLogger.info('INFERENCE', `Memulai eksekusi agen [${row.name}] menggunakan model ${row.model_id} (${row.provider_name}).`, {
    runId,
    agentId,
    taskId
  });

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

  // 3. Delegate to appropriate adapter with comprehensive failure recovery
  let result: any;
  let finishedAt = new Date().toISOString();

  try {
    const adapter = ConnectionRouter.getAdapter(row.provider_type);
    result = await adapter.execute(
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
    finishedAt = new Date().toISOString();
  } catch (adapterErr: any) {
    finishedAt = new Date().toISOString();
    result = {
      success: false,
      status: 'FAILED',
      errorCode: 'ADAPTER_EXECUTION_ERROR',
      errorMessage: adapterErr.message || 'Gagal mengeksekusi adapter model.',
      durationMs: Date.now() - new Date(startedAt).getTime()
    };
    systemLogger.error('INFERENCE', `Exception pada eksekusi adapter agen [${row.name}]: ${adapterErr.message}`, {
      runId,
      agentId,
      taskId
    });
  }

  try {
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
  } catch (runErr) {
    console.error('[Orchestrator] Error updating agent_runs table:', runErr);
  }

  // 5. Always restore agent status to READY (never leave locked in BUSY)
  try {
    await pool.query(`
      UPDATE ai_agents SET status = 'READY', updated_at = CURRENT_TIMESTAMP WHERE id = $1;
    `, [agentId]);
  } catch (agentResetErr) {
    console.error('[Orchestrator] Error restoring agent status to READY:', agentResetErr);
  }

  // If task was running, update task status based on result
  if (taskId) {
    const finalTaskStatus = result.success ? 'DONE' : 'TODO';
    try {
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
    } catch (taskErr) {
      console.error('[Orchestrator] Error updating task status:', taskErr);
    }
  }

  // 6. Record activity
  try {
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
  } catch (actErr) {
    console.error('[Orchestrator] Error recording activity:', actErr);
  }

  if (result.success) {
    systemLogger.info('INFERENCE', `Agen [${row.name}] berhasil menyelesaikan tugas (${result.tokensUsed?.totalTokens || 0} tokens, ${result.durationMs}ms).`, {
      runId,
      agentId,
      taskId,
      tokensUsed: result.tokensUsed
    });
  } else {
    systemLogger.warn('INFERENCE', `Agen [${row.name}] gagal mengeksekusi tugas: ${result.errorMessage || 'Error tidak diketahui'}.`, {
      runId,
      agentId,
      taskId
    });
  }

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

/**
 * Autonomous Task Runner Daemon
 * Secara otonom memantau antrean tugas TODO, memetakan ke agen yang siap, dan menjalankan inferensi di latar belakang.
 */
class AutonomousTaskRunner {
  private enabled: boolean = false;
  private isRunning: boolean = false;
  private intervalSeconds: number = 10;
  private timer: NodeJS.Timeout | null = null;
  private lastTickAt: string | null = null;
  private lastDispatchedTaskId?: string;
  private lastDispatchedAgentName?: string;

  constructor() {
    // Diinisialisasi dalam status standby
  }

  public start() {
    this.enabled = true;
    if (!this.timer) {
      this.timer = setInterval(() => this.tick(), this.intervalSeconds * 1000);
      systemLogger.info('ORCHESTRATOR', `Autonomous Orchestrator diaktifkan (interval: ${this.intervalSeconds}s).`);
      this.broadcastStatus();
    }
  }

  public stop() {
    this.enabled = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    systemLogger.info('ORCHESTRATOR', 'Autonomous Orchestrator dinonaktifkan (standby).');
    this.broadcastStatus();
  }

  public toggle(enable?: boolean): boolean {
    const target = enable !== undefined ? enable : !this.enabled;
    if (target) {
      this.start();
    } else {
      this.stop();
    }
    return this.enabled;
  }

  public setIntervalSeconds(sec: number) {
    this.intervalSeconds = Math.max(5, Math.min(120, sec));
    if (this.enabled) {
      this.stop();
      this.start();
    }
  }

  public async tick() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTickAt = new Date().toISOString();

    try {
      // 1. Cari tugas status TODO teratas berdasarkan prioritas
      const taskQuery = `
        SELECT t.id, t.title, t.description, t.priority, t.assigned_agent_id
        FROM tasks t
        WHERE t.status = 'TODO'
        ORDER BY 
          CASE t.priority 
            WHEN 'CRITICAL' THEN 1 
            WHEN 'HIGH' THEN 2 
            WHEN 'MEDIUM' THEN 3 
            ELSE 4 
          END ASC,
          t.created_at ASC
        LIMIT 10;
      `;
      const taskRes = await pool.query(taskQuery);
      if (taskRes.rows.length === 0) {
        this.isRunning = false;
        return;
      }

      // 2. Cari agen yang aktif dan siap (READY)
      const agentQuery = `
        SELECT id, name, role, status, enabled 
        FROM ai_agents 
        WHERE enabled = TRUE AND status = 'READY';
      `;
      const agentRes = await pool.query(agentQuery);
      if (agentRes.rows.length === 0) {
        this.isRunning = false;
        return;
      }

      const availableAgents = agentRes.rows;

      // 3. Cocokkan tugas dengan agen yang sesuai
      let taskToRun: any = null;
      let agentToRun: any = null;

      for (const t of taskRes.rows) {
        if (t.assigned_agent_id) {
          const match = availableAgents.find((a: any) => a.id === t.assigned_agent_id);
          if (match) {
            taskToRun = t;
            agentToRun = match;
            break;
          }
        } else {
          // Jika tugas belum memiliki assignee, tugaskan ke agen pertama yang siap
          taskToRun = t;
          agentToRun = availableAgents[0];
          await pool.query('UPDATE tasks SET assigned_agent_id = $1 WHERE id = $2', [agentToRun.id, taskToRun.id]);
          break;
        }
      }

      if (taskToRun && agentToRun) {
        this.lastDispatchedTaskId = taskToRun.id;
        this.lastDispatchedAgentName = agentToRun.name;

        systemLogger.info(
          'ORCHESTRATOR',
          `Auto-dispatch: Menjalankan tugas "${taskToRun.title}" via agen "${agentToRun.name}".`,
          { taskId: taskToRun.id, agentId: agentToRun.id }
        );

        this.broadcastStatus();

        // Eksekusi secara asynchronous
        executeAgentTask(
          agentToRun.id,
          taskToRun.description || taskToRun.title,
          taskToRun.id
        ).catch(err => {
          systemLogger.error('ORCHESTRATOR', `Error eksekusi otomatis task ${taskToRun.id}: ${err.message}`);
        });
      }
    } catch (err: any) {
      systemLogger.error('ORCHESTRATOR', `Tick runner error: ${err.message}`);
    } finally {
      this.isRunning = false;
    }
  }

  public async getStatus(): Promise<OrchestratorStatus> {
    const activeTasksRes = await pool.query("SELECT COUNT(*) as count FROM tasks WHERE status IN ('TODO', 'IN_PROGRESS')");
    const todayRes = await pool.query("SELECT COUNT(*) as count FROM tasks WHERE status = 'DONE' AND completed_at::date = CURRENT_DATE");

    return {
      enabled: this.enabled,
      isRunning: this.isRunning,
      intervalSeconds: this.intervalSeconds,
      activeTasksCount: parseInt(activeTasksRes.rows[0]?.count || '0', 10),
      completedTasksToday: parseInt(todayRes.rows[0]?.count || '0', 10),
      lastTickAt: this.lastTickAt,
      lastDispatchedTaskId: this.lastDispatchedTaskId,
      lastDispatchedAgentName: this.lastDispatchedAgentName
    };
  }

  private broadcastStatus() {
    this.getStatus().then(st => {
      realtimeHub.broadcast('orchestrator.status', st);
    }).catch(() => {});
  }
}

export const taskRunner = new AutonomousTaskRunner();
