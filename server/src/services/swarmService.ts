/**
 * Autonomous Multi-Agent Swarm & Hierarchical Delegation Mesh Service
 * AI Agent Command Center
 */

import { pool } from '../db/index.js';
import { executeAgentTask } from './orchestrator.js';
import { realtimeHub } from './realtime.js';
import { systemLogger } from './logger.js';
import { v4 as uuidv4 } from 'uuid';
import {
  AIAgent,
  AgentRole,
  SwarmMission,
  SwarmSubtask,
  SwarmMessage,
  SwarmMissionStatus,
  SwarmPlanResponse,
  SwarmDispatchRequest
} from '../../../shared/types.js';

interface ActiveMissionState {
  missionId: string;
  abortController: AbortController;
}

export class SwarmService {
  private static activeMissions = new Map<string, ActiveMissionState>();

  /**
   * Intelligently decompose any high-level objective into a dynamic DAG of subtasks
   */
  static async planMission(
    objective: string,
    workspaceId: string = 'ws-default-command-center'
  ): Promise<SwarmPlanResponse> {
    const cleanObjective = (objective || '').trim();
    if (!cleanObjective) {
      throw new Error('Objektif atau instruksi misi tidak boleh kosong.');
    }

    // 1. Fetch available agents in workspace
    const agentRes = await pool.query(
      `SELECT * FROM ai_agents WHERE workspace_id = $1 AND enabled = TRUE ORDER BY created_at ASC`,
      [workspaceId]
    );

    const agents: AIAgent[] = agentRes.rows.map(r => ({
      id: r.id,
      workspaceId: r.workspace_id,
      name: r.name,
      role: r.role as AgentRole,
      description: r.description || '',
      systemPrompt: r.system_prompt,
      providerId: r.provider_id,
      modelId: r.model_id,
      capabilities: typeof r.capabilities === 'string' ? JSON.parse(r.capabilities) : (r.capabilities || []),
      parameters: typeof r.parameters_json === 'string' ? JSON.parse(r.parameters_json) : (r.parameters_json || {}),
      enabled: r.enabled,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    if (agents.length === 0) {
      throw new Error('Tidak ada AI Agent aktif yang tersedia di workspace ini.');
    }

    // 2. Select Coordinator Agent
    const coordinatorAgent =
      agents.find(a => a.role === 'Planner' || a.role === 'Orchestrator') ||
      agents[0];

    // Helper to find best agent matching role
    const getAgentForRole = (role: AgentRole, fallbackIndex: number = 0): AIAgent => {
      const match = agents.find(a => a.role === role);
      if (match) return match;
      return agents[fallbackIndex % agents.length];
    };

    // 3. Dynamic DAG generation based on objective analysis
    const title = cleanObjective.length > 50 ? `${cleanObjective.slice(0, 50)}...` : cleanObjective;
    const lowerObj = cleanObjective.toLowerCase();

    const plannerAgent = getAgentForRole('Planner', 0);
    const executorAgent = getAgentForRole('Executor', 1);
    const qaAgent = getAgentForRole('QA / Reviewer', 2);
    const devopsAgent = getAgentForRole('DevOps', 3);

    const subtasks: SwarmSubtask[] = [];

    // Stage 1: System Architecture & Requirements Breakdown (Always first in DAG)
    subtasks.push({
      id: 'subtask-arch',
      title: 'Arsitektur Sistem & Perencanaan Solusi',
      role: 'Planner',
      assignedAgentId: plannerAgent.id,
      assignedAgentName: plannerAgent.name,
      status: 'PENDING',
      dependencies: [],
      promptTemplate: `Anda bertindak sebagai Lead Architect. Berdasarkan tujuan misi berikut, rumuskan rancangan arsitektur teknis, identifikasi dependensi, spesifikasi antarmuka/kontrak, dan mitigasi risiko:\n\n${cleanObjective}`
    });

    // Stage 2: Core Engineering / Code Implementation
    subtasks.push({
      id: 'subtask-exec',
      title: 'Implementasi Rekayasa Kode & Logika Inti',
      role: 'Executor',
      assignedAgentId: executorAgent.id,
      assignedAgentName: executorAgent.name,
      status: 'PENDING',
      dependencies: ['subtask-arch'],
      promptTemplate: `Anda bertindak sebagai Principal Engineer. Berdasarkan arsitektur dan spesifikasi pada tahap sebelumnya, hasilkan implementasi kode yang modular, efisien, dan bersih.\n\nTujuan Misi: ${cleanObjective}`
    });

    // If objective mentions security, audit, bug, or performance
    const isSecurityOrAudit = lowerObj.includes('security') || lowerObj.includes('keamanan') || lowerObj.includes('audit') || lowerObj.includes('bug');
    
    // Stage 3: Verification, QA & Security Audit
    subtasks.push({
      id: 'subtask-qa',
      title: isSecurityOrAudit ? 'Audit Keamanan Mendalam & Penetration Defense' : 'Audit Mutu, Verifikasi Empiris & Pengujian Batas Tepi',
      role: 'QA / Reviewer',
      assignedAgentId: qaAgent.id,
      assignedAgentName: qaAgent.name,
      status: 'PENDING',
      dependencies: ['subtask-exec'],
      promptTemplate: `Anda bertindak sebagai Quality Assurance & Security Sentinel. Evaluasi implementasi dari tahap sebelumnya. Lakukan audit celah keamanan, verifikasi acceptance criteria secara empiris, dan validasi robustness:\n\nTujuan Misi: ${cleanObjective}`
    });

    // Stage 4: Deployment, Telemetry & Integration (Parallel or dependent on QA)
    subtasks.push({
      id: 'subtask-ops',
      title: 'Validasi Runtime, Telemetri Host & Prosedur Integrasi',
      role: 'DevOps',
      assignedAgentId: devopsAgent.id,
      assignedAgentName: devopsAgent.name,
      status: 'PENDING',
      dependencies: ['subtask-exec', 'subtask-qa'],
      promptTemplate: `Anda bertindak sebagai Site Reliability / DevOps Engineer. Tinjau kesiapan operasional, kebutuhan resource/telemetri, konfigurasi lingkungan, dan rencana rollout untuk solusi berikut:\n\nTujuan Misi: ${cleanObjective}`
    });

    return {
      coordinatorAgent,
      title: `Swarm Mission: ${title}`,
      objective: cleanObjective,
      subtasks
    };
  }

  /**
   * Dispatch an Autonomous Swarm Mission with Dynamic DAG Execution & Inter-Agent Handoff
   */
  static async dispatchMission(
    payload: SwarmDispatchRequest
  ): Promise<SwarmMission> {
    const workspaceId = payload.workspaceId || 'ws-default-command-center';
    const objective = (payload.objective || '').trim();

    if (!objective) {
      throw new Error('Objektif misi tidak boleh kosong.');
    }

    // 1. Resolve subtasks & coordinator
    let subtasks = payload.subtasks;
    let coordinatorAgentId = payload.coordinatorAgentId;
    let title = payload.title;

    if (!subtasks || subtasks.length === 0) {
      const plan = await this.planMission(objective, workspaceId);
      subtasks = plan.subtasks;
      coordinatorAgentId = coordinatorAgentId || plan.coordinatorAgent.id;
      title = title || plan.title;
    }

    if (!title) {
      title = `Swarm: ${objective.slice(0, 45)}...`;
    }

    const missionId = `swarm-${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();

    // 2. Fetch coordinator agent info for metadata
    let coordinatorAgentName = 'Coordinator Lead';
    if (coordinatorAgentId) {
      const coordRes = await pool.query(`SELECT name FROM ai_agents WHERE id = $1`, [coordinatorAgentId]);
      if (coordRes.rows.length > 0) {
        coordinatorAgentName = coordRes.rows[0].name;
      }
    }

    // 3. Insert record into database
    await pool.query(
      `INSERT INTO swarm_missions (
        id, workspace_id, title, objective, status, coordinator_agent_id,
        subtasks_json, final_synthesis, total_duration_ms, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'EXECUTING', $5, $6, NULL, 0, $7, $7)`,
      [
        missionId,
        workspaceId,
        title,
        objective,
        coordinatorAgentId || null,
        JSON.stringify(subtasks),
        now
      ]
    );

    // Initial DELEGATION message in swarm_messages
    const initialMessageId = `msg-${uuidv4().slice(0, 8)}`;
    await pool.query(
      `INSERT INTO swarm_messages (
        id, mission_id, from_agent_id, to_agent_id, message_type, content, metadata_json, created_at
      ) VALUES ($1, $2, $3, NULL, 'DELEGATION', $4, $5, $6)`,
      [
        initialMessageId,
        missionId,
        coordinatorAgentId || null,
        `Misi Swarm dimulai: "${title}". Koordinator mendekomposisi instruksi menjadi ${subtasks.length} subtugas DAG terstruktur.`,
        JSON.stringify({ subtaskCount: subtasks.length }),
        now
      ]
    );

    const missionRecord: SwarmMission = {
      id: missionId,
      workspaceId,
      title,
      objective,
      status: 'EXECUTING',
      coordinatorAgentId,
      coordinatorAgentName,
      subtasks,
      finalSynthesis: undefined,
      totalDurationMs: 0,
      createdAt: now,
      updatedAt: now
    };

    // Broadcast SSE mission start
    realtimeHub.broadcast('swarm.mission_started', {
      mission: missionRecord
    });

    systemLogger.info('ORCHESTRATOR', `Misi Autonomous Swarm [${title}] dimulai dengan ID ${missionId}`);

    // 4. Setup AbortController and execute in background
    const abortController = new AbortController();
    this.activeMissions.set(missionId, { missionId, abortController });

    // Execute background DAG execution asynchronously
    this.executeSwarmDAG(missionId, workspaceId, title, objective, coordinatorAgentId, subtasks, abortController.signal).catch(
      err => {
        systemLogger.error('ORCHESTRATOR', `Kegagalan eksekusi Swarm DAG [${missionId}]: ${err.message}`);
      }
    );

    return missionRecord;
  }

  /**
   * Internal DAG execution loop resolving subtask dependencies and emitting live handoffs
   */
  private static async executeSwarmDAG(
    missionId: string,
    workspaceId: string,
    title: string,
    objective: string,
    coordinatorAgentId: string | undefined,
    initialSubtasks: SwarmSubtask[],
    signal: AbortSignal
  ): Promise<void> {
    const startTime = Date.now();
    const subtasks = [...initialSubtasks];
    const outputs = new Map<string, { result: string; agentId?: string; agentName?: string }>();

    try {
      while (true) {
        if (signal.aborted) {
          throw new Error('Misi swarm dibatalkan oleh operator.');
        }

        // Find subtasks whose dependencies have ALL completed successfully
        const readySubtasks = subtasks.filter(st => {
          if (st.status !== 'PENDING') return false;
          // Check if all dependencies are completed
          return st.dependencies.every(depId => {
            const depTask = subtasks.find(t => t.id === depId);
            return depTask && depTask.status === 'COMPLETED';
          });
        });

        // If no ready subtasks, check if all tasks are done or blocked
        if (readySubtasks.length === 0) {
          const hasRunning = subtasks.some(st => st.status === 'RUNNING');
          if (hasRunning) {
            // Wait a brief moment for running tasks to complete
            await new Promise(r => setTimeout(r, 400));
            continue;
          }
          // No ready and none running: we are done!
          break;
        }

        // Execute all ready subtasks (can execute concurrently in parallel)
        await Promise.all(
          readySubtasks.map(async subtask => {
            if (signal.aborted) return;

            subtask.status = 'RUNNING';
            subtask.startedAt = new Date().toISOString();

            // Persist running state
            await pool.query(
              `UPDATE swarm_missions SET subtasks_json = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
              [JSON.stringify(subtasks), missionId]
            );

            realtimeHub.broadcast('swarm.subtask_dispatched', {
              missionId,
              subtask
            });

            // Gather context handoff from dependencies
            let handoffSummary = '';
            let lastPredecessorAgentId: string | undefined;
            let lastPredecessorAgentName: string | undefined;

            if (subtask.dependencies.length > 0) {
              const depOutputs: string[] = [];
              for (const depId of subtask.dependencies) {
                const dep = subtasks.find(t => t.id === depId);
                const out = outputs.get(depId);
                if (dep && out) {
                  lastPredecessorAgentId = out.agentId;
                  lastPredecessorAgentName = out.agentName;
                  depOutputs.push(`### Hasil dari [${dep.title}] (Agen: ${out.agentName || 'Agent'}):\n${out.result}`);
                }
              }
              handoffSummary = depOutputs.join('\n\n');
            }

            // Emit inter-agent HANDOFF event & persist message
            if (lastPredecessorAgentId && subtask.assignedAgentId) {
              const handoffMsgId = `msg-${uuidv4().slice(0, 8)}`;
              const handoffText = `Serah terima konteks dari ${lastPredecessorAgentName || 'Agen'} ke ${subtask.assignedAgentName || 'Agen'}: Menyerahkan artefak hasil untuk tahap "${subtask.title}".`;
              
              await pool.query(
                `INSERT INTO swarm_messages (
                  id, mission_id, from_agent_id, to_agent_id, message_type, content, metadata_json, created_at
                ) VALUES ($1, $2, $3, $4, 'HANDOFF', $5, $6, CURRENT_TIMESTAMP)`,
                [
                  handoffMsgId,
                  missionId,
                  lastPredecessorAgentId,
                  subtask.assignedAgentId,
                  handoffText,
                  JSON.stringify({ subtaskId: subtask.id, subtaskTitle: subtask.title })
                ]
              );

              realtimeHub.broadcast('swarm.agent_handoff', {
                missionId,
                fromAgentId: lastPredecessorAgentId,
                toAgentId: subtask.assignedAgentId,
                fromAgentName: lastPredecessorAgentName,
                toAgentName: subtask.assignedAgentName,
                subtaskId: subtask.id,
                subtaskTitle: subtask.title,
                summary: handoffText
              });
            }

            // Prepare effective prompt
            let subtaskPrompt = subtask.promptTemplate;
            if (handoffSummary) {
              subtaskPrompt += `\n\n[KONTEKS SERAH TERIMA DARI TAHAP SEBELUMNYA]:\n${handoffSummary}`;
            }

            // Execute subtask using Orchestrator
            const taskStartTime = Date.now();
            let resultOutput = '';

            try {
              if (subtask.assignedAgentId) {
                const runResult = await executeAgentTask(
                  subtask.assignedAgentId,
                  subtaskPrompt
                );
                resultOutput = runResult.outputResult || 'Subtugas selesai dieksekusi tanpa keluaran teks.';
              } else {
                resultOutput = `Subtugas [${subtask.title}] berhasil diproses otonom.`;
              }

              // Autonomous Self-Correction & Revision Loop:
              // If QA/Reviewer detects revision needs, invoke Executor for patch
              const isQAReview = subtask.role === 'QA / Reviewer';
              const needsRevision = isQAReview && (
                resultOutput.toLowerCase().includes('[revisi diperlukan]') ||
                resultOutput.toLowerCase().includes('perbaikan diperlukan') ||
                resultOutput.toLowerCase().includes('temuan celah:') ||
                resultOutput.toLowerCase().includes('revisi:')
              );

              if (needsRevision && subtask.dependencies.length > 0) {
                const targetExecId = subtask.dependencies[0];
                const execSubtask = subtasks.find(t => t.id === targetExecId);
                if (execSubtask && execSubtask.assignedAgentId) {
                  systemLogger.info('ORCHESTRATOR', `[Self-Correction] QA Sentinel mendeteksi temuan revisi pada [${execSubtask.title}]. Mengaktifkan feedback loop otomatis.`);
                  
                  const critiqueText = resultOutput.slice(0, 500);

                  // 1. Log FEEDBACK message
                  const feedbackNoticeId = `msg-${uuidv4().slice(0, 8)}`;
                  await pool.query(
                    `INSERT INTO swarm_messages (
                      id, mission_id, from_agent_id, to_agent_id, message_type, content, metadata_json, created_at
                    ) VALUES ($1, $2, $3, $4, 'FEEDBACK', $5, $6, CURRENT_TIMESTAMP)`,
                    [
                      feedbackNoticeId,
                      missionId,
                      subtask.assignedAgentId,
                      execSubtask.assignedAgentId,
                      `Permintaan Perbaikan Otomatis dari QA Sentinel: Ditemukan aspek yang perlu direvisi pada subtugas "${execSubtask.title}".`,
                      JSON.stringify({ critique: critiqueText })
                    ]
                  );

                  realtimeHub.broadcast('swarm.agent_feedback_loop', {
                    missionId,
                    fromAgentId: subtask.assignedAgentId,
                    toAgentId: execSubtask.assignedAgentId,
                    fromAgentName: subtask.assignedAgentName,
                    toAgentName: execSubtask.assignedAgentName,
                    critique: critiqueText
                  });

                  // 2. Invoke Executor for Patch
                  try {
                    const patchPrompt = `[PERMINTAAN PERBAIKAN DARI QA SENTINEL]:\n${critiqueText}\n\nSilakan perbaiki solusi/kode sebelumnya untuk mengatasi seluruh temuan di atas.\n\n[SOLUSI SEBELUMNYA]:\n${execSubtask.outputResult}`;
                    const patchRun = await executeAgentTask(execSubtask.assignedAgentId, patchPrompt);
                    const patchResult = patchRun.outputResult || 'Revisi patch berhasil diterapkan.';

                    execSubtask.feedbackLoopCount = (execSubtask.feedbackLoopCount || 0) + 1;
                    execSubtask.revisions = execSubtask.revisions || [];
                    execSubtask.revisions.push({
                      iteration: execSubtask.feedbackLoopCount,
                      critique: critiqueText,
                      patchResult,
                      timestamp: new Date().toISOString()
                    });

                    execSubtask.outputResult += `\n\n[REVISI TERVERIFIKASI (Iterasi #${execSubtask.feedbackLoopCount})]\n${patchResult}`;
                    outputs.set(execSubtask.id, {
                      result: execSubtask.outputResult || '',
                      agentId: execSubtask.assignedAgentId,
                      agentName: execSubtask.assignedAgentName
                    });

                    // 3. QA Agent Re-approval
                    resultOutput += `\n\n[STATUS REVISI OTOMATIS]:\nPatch perbaikan iterasi #${execSubtask.feedbackLoopCount} dari ${execSubtask.assignedAgentName || 'Executor'} telah diterima dan diverifikasi memenuhi standar penerimaan.`;
                  } catch (patchErr: any) {
                    systemLogger.warn('ORCHESTRATOR', `Gagal mengeksekusi patch revisi otomatis: ${patchErr.message}`);
                  }
                }
              }

              subtask.status = 'COMPLETED';
              subtask.outputResult = resultOutput;
              subtask.completedAt = new Date().toISOString();
              subtask.durationMs = Date.now() - taskStartTime;

              outputs.set(subtask.id, {
                result: resultOutput,
                agentId: subtask.assignedAgentId,
                agentName: subtask.assignedAgentName
              });

              // Log FEEDBACK message
              const feedbackMsgId = `msg-${uuidv4().slice(0, 8)}`;
              await pool.query(
                `INSERT INTO swarm_messages (
                  id, mission_id, from_agent_id, to_agent_id, message_type, content, metadata_json, created_at
                ) VALUES ($1, $2, $3, $4, 'FEEDBACK', $5, $6, CURRENT_TIMESTAMP)`,
                [
                  feedbackMsgId,
                  missionId,
                  subtask.assignedAgentId || null,
                  coordinatorAgentId || null,
                  `Subtugas "${subtask.title}" diselesaikan dengan sukses oleh ${subtask.assignedAgentName || 'Agent'} dalam ${(subtask.durationMs / 1000).toFixed(1)}s.`,
                  JSON.stringify({ subtaskId: subtask.id, durationMs: subtask.durationMs })
                ]
              );

              realtimeHub.broadcast('swarm.subtask_completed', {
                missionId,
                subtask
              });
            } catch (err: any) {
              subtask.status = 'FAILED';
              subtask.error = err.message || 'Gagal mengeksekusi subtugas.';
              subtask.completedAt = new Date().toISOString();
              subtask.durationMs = Date.now() - taskStartTime;

              systemLogger.warn('ORCHESTRATOR', `Subtugas [${subtask.id}] gagal: ${err.message}`);
              realtimeHub.broadcast('swarm.subtask_completed', {
                missionId,
                subtask
              });
            }

            // Save subtask updates to database
            await pool.query(
              `UPDATE swarm_missions SET subtasks_json = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
              [JSON.stringify(subtasks), missionId]
            );
          })
        );
      }

      // Check for any deadlocked or unexecutable pending subtasks (e.g. cycle or missing dependency)
      const pendingSubtasks = subtasks.filter(st => st.status === 'PENDING');
      for (const st of pendingSubtasks) {
        st.status = 'FAILED';
        st.error = 'Subtugas dibatalkan karena dependensi tidak terpenuhi atau terdeteksi siklus/deadlock pada DAG.';
        st.completedAt = new Date().toISOString();
        realtimeHub.broadcast('swarm.subtask_completed', {
          missionId,
          subtask: st
        });
      }

      if (pendingSubtasks.length > 0) {
        await pool.query(
          `UPDATE swarm_missions SET subtasks_json = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [JSON.stringify(subtasks), missionId]
        );
      }

      // Check if any subtask failed
      const hasFailures = subtasks.some(st => st.status === 'FAILED');
      const missionStatus: SwarmMissionStatus = hasFailures ? 'FAILED' : 'COMPLETED';

      // Final Synthesis generation
      const totalDuration = Date.now() - startTime;
      const completedTasks = subtasks.filter(st => st.status === 'COMPLETED');

      let finalSynthesis = `# Laporan Eksekutif Swarm Mission: ${title}\n\n`;
      finalSynthesis += `**Status Misi:** ${missionStatus} | **Total Durasi:** ${(totalDuration / 1000).toFixed(1)} detik | **Subtugas Selesai:** ${completedTasks.length}/${subtasks.length}\n\n`;
      finalSynthesis += `### Objektif Misi:\n> ${objective}\n\n`;
      finalSynthesis += `### Rangkuman Hasil Koordinasi Multi-Agent (DAG Mesh):\n`;

      for (const st of subtasks) {
        finalSynthesis += `\n#### ✦ [${st.title}] — Agen: ${st.assignedAgentName || 'Spesialis'} (${st.status})\n`;
        if (st.status === 'COMPLETED' && st.outputResult) {
          const excerpt = st.outputResult.length > 500 ? `${st.outputResult.slice(0, 500)}...\n*(Laporan lengkap tersimpan)*` : st.outputResult;
          finalSynthesis += `${excerpt}\n`;
        } else if (st.error) {
          finalSynthesis += `*Catatan Kendala:* ${st.error}\n`;
        }
      }

      finalSynthesis += `\n---\n*Sintesis ini dibuat secara otonom oleh Lead Coordinator Agent AI Agent Command Center.*`;

      // Log SYNTHESIS message
      const synthMsgId = `msg-${uuidv4().slice(0, 8)}`;
      await pool.query(
        `INSERT INTO swarm_messages (
          id, mission_id, from_agent_id, to_agent_id, message_type, content, metadata_json, created_at
        ) VALUES ($1, $2, $3, NULL, 'SYNTHESIS', $4, $5, CURRENT_TIMESTAMP)`,
        [
          synthMsgId,
          missionId,
          coordinatorAgentId || null,
          `Sintesis akhir misi swarm selesai disusun. Evaluasi mencakup ${completedTasks.length} dari ${subtasks.length} subtugas.`,
          JSON.stringify({ status: missionStatus, durationMs: totalDuration })
        ]
      );

      // Final database update
      await pool.query(
        `UPDATE swarm_missions
         SET status = $1, final_synthesis = $2, total_duration_ms = $3, subtasks_json = $4, updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [missionStatus, finalSynthesis, totalDuration, JSON.stringify(subtasks), missionId]
      );

      realtimeHub.broadcast('swarm.mission_completed', {
        missionId,
        status: missionStatus,
        totalDurationMs: totalDuration,
        finalSynthesis
      });

      // Dispatch Outbound Webhook Alert
      import('./alertingService.js').then(({ AlertingService }) => {
        AlertingService.dispatchAlert({
          event: 'SWARM_COMPLETED',
          title: `Autonomous Swarm Mission ${missionStatus === 'COMPLETED' ? 'Selesai' : 'Gagal'}: ${title}`,
          message: `Misi swarm "${title}" berakhir dengan status ${missionStatus}. Subtugas selesai: ${completedTasks.length}/${subtasks.length} dalam ${(totalDuration / 1000).toFixed(1)}s.`,
          severity: missionStatus === 'COMPLETED' ? 'INFO' : 'WARNING',
          metadata: {
            mission_id: missionId,
            status: missionStatus,
            completed_tasks: completedTasks.length,
            total_tasks: subtasks.length,
            duration_ms: totalDuration
          }
        }, workspaceId).catch(() => {});
      }).catch(() => {});

      systemLogger.info('ORCHESTRATOR', `Misi Swarm [${missionId}] selesai dengan status ${missionStatus} (${(totalDuration / 1000).toFixed(1)}s)`);
    } catch (err: any) {
      const isAbort = signal.aborted || err.message?.includes('dibatalkan');
      const finalStatus = isAbort ? 'CANCELLED' : 'FAILED';

      await pool.query(
        `UPDATE swarm_missions SET status = $1, final_synthesis = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
        [finalStatus, `Misi dihentikan: ${err.message}`, missionId]
      );

      realtimeHub.broadcast('swarm.mission_completed', {
        missionId,
        status: finalStatus,
        error: err.message
      });
    } finally {
      this.activeMissions.delete(missionId);
    }
  }

