/**
 * Projects API Routes — AI Agent Command Center
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { Project } from '../../../shared/types.js';
import { realtimeHub } from '../services/realtime.js';

const router = Router();

// GET /api/projects — List all projects with live task progress computation
router.get('/', async (req: Request, res: Response) => {
  try {
    const wsId = (req.headers['x-workspace-id'] || req.query.workspaceId || '').toString().trim();
    const result = await pool.query(`
      SELECT 
        p.id, p.workspace_id, p.name, p.description, p.status, p.due_date, p.created_at, p.updated_at,
        COUNT(t.id)::int as total_tasks,
        COUNT(CASE WHEN t.status = 'DONE' THEN 1 END)::int as completed_tasks
      FROM projects p
      LEFT JOIN tasks t ON p.id = t.project_id
      WHERE ($1 = '' OR p.workspace_id = $1)
      GROUP BY p.id
      ORDER BY p.created_at DESC;
    `, [wsId]);

    const projects: (Project & { totalTasks: number; completedTasks: number })[] = result.rows.map(row => {
      const total = row.total_tasks || 0;
      const completed = row.completed_tasks || 0;
      const computedProgress = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        id: row.id,
        workspaceId: row.workspace_id,
        name: row.name,
        description: row.description,
        status: row.status,
        progressPercentage: computedProgress,
        dueDate: row.due_date,
        totalTasks: total,
        completedTasks: completed,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    });

    res.json(projects);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// GET /api/projects/:id — Get single project with all its tasks
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const projRes = await pool.query(`
      SELECT id, workspace_id, name, description, status, due_date, created_at, updated_at
      FROM projects
      WHERE id = $1;
    `, [req.params.id]);

    if (projRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Proyek tidak ditemukan.' } });
    }

    const row = projRes.rows[0];

    // Fetch tasks linked to this project
    const tasksRes = await pool.query(`
      SELECT 
        t.id, t.workspace_id, t.project_id, t.title, t.description,
        t.status, t.priority, t.assigned_agent_id, t.due_date,
        t.completed_at, t.created_at, t.updated_at,
        a.name as assigned_agent_name
      FROM tasks t
      LEFT JOIN ai_agents a ON t.assigned_agent_id = a.id
      WHERE t.project_id = $1
      ORDER BY t.created_at DESC;
    `, [req.params.id]);

    const totalTasks = tasksRes.rows.length;
    const completedTasks = tasksRes.rows.filter((t: any) => t.status === 'DONE').length;
    const computedProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    res.json({
      project: {
        id: row.id,
        workspaceId: row.workspace_id,
        name: row.name,
        description: row.description,
        status: row.status,
        progressPercentage: computedProgress,
        dueDate: row.due_date,
        totalTasks,
        completedTasks,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      },
      tasks: tasksRes.rows
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/projects — Create new project
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, dueDate, status = 'ACTIVE' } = req.body;
    const wsId = (req.headers['x-workspace-id'] || req.body?.workspaceId || 'ws-default-command-center').toString().trim();
    if (!name) {
      return res.status(400).json({ error: { message: 'Nama proyek wajib diisi.' } });
    }

    const projId = `proj-${uuidv4().slice(0, 8)}`;
    await pool.query(`
      INSERT INTO projects (id, workspace_id, name, description, status, progress_percentage, due_date)
      VALUES ($1, $2, $3, $4, $5, 0, $6);
    `, [projId, wsId, name, description || null, status, dueDate || null]);

    // Record activity
    await pool.query(`
      INSERT INTO activities (id, workspace_id, actor_type, actor_id, actor_name, event_type, summary, target_type, target_id)
      VALUES ($1, $2, 'USER', 'user-admin', 'Lead Operator', 'project.created', $3, 'PROJECT', $4);
    `, [`act-${uuidv4().slice(0, 8)}`, wsId, `Proyek baru dibuat: ${name}`, projId]);

    realtimeHub.broadcast('project.created', { id: projId, name });
    realtimeHub.broadcast('activity.created', { actorName: 'Lead Operator', summary: `Proyek baru dibuat: ${name}` });

    res.status(201).json({ id: projId, message: 'Proyek berhasil dibuat.' });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// PATCH /api/projects/:id — Update project details
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { name, description, status, dueDate, progressPercentage } = req.body;
    const projRes = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
    if (projRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Proyek tidak ditemukan.' } });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (name !== undefined) { updates.push(`name = $${idx++}`); values.push(name); }
    if (description !== undefined) { updates.push(`description = $${idx++}`); values.push(description); }
    if (status !== undefined) { updates.push(`status = $${idx++}`); values.push(status); }
    if (dueDate !== undefined) { updates.push(`due_date = $${idx++}`); values.push(dueDate || null); }
    if (progressPercentage !== undefined) { updates.push(`progress_percentage = $${idx++}`); values.push(progressPercentage); }

    if (updates.length === 0) {
      return res.status(400).json({ error: { message: 'Tidak ada field yang diperbarui.' } });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(req.params.id);

    const query = `
      UPDATE projects 
      SET ${updates.join(', ')} 
      WHERE id = $${idx}
      RETURNING *;
    `;

    const updatedRes = await pool.query(query, values);
    realtimeHub.broadcast('project.updated', { projectId: req.params.id });

    res.json(updatedRes.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// DELETE /api/projects/:id — Delete project
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const projRes = await pool.query('DELETE FROM projects WHERE id = $1 RETURNING name', [req.params.id]);
    if (projRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Proyek tidak ditemukan.' } });
    }

    realtimeHub.broadcast('project.deleted', { projectId: req.params.id });
    res.json({ success: true, message: `Proyek "${projRes.rows[0].name}" berhasil dihapus.` });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

export default router;
