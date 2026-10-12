/**
 * Multi-Agent Workflow Pipeline API — AI Agent Command Center
 * Supports Swarm Decomposition, Sequential Stage Execution, and Inter-Agent Data Handoff.
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';
import { executeAgentTask } from '../services/orchestrator.js';
import { realtimeHub } from '../services/realtime.js';
import { systemLogger } from '../services/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { PipelineTemplate, PipelineExecutionResult, PipelineStageExecution } from '../../../shared/types.js';

export const pipelineRouter = Router();

const PIPELINE_TEMPLATES: PipelineTemplate[] = [
  {
    id: 'feature-swarm',
    name: 'Full-Stack Feature Swarm',
    description: 'Pipeline 3-tahap: Arsitektur Sistem ➔ Implementasi Kode ➔ Audit Keamanan & QA.',
    stages: [
      {
        id: 'stage-arch',
        name: 'Arsitektur & Spesifikasi API',
        role: 'Planner',
        stagePromptTemplate: 'Berdasarkan tujuan berikut, rancang arsitektur teknis, kontrak API, dan struktur basis data yang solid:\n\n{objective}'
      },
      {
        id: 'stage-dev',
        name: 'Implementasi Rekayasa Perangkat Lunak',
        role: 'Executor',
        stagePromptTemplate: 'Implementasikan kode bersih, modular, dan efisien berdasarkan arsitektur yang dirancang pada tahap sebelumnya:\n\n{previous_output}'
      },
      {
        id: 'stage-qa',
        name: 'Quality Assurance & Security Review',
        role: 'QA / Reviewer',
        stagePromptTemplate: 'Lakukan audit keamanan, uji batas tepi (edge cases), dan verifikasi fungsionalitas terhadap implementasi berikut:\n\n{previous_output}'
      }
    ]
  },
  {
    id: 'bugfix-swarm',
    name: 'Root Cause & Patch Swarm',
    description: 'Pipeline investigasi masalah: Analisis Akar Masalah ➔ Pembuatan Patch ➔ Pengujian Regresi.',
    stages: [
      {
        id: 'stage-diag',
        name: 'Investigasi & Analisis Akar Masalah',
        role: 'Planner',
        stagePromptTemplate: 'Identifikasi akar penyebab bug, analisis alur error, dan buat skenario reproduksi untuk insiden berikut:\n\n{objective}'
      },
      {
        id: 'stage-patch',
        name: 'Pembuatan Patch & Hotfix',
        role: 'Executor',
        stagePromptTemplate: 'Buat patch kode dan mitigasi bug berdasarkan hasil diagnosis akar masalah berikut:\n\n{previous_output}'
      },
      {
        id: 'stage-verif',
        name: 'Verifikasi & Pengujian Regresi',
        role: 'QA / Reviewer',
        stagePromptTemplate: 'Verifikasi integritas patch, uji kemungkinan efek samping regresi, dan validasi perbaikan:\n\n{previous_output}'
      }
    ]
  },
  {
    id: 'security-audit-swarm',
    name: 'Security & Compliance Swarm',
    description: 'Pipeline keamanan menyeluruh: Pemodelan Ancaman ➔ Hardening Sistem ➔ Sertifikasi Kepatuhan.',
    stages: [
      {
        id: 'stage-threat',
        name: 'Pemodelan Ancaman & Audit Kerentanan',
        role: 'Domain Specialist',
        stagePromptTemplate: 'Analisis potensi vektor serangan (OWASP Top 10, SSRF, injection) dan pemodelan ancaman untuk target berikut:\n\n{objective}'
      },
      {
        id: 'stage-hardening',
        name: 'Implementasi Remediasi & Hardening',
        role: 'Executor',
        stagePromptTemplate: 'Rancang konfigurasi pertahanan berlapis dan mekanisme sanitasi data sesuai audit ancaman berikut:\n\n{previous_output}'
      },
      {
        id: 'stage-signoff',
        name: 'Verifikasi Kepatuhan & Sign-off',
        role: 'QA / Reviewer',
        stagePromptTemplate: 'Verifikasi kepatuhan terhadap standar keamanan dan buat laporan eksekutif rekomendasi:\n\n{previous_output}'
      }
    ]
  }
];

// GET /api/pipeline/templates — List all Swarm Templates
pipelineRouter.get('/templates', (req: Request, res: Response) => {
  res.json({
    templates: PIPELINE_TEMPLATES
  });
});

// POST /api/pipeline/decompose — Auto-match agents to stages for an objective
pipelineRouter.post('/decompose', async (req: Request, res: Response) => {
  try {
    const { title, objective, templateId = 'feature-swarm', projectId } = req.body;

    if (!objective || typeof objective !== 'string' || !objective.trim()) {
      return res.status(400).json({ error: 'Objektif atau tujuan pipeline wajib diisi.' });
    }

    const template = PIPELINE_TEMPLATES.find((t) => t.id === templateId) || PIPELINE_TEMPLATES[0];

    // Fetch active agents
    const agentsRes = await pool.query(`
      SELECT id, name, role, model_id, status, enabled 
      FROM ai_agents 
      WHERE enabled = TRUE 
      ORDER BY created_at ASC;
    `);

    const allAgents = agentsRes.rows;
    if (allAgents.length === 0) {
      return res.status(400).json({ error: 'Tidak ada AI Agent aktif yang terdaftar di sistem.' });
    }

    // Match each stage to the best agent by role, or fallback to first available
    const stages = template.stages.map((stageTemplate, idx) => {
      let matchedAgent = allAgents.find((a) => a.role === stageTemplate.role);
      if (!matchedAgent) {
        // Fallback: cycle through available agents
        matchedAgent = allAgents[idx % allAgents.length];
      }

      return {
        stageId: stageTemplate.id,
        stageName: stageTemplate.name,
        agentId: matchedAgent.id,
        agentName: matchedAgent.name,
        role: stageTemplate.role,
        status: 'PENDING',
        promptTemplate: stageTemplate.stagePromptTemplate
      };
    });

    res.json({
      pipelineId: `pipe-${uuidv4().slice(0, 8)}`,
      title: title || `Swarm: ${objective.slice(0, 40)}...`,
      objective,
      templateId: template.id,
      templateName: template.name,
      projectId: projectId || null,
      stages
    });
  } catch (err: any) {
    systemLogger.error('ORCHESTRATOR', `Gagal mendekomposisi swarm pipeline: ${err.message}`);
    res.status(500).json({ error: 'Gagal mendekomposisi pipeline.' });
  }
});

// POST /api/pipeline/execute — Execute Multi-Stage Swarm Sequentially
pipelineRouter.post('/execute', async (req: Request, res: Response) => {
  const { title, objective, projectId, stages } = req.body;

  if (!objective || !Array.isArray(stages) || stages.length === 0) {
    return res.status(400).json({ error: 'Parameter objective dan stages array wajib disediakan.' });
  }

  const pipelineId = `pipe-${uuidv4().slice(0, 8)}`;
  const masterTaskId = `task-${uuidv4().slice(0, 8)}`;
  const masterTitle = title || `[SWARM] ${objective.slice(0, 50)}`;

  try {
    // 1. Create master task in DB
    await pool.query(`
      INSERT INTO tasks (
        id, workspace_id, project_id, title, description, status, priority, created_at, updated_at
      ) VALUES ($1, 'ws-default-command-center', $2, $3, $4, 'IN_PROGRESS', 'HIGH', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    `, [masterTaskId, projectId || null, masterTitle, `Pipeline Swarm Execution: ${objective}`]);

    realtimeHub.broadcast('task.created', { taskId: masterTaskId });

    systemLogger.info('ORCHESTRATOR', `Memulai eksekusi Swarm Pipeline "${masterTitle}" (${stages.length} tahap).`, {
      pipelineId,
      masterTaskId
    });

    const startTime = Date.now();
    const executedStages: PipelineStageExecution[] = [];
    let previousOutput = '';
    let overallSuccess = true;

    for (let i = 0; i < stages.length; i++) {
      const stageConfig = stages[i];
      const stagePrompt = stageConfig.promptTemplate
        ? stageConfig.promptTemplate
            .replace('{objective}', objective)
            .replace('{previous_output}', previousOutput || objective)
        : `Lanjutkan tahap ${stageConfig.stageName} untuk tujuan: ${objective}\n\nKeluaran sebelumnya:\n${previousOutput || 'Mulai tahap inisial'}`;

      const stageExec: PipelineStageExecution = {
        stageId: stageConfig.stageId || `stage-${i + 1}`,
        stageName: stageConfig.stageName || `Tahap ${i + 1}`,
        agentId: stageConfig.agentId,
        agentName: stageConfig.agentName || 'AI Agent',
        status: 'RUNNING',
        prompt: stagePrompt
      };

      realtimeHub.broadcast('pipeline.stage_started', {
        pipelineId,
        stageIndex: i,
        stage: stageExec
      });

      const stageStart = Date.now();

      try {
        const runResult = await executeAgentTask(stageConfig.agentId, stagePrompt, masterTaskId);
        const stageDuration = Date.now() - stageStart;

        stageExec.status = runResult.status === 'SUCCEEDED' ? 'COMPLETED' : 'FAILED';
        stageExec.output = runResult.outputResult || '(Tidak ada output)';
        stageExec.durationMs = stageDuration;
        stageExec.tokensUsed = runResult.tokensUsed?.totalTokens || 0;

        previousOutput = stageExec.output;

        if (runResult.status !== 'SUCCEEDED') {
          overallSuccess = false;
        }

        realtimeHub.broadcast('pipeline.stage_completed', {
          pipelineId,
          stageIndex: i,
          stage: stageExec
        });
      } catch (err: any) {
        stageExec.status = 'FAILED';
        stageExec.error = err.message;
        stageExec.durationMs = Date.now() - stageStart;
        overallSuccess = false;

        realtimeHub.broadcast('pipeline.stage_completed', {
          pipelineId,
          stageIndex: i,
          stage: stageExec
        });

        // Handoff error message to next stage or halt
        previousOutput = `Tahap ${stageExec.stageName} mengalami kegagalan: ${err.message}`;
      }

      executedStages.push(stageExec);
    }

    const totalDurationMs = Date.now() - startTime;
    const finalTaskStatus = overallSuccess ? 'DONE' : 'TODO';

    // Update master task
    await pool.query(`
      UPDATE tasks 
      SET status = $1, completed_at = ${overallSuccess ? 'CURRENT_TIMESTAMP' : 'NULL'}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2;
    `, [finalTaskStatus, masterTaskId]);

    realtimeHub.broadcast('task.updated', { taskId: masterTaskId, status: finalTaskStatus });

    const finalSummary = `### Ringkasan Eksekusi Swarm Pipeline\n\n` +
      `- **Tujuan:** ${objective}\n` +
      `- **Status Akhir:** ${overallSuccess ? 'BERHASIL PENUH' : 'SEBAGIAN / TERKENDALA'}\n` +
      `- **Total Durasi:** ${totalDurationMs}ms\n` +
      `- **Total Tahapan:** ${executedStages.length} tahap kolaborasi\n\n` +
      executedStages.map((s, idx) => `#### Tahap ${idx + 1}: ${s.stageName} (${s.agentName})\n- **Status:** ${s.status}\n- **Durasi:** ${s.durationMs}ms\n\n\`\`\`\n${s.output || s.error || 'N/A'}\n\`\`\``).join('\n\n');

    const result: PipelineExecutionResult = {
      pipelineId,
      masterTaskId,
      title: masterTitle,
      objective,
      status: overallSuccess ? 'SUCCESS' : (executedStages.some(s => s.status === 'COMPLETED') ? 'PARTIAL' : 'FAILED'),
      totalDurationMs,
      stages: executedStages,
      finalSummary
    };

    realtimeHub.broadcast('pipeline.completed', result);

    systemLogger.info('ORCHESTRATOR', `Swarm Pipeline "${masterTitle}" selesai dalam ${totalDurationMs}ms (${result.status}).`, {
      pipelineId,
      masterTaskId,
      status: result.status
    });

    res.json(result);
  } catch (err: any) {
    systemLogger.error('ORCHESTRATOR', `Eksekusi swarm pipeline gagal: ${err.message}`);
    res.status(500).json({ error: err.message || 'Gagal mengeksekusi pipeline.' });
  }
});
