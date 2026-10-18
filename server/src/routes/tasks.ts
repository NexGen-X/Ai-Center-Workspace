/**
 * Tasks API Routes — AI Agent Command Center
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { Task, TaskStatus } from '../../../shared/types.js';
import { executeAgentTask } from '../services/orchestrator.js';
import { realtimeHub } from '../services/realtime.js';
import { SwarmService } from '../services/swarmService.js';

const router = Router();

// Permitted status transitions map
const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  TODO: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['IN_REVIEW', 'DONE', 'TODO', 'CANCELLED'],
  IN_REVIEW: ['DONE', 'IN_PROGRESS', 'CANCELLED'],
  DONE: ['TODO'], // reopen if needed
  CANCELLED: ['TODO']
};

// GET /api/tasks — List tasks
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, priority, projectId, search } = req.query;
    let query = `
      SELECT 
        t.id, t.workspace_id, t.project_id, t.title, t.description,
        t.status, t.priority, t.assigned_agent_id, t.due_date,
        t.completed_at, t.created_at, t.updated_at,
        a.name as assigned_agent_name,
        p.name as project_name
      FROM tasks t
      LEFT JOIN ai_agents a ON t.assigned_agent_id = a.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (status && status !== 'ALL') {
      query += ` AND t.status = $${idx++}`;
      params.push(status);
    }
    if (priority) {
      query += ` AND t.priority = $${idx++}`;
      params.push(priority);
    }
    if (projectId) {
      query += ` AND t.project_id = $${idx++}`;
      params.push(projectId);
    }
    if (search) {
      query += ` AND (t.title ILIKE $${idx} OR t.description ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    query += ` ORDER BY t.created_at DESC;`;

    const result = await pool.query(query, params);
    const tasks: (Task & { projectName?: string })[] = result.rows.map(row => ({
      id: row.id,
      workspaceId: row.workspace_id,
      projectId: row.project_id,
      projectName: row.project_name || undefined,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      assignedAgentId: row.assigned_agent_id,
      assignedAgentName: row.assigned_agent_name,
      dueDate: row.due_date,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    res.json(tasks);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// GET /api/tasks/:id — Get task details with latest runs & history
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const taskRes = await pool.query(`
      SELECT 
        t.id, t.workspace_id, t.project_id, t.title, t.description,
        t.status, t.priority, t.assigned_agent_id, t.due_date,
        t.completed_at, t.created_at, t.updated_at,
        a.name as assigned_agent_name,
        p.name as project_name
      FROM tasks t
      LEFT JOIN ai_agents a ON t.assigned_agent_id = a.id
      LEFT JOIN projects p ON t.project_id = p.id
      WHERE t.id = $1;
    `, [req.params.id]);

    if (taskRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Tugas tidak ditemukan.' } });
    }

    const row = taskRes.rows[0];

    // Fetch runs for this task
    const runsRes = await pool.query(`
      SELECT id, agent_id, model_id, status, input_prompt, output_result, duration_ms, tokens_total, created_at
      FROM agent_runs
      WHERE task_id = $1
      ORDER BY created_at DESC
      LIMIT 10;
    `, [req.params.id]);

    // Fetch history
    const histRes = await pool.query(`
      SELECT id, actor_type, actor_id, event_type, old_value, new_value, created_at
      FROM task_history
      WHERE task_id = $1
      ORDER BY created_at DESC
      LIMIT 20;
    `, [req.params.id]);

    res.json({
      task: {
        id: row.id,
        workspaceId: row.workspace_id,
        projectId: row.project_id,
        projectName: row.project_name || undefined,
        title: row.title,
        description: row.description,
        status: row.status,
        priority: row.priority,
        assignedAgentId: row.assigned_agent_id,
        assignedAgentName: row.assigned_agent_name,
        dueDate: row.due_date,
        completedAt: row.completed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      },
      runs: runsRes.rows,
      history: histRes.rows
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// GET /api/tasks/:id/history — Get task audit history
router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const histRes = await pool.query(`
      SELECT id, actor_type, actor_id, event_type, old_value, new_value, created_at
      FROM task_history
      WHERE task_id = $1
      ORDER BY created_at DESC;
    `, [req.params.id]);
    res.json(histRes.rows);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/tasks — Create task
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, description, priority, projectId, assignedAgentId, dueDate } = req.body;
    if (!title) {
      return res.status(400).json({ error: { message: 'Judul tugas (title) wajib diisi.' } });
    }

    const taskId = `task-${uuidv4().slice(0, 8)}`;
    await pool.query(`
      INSERT INTO tasks (
        id, workspace_id, project_id, title, description, status, priority, assigned_agent_id, due_date
      ) VALUES ($1, 'ws-default-command-center', $2, $3, $4, 'TODO', $5, $6, $7);
    `, [taskId, projectId || null, title, description || null, priority || 'MEDIUM', assignedAgentId || null, dueDate || null]);

    // Record activity
    await pool.query(`
      INSERT INTO activities (id, workspace_id, actor_type, actor_id, actor_name, event_type, summary, target_type, target_id)
      VALUES ($1, 'ws-default-command-center', 'USER', 'user-admin', 'Lead Operator', 'task.created', $2, 'TASK', $3);
    `, [`act-${uuidv4().slice(0, 8)}`, `Tugas baru dibuat: ${title}`, taskId]);

    realtimeHub.broadcast('task.created', { id: taskId, title, status: 'TODO' });
    realtimeHub.broadcast('activity.created', { actorName: 'Lead Operator', summary: `Tugas baru dibuat: ${title}` });

    res.status(201).json({ id: taskId, message: 'Tugas berhasil dibuat.' });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// PATCH /api/tasks/:id — Update task details
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { title, description, priority, projectId, assignedAgentId, dueDate } = req.body;
    const taskRes = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    if (taskRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Tugas tidak ditemukan.' } });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (title !== undefined) { updates.push(`title = $${idx++}`); values.push(title); }
    if (description !== undefined) { updates.push(`description = $${idx++}`); values.push(description); }
    if (priority !== undefined) { updates.push(`priority = $${idx++}`); values.push(priority); }
    if (projectId !== undefined) { updates.push(`project_id = $${idx++}`); values.push(projectId || null); }
    if (assignedAgentId !== undefined) { updates.push(`assigned_agent_id = $${idx++}`); values.push(assignedAgentId || null); }
    if (dueDate !== undefined) { updates.push(`due_date = $${idx++}`); values.push(dueDate || null); }

    if (updates.length === 0) {
      return res.status(400).json({ error: { message: 'Tidak ada field yang diperbarui.' } });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(req.params.id);

    const query = `
      UPDATE tasks 
      SET ${updates.join(', ')} 
      WHERE id = $${idx}
      RETURNING *;
    `;

    const updatedRes = await pool.query(query, values);

    // Record history
    await pool.query(`
      INSERT INTO task_history (id, task_id, actor_type, actor_id, event_type, old_value, new_value)
      VALUES ($1, $2, 'USER', 'user-admin', 'task_edited', NULL, 'Perubahan rincian tugas');
    `, [`hist-${uuidv4().slice(0, 8)}`, req.params.id]);

    realtimeHub.broadcast('task.updated', { taskId: req.params.id });

    res.json(updatedRes.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// DELETE /api/tasks/:id — Delete task
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const taskRes = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING title', [req.params.id]);
    if (taskRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Tugas tidak ditemukan.' } });
    }

    realtimeHub.broadcast('task.deleted', { taskId: req.params.id });
    res.json({ success: true, message: `Tugas "${taskRes.rows[0].title}" berhasil dihapus.` });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/tasks/:id/transitions — State machine transition
router.post('/:id/transitions', async (req: Request, res: Response) => {
  try {
    const { newStatus } = req.body as { newStatus: TaskStatus };
    if (!newStatus) {
      return res.status(400).json({ error: { message: 'newStatus wajib disertakan.' } });
    }

    const currentRes = await pool.query('SELECT status, title FROM tasks WHERE id = $1', [req.params.id]);
    if (currentRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Tugas tidak ditemukan.' } });
    }

    const currentStatus = currentRes.rows[0].status as TaskStatus;
    const title = currentRes.rows[0].title;
    const allowed = VALID_TRANSITIONS[currentStatus] || [];

    if (!allowed.includes(newStatus)) {
      return res.status(400).json({
        error: {
          message: `Transisi status ilegal: dari '${currentStatus}' ke '${newStatus}' tidak diizinkan. Transisi yang valid: [${allowed.join(', ')}]`
        }
      });
    }

    const completedClause = newStatus === 'DONE' ? ', completed_at = CURRENT_TIMESTAMP' : ', completed_at = NULL';
    await pool.query(`
      UPDATE tasks 
      SET status = $1, updated_at = CURRENT_TIMESTAMP ${completedClause}
      WHERE id = $2;
    `, [newStatus, req.params.id]);

    // Record history
    await pool.query(`
      INSERT INTO task_history (id, task_id, actor_type, actor_id, event_type, old_value, new_value)
      VALUES ($1, $2, 'USER', 'user-admin', 'status_changed', $3, $4);
    `, [`hist-${uuidv4().slice(0, 8)}`, req.params.id, currentStatus, newStatus]);

    realtimeHub.broadcast('task.updated', { taskId: req.params.id, status: newStatus });
    realtimeHub.broadcast('activity.created', {
      actorName: 'Lead Operator',
      summary: `Status tugas "${title}" diubah dari ${currentStatus} ke ${newStatus}`
    });

    res.json({ success: true, taskId: req.params.id, oldStatus: currentStatus, newStatus });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/tasks/polish-prompt — AI Prompt Polish & Structured Requirement Formulation
router.post('/polish-prompt', async (req: Request, res: Response) => {
  try {
    const { title, description } = req.body;
    if (!title && !description) {
      return res.status(400).json({ error: { message: 'Judul atau deskripsi tugas wajib diisi untuk disempurnakan.' } });
    }

    const agentRes = await pool.query(
      `SELECT id, name FROM ai_agents WHERE enabled = TRUE ORDER BY CASE WHEN role IN ('Planner', 'Orchestrator') THEN 0 ELSE 1 END, created_at ASC LIMIT 1`
    );

    if (agentRes.rows.length === 0) {
      return res.status(400).json({ error: { message: 'Tidak ada AI Agent aktif yang tersedia.' } });
    }

    const agent = agentRes.rows[0];
    const polishPrompt = `Anda bertindak sebagai Enterprise Requirement Engineer dan Technical Lead.
Tugas Anda adalah memformulasikan instruksi awal dari klien/pengguna berikut menjadi spesifikasi kebutuhan yang profesional, jelas, terstruktur, dan siap dieksekusi oleh tim AI spesialis.

[INSTRUKSI AWAL PENGGUNA]
Judul: ${title || '(Belum ditentukan)'}
Deskripsi Singkat: ${description || '(Belum ada detail tambahan)'}

Harap hasilkan deskripsi Markdown terstruktur dengan format berikut:
### 🎯 Objektif & Ruang Lingkup
[Uraian singkat tujuan utama dan batasan ruang lingkup]

### 📋 Spesifikasi & Kriteria Penerimaan
1. [Kriteria teknis atau fungsional 1]
2. [Kriteria teknis atau fungsional 2]
3. [Kriteria teknis atau fungsional 3]

### 📤 Deliverable yang Diharapkan
- [Format hasil keluaran yang harus diserahkan agen]

Tuliskan HANYA hasil format Markdown di atas tanpa kata pengantar tambahan.`;

    const runResult = await executeAgentTask(agent.id, polishPrompt);
    res.json({
      success: true,
      polishedDescription: runResult.outputResult || description
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/tasks/:id/execute — Trigger execution of task by assigned agent
router.post('/:id/execute', async (req: Request, res: Response) => {
  try {
    const taskRes = await pool.query('SELECT id, title, description, status, assigned_agent_id FROM tasks WHERE id = $1', [req.params.id]);
    if (taskRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Tugas tidak ditemukan.' } });
    }

    const task = taskRes.rows[0];
    if (task.status === 'IN_PROGRESS') {
      return res.status(409).json({ error: { message: 'Tugas ini sedang berjalan (IN_PROGRESS). Harap tunggu hingga selesai atau batalkan sebelum menjalankan ulang.' } });
    }

    const agentId = req.body.agentId || task.assigned_agent_id;
    if (!agentId) {
      return res.status(400).json({ error: { message: 'Tugas belum memiliki agent yang ditugaskan.' } });
    }

    const prompt = req.body.prompt || `Selesaikan tugas: ${task.title}\n\nDeskripsi: ${task.description || 'Tidak ada deskripsi spesifik.'}`;
    const runResult = await executeAgentTask(agentId, prompt, task.id);

    res.json(runResult);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/tasks/:id/auto-swarm — Convert task into full Autonomous Swarm Mission & DAG
router.post('/:id/auto-swarm', async (req: Request, res: Response) => {
  try {
    const taskRes = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    if (taskRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Tugas tidak ditemukan.' } });
    }
    const task = taskRes.rows[0];
    const objective = `${task.title}. ${task.description || ''}`.trim();

    const plan = await SwarmService.planMission(objective, task.workspace_id || 'ws-default-command-center');
    const mission = await SwarmService.dispatchMission({
      title: task.title,
      objective,
      workspaceId: task.workspace_id || 'ws-default-command-center',
      coordinatorAgentId: task.assigned_agent_id || undefined,
      subtasks: plan.subtasks
    });

    // Update task status to IN_PROGRESS and append note
    await pool.query(`
      UPDATE tasks 
      SET status = 'IN_PROGRESS', 
          description = COALESCE(description, '') || $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2;
    `, [`\n\n[TERHUBUNG KE SWARM MISSION]: ID ${mission.id} dengan ${mission.subtasks.length} subtugas kolaboratif.`, task.id]);

    realtimeHub.broadcast('task.updated', { taskId: task.id, status: 'IN_PROGRESS' });
    realtimeHub.broadcast('activity.created', {
      actorName: 'Swarm Orchestrator',
      summary: `Tugas "${task.title}" didekomposisi menjadi Swarm Mission (${mission.subtasks.length} subtugas)`
    });

    res.json({
      success: true,
      message: `Tugas "${task.title}" berhasil didekomposisi menjadi Swarm Mission dengan ${mission.subtasks.length} subtugas.`,
      mission
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

export default router;