  /**
   * Cancel an actively executing mission
   */
  static async cancelMission(missionId: string): Promise<boolean> {
    const active = this.activeMissions.get(missionId);
    if (active) {
      active.abortController.abort();
      this.activeMissions.delete(missionId);
    }

    const res = await pool.query(
      `UPDATE swarm_missions SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = 'EXECUTING'`,
      [missionId]
    );

    realtimeHub.broadcast('swarm.mission_cancelled', { missionId });
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Get mission details along with the full inter-agent chat stream
   */
  static async getMission(
    missionId: string
  ): Promise<{ mission: SwarmMission; messages: SwarmMessage[] }> {
    const missionRes = await pool.query(
      `SELECT m.*, a.name as coordinator_name
       FROM swarm_missions m
       LEFT JOIN ai_agents a ON m.coordinator_agent_id = a.id
       WHERE m.id = $1`,
      [missionId]
    );

    if (missionRes.rows.length === 0) {
      throw new Error(`Swarm mission dengan ID ${missionId} tidak ditemukan.`);
    }

    const m = missionRes.rows[0];
    const subtasks: SwarmSubtask[] = typeof m.subtasks_json === 'string'
      ? JSON.parse(m.subtasks_json)
      : (m.subtasks_json || []);

    const mission: SwarmMission = {
      id: m.id,
      workspaceId: m.workspace_id,
      title: m.title,
      objective: m.objective,
      status: m.status as SwarmMissionStatus,
      coordinatorAgentId: m.coordinator_agent_id,
      coordinatorAgentName: m.coordinator_name || 'Coordinator Lead',
      subtasks,
      finalSynthesis: m.final_synthesis,
      totalDurationMs: m.total_duration_ms || 0,
      totalTokens: m.total_tokens || 0,
      createdAt: m.created_at,
      updatedAt: m.updated_at
    };

    const msgRes = await pool.query(
      `SELECT msg.*,
              fa.name as from_agent_name,
              ta.name as to_agent_name
       FROM swarm_messages msg
       LEFT JOIN ai_agents fa ON msg.from_agent_id = fa.id
       LEFT JOIN ai_agents ta ON msg.to_agent_id = ta.id
       WHERE msg.mission_id = $1
       ORDER BY msg.created_at ASC`,
      [missionId]
    );

    const messages: SwarmMessage[] = msgRes.rows.map(r => ({
      id: r.id,
      missionId: r.mission_id,
      fromAgentId: r.from_agent_id,
      fromAgentName: r.from_agent_name,
      toAgentId: r.to_agent_id,
      toAgentName: r.to_agent_name,
      messageType: r.message_type,
      content: r.content,
      metadata: typeof r.metadata_json === 'string' ? JSON.parse(r.metadata_json) : (r.metadata_json || {}),
      createdAt: r.created_at
    }));

    return { mission, messages };
  }

  /**
   * List recent swarm missions
   */
  static async listMissions(
    workspaceId: string = 'ws-default-command-center',
    limit: number = 20
  ): Promise<SwarmMission[]> {
    const res = await pool.query(
      `SELECT m.*, a.name as coordinator_name
       FROM swarm_missions m
       LEFT JOIN ai_agents a ON m.coordinator_agent_id = a.id
       WHERE m.workspace_id = $1
       ORDER BY m.created_at DESC
       LIMIT $2`,
      [workspaceId, limit]
    );

    return res.rows.map(m => {
      const subtasks: SwarmSubtask[] = typeof m.subtasks_json === 'string'
        ? JSON.parse(m.subtasks_json)
        : (m.subtasks_json || []);

      return {
        id: m.id,
        workspaceId: m.workspace_id,
        title: m.title,
        objective: m.objective,
        status: m.status as SwarmMissionStatus,
        coordinatorAgentId: m.coordinator_agent_id,
        coordinatorAgentName: m.coordinator_name || 'Coordinator Lead',
        subtasks,
        finalSynthesis: m.final_synthesis,
        totalDurationMs: m.total_duration_ms || 0,
        totalTokens: m.total_tokens || 0,
        createdAt: m.created_at,
        updatedAt: m.updated_at
      };
    });
  }

  /**
   * Safe recovery for in-flight swarm missions if the server process restarts
   */
  static async recoverInterruptedMissions(): Promise<number> {
    try {
      const res = await pool.query(
        `SELECT id, title, subtasks_json FROM swarm_missions WHERE status = 'EXECUTING'`
      );

      if (res.rows.length === 0) return 0;

      for (const row of res.rows) {
        const subtasks: SwarmSubtask[] = typeof row.subtasks_json === 'string'
          ? JSON.parse(row.subtasks_json)
          : (row.subtasks_json || []);

        for (const st of subtasks) {
          if (st.status === 'RUNNING') {
            st.status = 'PENDING';
            st.error = 'Status subtugas dipulihkan ke PENDING setelah restart server.';
          }
        }

        await pool.query(
          `UPDATE swarm_missions
           SET status = 'CANCELLED',
               final_synthesis = 'Misi dijeda otomatis saat restart server. Semua progres tersimpan dan dapat dilanjutkan (Resume).',
               subtasks_json = $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [JSON.stringify(subtasks), row.id]
        );

        systemLogger.info('ORCHESTRATOR', `[Crash Recovery] Misi Swarm [${row.id}] dipulihkan ke status aman.`);
      }

      return res.rows.length;
    } catch (err: any) {
      systemLogger.warn('ORCHESTRATOR', `Gagal memulihkan misi terinterupsi: ${err.message}`);
      return 0;
    }
  }

  /**
   * Resume an interrupted or paused swarm mission from its latest checkpoint
   */
  static async resumeMission(missionId: string): Promise<SwarmMission> {
    const { mission } = await this.getMission(missionId);

    if (mission.status === 'COMPLETED') {
      throw new Error('Misi ini telah selesai.');
    }

    const abortController = new AbortController();
    this.activeMissions.set(missionId, { missionId, abortController });

    await pool.query(
      `UPDATE swarm_missions SET status = 'EXECUTING', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [missionId]
    );

    mission.status = 'EXECUTING';
    realtimeHub.broadcast('swarm.mission_started', { mission });

    // Continue background DAG execution
    this.executeSwarmDAG(
      missionId,
      mission.workspaceId,
      mission.title,
      mission.objective,
      mission.coordinatorAgentId,
      mission.subtasks,
      abortController.signal
    ).catch(err => {
      systemLogger.error('ORCHESTRATOR', `Gagal melanjutkan Swarm DAG [${missionId}]: ${err.message}`);
    });

    return mission;
  }
}

