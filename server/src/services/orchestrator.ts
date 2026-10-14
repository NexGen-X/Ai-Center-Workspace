/**
 * Task Orchestrator & Agent Run Execution Service — AI Agent Command Center
 */

import { pool } from '../db/index.js';
import { ConnectionRouter } from '../adapters/router.js';
import { decryptSecret } from '../utils/crypto.js';
import { realtimeHub } from './realtime.js';
import { systemLogger } from './logger.js';
import { ActionManager } from './actionManager.js';
import { RagService } from './ragService.js';
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
      a.id, a.workspace_id, a.name, a.role, a.system_prompt, a.model_id, a.parameters_json, a.capabilities,
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

  // 3. Delegate to appropriate adapter with comprehensive failure recovery & live streaming
  let result: any;
  let finishedAt = new Date().toISOString();
  let accumulatedText = '';
  let isInsideThinkTag = false;

  const onTokenChunk = (chunk: string) => {
    accumulatedText += chunk;

    // Reasoning trace detection:
    // Models like DeepSeek-R1, Qwen-2.5, Claude thinking outputs <think> tags
    if (accumulatedText.includes('<think>') && !accumulatedText.includes('</think>')) {
      isInsideThinkTag = true;
    } else if (accumulatedText.includes('</think>')) {
      isInsideThinkTag = false;
    }

    realtimeHub.broadcast('task.token_chunk', {
      taskId,
      runId,
      agentId,
      agentName: row.name,
      chunk,
      accumulated: accumulatedText,
      isThinking: isInsideThinkTag,
      timestamp: new Date().toISOString()
    });
  };

  const capabilities: string[] = typeof row.capabilities === 'string'
    ? JSON.parse(row.capabilities)
    : (Array.isArray(row.capabilities) ? row.capabilities : []);

  let effectiveSystemPrompt = row.system_prompt;
  if (capabilities.includes('tool_calling') || capabilities.includes('code_generation') || capabilities.includes('server_telemetry')) {
    effectiveSystemPrompt += `\n\n[SANDBOX TOOLS TERSEDIA]
Anda memiliki akses ke Sandbox Tools untuk mengeksekusi aksi nyata di lingkungan:
1. bash_exec: {"command": "perintah shell Linux"} (menjalankan terminal di folder sandbox terisolasi)
2. file_read: {"filePath": "jalur/file"} (membaca isi file proyek)
3. file_write: {"filePath": "namafile.txt", "content": "isi teks"} (menulis file baru di folder sandbox)
4. http_fetch: {"url": "https://..."} (mengambil data dari URL publik)
5. system_inspect: {"query": "metrics"} (melihat telemetri host secara read-only)
6. knowledge_search: {"query": "kata kunci"} (mencari SOP dan dokumen teknis relevan dari pgvector)
7. memory_store: {"keyPoint": "...", "memoryType": "EPISODIC"} (menyimpan catatan ke memori jangka panjang)
8. memory_search: {"query": "..."} (mencari arsip memori masa lalu agen)

Untuk memanggil tool, sertakan blok JSON dalam format:
\`\`\`action
{"tool": "<nama_tool>", "input": { ... }}
\`\`\`
Sistem akan mengevaluasi risiko keamanan dan meminta approval operator jika aksi berisiko tinggi.`;
  }

  // Automatic Semantic RAG & Episodic Memory Context Injection
  try {
    const relevantChunks = await RagService.searchSimilarChunks(
      row.workspace_id || 'ws-default-command-center',
      userPrompt,
      { limit: 2, minSimilarity: 0.45 }
    );
    if (relevantChunks.length > 0) {
      effectiveSystemPrompt += `\n\n[KONTEKS KNOWLEDGE BASE RELEVAN (RAG)]\n` +
        relevantChunks.map(c => `Dokumen: "${c.documentTitle}" (${c.category}, Relevansi: ${(c.similarity * 100).toFixed(0)}%)\n${c.content}`).join('\n---\n');
    }

    const relevantMemories = await RagService.searchAgentMemories(
      agentId,
      userPrompt,
      { limit: 2, minSimilarity: 0.45 }
    );
    if (relevantMemories.length > 0) {
      effectiveSystemPrompt += `\n\n[MEMORI JANGKA PANJANG AGEN (EPISODIK)]\n` +
        relevantMemories.map(m => `- [${m.memoryType}] "${m.keyPoint}" (Relevansi: ${((m.similarity || 0) * 100).toFixed(0)}%)`).join('\n');
    }
  } catch (err: any) {
    // Non-blocking retrieval fallback
  }

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
      effectiveSystemPrompt,
      userPrompt,
      row.parameters_json,
      onTokenChunk
    );
    finishedAt = new Date().toISOString();

    // Check for Action / Tool Calling in output
    const actionMatch = result.outputResult?.match(/```action\s*\n([\s\S]*?)\n```/);
    if (actionMatch && result.success) {
      try {
        const actionPayload = JSON.parse(actionMatch[1].trim());
        if (actionPayload.tool && actionPayload.input) {
          systemLogger.info('INFERENCE', `Agen [${row.name}] mengajukan pemanggilan tool: ${actionPayload.tool}`, {
            agentId,
            taskId,
            tool: actionPayload.tool
          });

          const actionRecord = await ActionManager.requestAction({
            agentId,
            toolName: actionPayload.tool,
            toolInput: actionPayload.input,
            taskId,
            runId
          });

          if (actionRecord.status === 'EXECUTED') {
            result.outputResult += `\n\n[HASIL EKSEKUSI TOOL (${actionPayload.tool})]\n${actionRecord.outputResult}`;
          } else if (actionRecord.status === 'PENDING') {
            result.outputResult += `\n\n⏳ [AKSI MENUNGGU PERSETUJUAN OPERATOR]\nTool: ${actionPayload.tool} (${actionRecord.riskLevel} Risk)\nStatus: Menunggu otorisasi operator di panel Command Center.`;
          }
        }
      } catch (err: any) {
        systemLogger.warn('INFERENCE', `Gagal mem-parse blok aksi dari agen [${row.name}]: ${err.message}`);
      }
    }
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

    // Auto-record episodic memory for completed task
    if (result.success && result.outputResult) {
      try {
        const cleanExcerpt = result.outputResult.slice(0, 200).replace(/\s+/g, ' ').trim();
        await RagService.storeAgentMemory({
          agentId,
          taskId,
          workspaceId: row.workspace_id || 'ws-default-command-center',
          memoryType: 'EPISODIC',
          keyPoint: `Menyelesaikan tugas: "${userPrompt.slice(0, 100)}" -> ${cleanExcerpt}`,
          importanceScore: 0.6
        });
      } catch {
        // Non-blocking memory recording
      }
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

  realtimeHub.broadcast('task.token_completed', {
    taskId,
    runId,
    agentId,
    agentName: row.name,
    status: result.status,
    success: result.success,
    outputResult: result.outputResult,
    durationMs: result.durationMs,
    tokensUsed: result.tokensUsed
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
