/**
 * External Webhook Ingestion API — AI Agent Command Center
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';
import { realtimeHub } from '../services/realtime.js';
import { executeAgentTask } from '../services/orchestrator.js';
import { systemLogger } from '../services/logger.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/webhooks/info — Get webhook usage documentation & endpoints
router.get('/info', (_req: Request, res: Response) => {
  res.json({
    status: 'ACTIVE',
    endpoints: {
      dispatchTask: {
        method: 'POST',
        path: '/api/webhooks/dispatch-task',
        description: 'Memicu pembuatan dan eksekusi tugas AI dari CI/CD, GitHub, Slack, atau sistem eksternal.',
        examplePayload: {
          title: 'Review Pull Request #42: Feature Authentication',
          description: 'Analisis potensi celah keamanan dan konsistensi arsitektur kode.',
          priority: 'HIGH',
          agentRole: 'QA / Reviewer',
          autoExecute: true
        }
      }
    }
  });
});

// POST /api/webhooks/dispatch-task — Ingest and dispatch task from external triggers
router.post('/dispatch-task', async (req: Request, res: Response) => {
  try {
    const { title, description, priority = 'MEDIUM', agentRole, projectId, autoExecute = true } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: { message: 'Judul tugas (title) wajib disertakan.' } });
    }

    const taskId = `task-ext-${uuidv4().slice(0, 8)}`;
    const workspaceId = 'ws-default-command-center';

    // 1. Resolve agent assignment if agentRole specified or auto-assign
    let assignedAgentId: string | null = null;
    let assignedAgentName: string | null = null;

    if (agentRole) {
      const agentRes = await pool.query(
        'SELECT id, name FROM ai_agents WHERE role = $1 AND enabled = TRUE LIMIT 1',
        [agentRole]
      );
      if (agentRes.rows.length > 0) {
        assignedAgentId = agentRes.rows[0].id;
        assignedAgentName = agentRes.rows[0].name;
      }
    }

    if (!assignedAgentId) {
      const fallbackRes = await pool.query(
        'SELECT id, name FROM ai_agents WHERE enabled = TRUE ORDER BY created_at ASC LIMIT 1'
      );
      if (fallbackRes.rows.length > 0) {
        assignedAgentId = fallbackRes.rows[0].id;
        assignedAgentName = fallbackRes.rows[0].name;
      }
    }

    // 2. Insert Task record
    await pool.query(
      `INSERT INTO tasks (
        id, workspace_id, project_id, title, description, status, priority, assigned_agent_id
      ) VALUES ($1, $2, $3, $4, $5, 'TODO', $6, $7)`,
      [
        taskId,
        workspaceId,
        projectId || null,
        title.trim(),
        description ? description.trim() : 'Dipicu via Webhook Eksternal',
        priority,
        assignedAgentId
      ]
    );

    // Record activity
    await pool.query(
      `INSERT INTO activities (id, workspace_id, actor_type, actor_name, event_type, summary, target_type, target_id)
       VALUES ($1, $2, 'SYSTEM', 'Webhook Dispatcher', 'task.dispatched', $3, 'TASK', $4)`,
      [
        `act-${uuidv4().slice(0, 8)}`,
        workspaceId,
        `Tugas baru dipicu via Webhook: "${title}"`,
        taskId
      ]
    );

    systemLogger.info('SYSTEM', `Webhook trigger menerima tugas baru: "${title}" (ID: ${taskId})`, {
      taskId,
      assignedAgentId,
      autoExecute
    });

    realtimeHub.broadcast('task.created', { id: taskId, title, status: 'TODO' });

    // 3. If autoExecute requested and agent is available, fire execution asynchronously
    if (autoExecute && assignedAgentId) {
      executeAgentTask(
        assignedAgentId,
        description || title,
        taskId
      ).catch((err) => {
        systemLogger.error('ORCHESTRATOR', `Error eksekusi otomatis task via webhook: ${err.message}`);
      });
    }

    res.json({
      success: true,
      message: 'Tugas eksternal berhasil diterima dan dimasukkan ke dalam antrean orkestrasi.',
      taskId,
      assignedAgent: assignedAgentName ? { id: assignedAgentId, name: assignedAgentName } : null,
      autoExecuteTriggered: Boolean(autoExecute && assignedAgentId)
    });
  } catch (err: any) {
    systemLogger.error('API', `Webhook dispatch error: ${err.message}`);
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/webhooks/github — Dedicated GitHub Pull Request & Push Event Ingestion
router.post('/github', async (req: Request, res: Response) => {
  try {
    const event = req.headers['x-github-event'] as string;
    const body = req.body || {};

    // Ping event
    if (event === 'ping') {
      return res.json({
        success: true,
        message: 'Pong! Webhook GitHub ID-Tech terhubung dengan sempurna.',
        zen: body.zen || 'Responsiveness is key.'
      });
    }

    // Pull Request event
    if (event === 'pull_request') {
      const action = body.action; // opened, synchronize, reopened
      const pr = body.pull_request;
      const repo = body.repository;

      if (!pr || !repo) {
        return res.status(400).json({ error: 'Payload pull_request tidak valid.' });
      }

      const taskId = `task-gh-${uuidv4().slice(0, 8)}`;
      const workspaceId = 'ws-default-command-center';
      const taskTitle = `[GitHub PR #${pr.number}] ${repo.name}: ${pr.title}`;
      const taskDesc = `Otomatis dipicu dari GitHub Webhook.
Repositori: ${repo.full_name}
PR #${pr.number} (${action}) oleh @${pr.user?.login || 'unknown'}
URL: ${pr.html_url}
Commit: ${pr.head?.sha?.slice(0, 7) || 'HEAD'}

Misi: Lakukan review kode, analisis AST, dan audit keamanan OWASP terhadap diff PR ini.`;

      // Assign to QA / Reviewer agent
      let reviewerRes = await pool.query(
        "SELECT id, name FROM ai_agents WHERE role ILIKE '%Reviewer%' AND enabled = TRUE LIMIT 1"
      );
      if (reviewerRes.rows.length === 0) {
        reviewerRes = await pool.query(
          'SELECT id, name FROM ai_agents WHERE enabled = TRUE ORDER BY created_at ASC LIMIT 1'
        );
      }

      const agentId = reviewerRes.rows[0]?.id || null;

      await pool.query(
        `INSERT INTO tasks (
          id, workspace_id, title, description, status, priority, assigned_agent_id
        ) VALUES ($1, $2, $3, $4, 'TODO', 'HIGH', $5)`,
        [taskId, workspaceId, taskTitle, taskDesc, agentId]
      );

      await pool.query(
        `INSERT INTO activities (id, workspace_id, actor_type, actor_name, event_type, summary, target_type, target_id)
         VALUES ($1, $2, 'SYSTEM', 'GitHub Webhook Bot', 'github.pr.audit', $3, 'TASK', $4)`,
        [
          `act-${uuidv4().slice(0, 8)}`,
          workspaceId,
          `GitHub PR #${pr.number} audit dimulai untuk ${repo.full_name}`,
          taskId
        ]
      );

      systemLogger.info('SYSTEM', `GitHub Webhook: PR #${pr.number} tugas audit dibuat (ID: ${taskId})`);
      realtimeHub.broadcast('task.created', { id: taskId, title: taskTitle, status: 'TODO' });

      // Auto execute asynchronously
      if (agentId) {
        executeAgentTask(agentId, taskDesc, taskId).catch((err) => {
          systemLogger.error('ORCHESTRATOR', `Error executing GitHub PR task: ${err.message}`);
        });
      }

      return res.json({
        success: true,
        message: `Audit PR #${pr.number} berhasil dijadwalkan ke swarm.`,
        taskId,
        prNumber: pr.number,
        repository: repo.full_name,
        action
      });
    }

    // Push event
    if (event === 'push') {
      const repo = body.repository?.full_name || 'unknown/repo';
      const ref = body.ref || 'refs/heads/main';
      const commitCount = body.commits?.length || 0;

      return res.json({
        success: true,
        message: `Push event diterima (${commitCount} commit di ${ref}) untuk ${repo}. Swarm siap memantau.`
      });
    }

    res.json({
      success: true,
      message: `Event GitHub [${event}] diterima tanpa aksi khusus.`
    });
  } catch (err: any) {
    systemLogger.error('API', `GitHub webhook handler error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/webhooks/test-github — Simulate a GitHub PR event from the UI
router.post('/test-github', async (_req: Request, res: Response) => {
  try {
    const taskId = `task-gh-test-${uuidv4().slice(0, 6)}`;
    const workspaceId = 'ws-default-command-center';
    const taskTitle = '[GitHub PR #42 Demo] Checkout API: Concurrency & Lock Refactor';
    const taskDesc = `Simulasi Webhook GitHub Terverifikasi.
Repositori: id-tech-org/core-backend
PR #42 (opened) oleh @lead-engineer
Misi: Review otomatis race condition locking dan uji OWASP Top 10.`;

    const reviewerRes = await pool.query(
      'SELECT id, name FROM ai_agents WHERE enabled = TRUE ORDER BY created_at ASC LIMIT 1'
    );
    const agentId = reviewerRes.rows[0]?.id || null;

    await pool.query(
      `INSERT INTO tasks (
        id, workspace_id, title, description, status, priority, assigned_agent_id
      ) VALUES ($1, $2, $3, $4, 'TODO', 'HIGH', $5)`,
      [taskId, workspaceId, taskTitle, taskDesc, agentId]
    );

    realtimeHub.broadcast('task.created', { id: taskId, title: taskTitle, status: 'TODO' });

    res.json({
      success: true,
      message: 'Uji konektivitas GitHub Webhook sukses! Tugas audit simulasi telah dibuat di antrean tasks.',
      taskId,
      testPrNumber: 42
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
