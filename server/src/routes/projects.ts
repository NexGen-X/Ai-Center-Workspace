/**
 * Projects API Routes — AI Agent Command Center
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { Project } from '../../../shared/types.js';

const router = Router();

// GET /api/projects
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT id, workspace_id, name, description, status, progress_percentage, due_date, created_at, updated_at
      FROM projects
      ORDER BY created_at DESC;
    `);

    const projects: Project[] = result.rows.map(row => ({
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      description: row.description,
      status: row.status,
      progressPercentage: row.progress_percentage,
      dueDate: row.due_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    res.json(projects);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/projects
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, dueDate } = req.body;
    if (!name) {
      return res.status(400).json({ error: { message: 'Nama proyek wajib diisi.' } });
    }

    const projId = `proj-${uuidv4().slice(0, 8)}`;
    await pool.query(`
      INSERT INTO projects (id, workspace_id, name, description, status, progress_percentage, due_date)
      VALUES ($1, 'ws-default-command-center', $2, $3, 'ACTIVE', 0, $4);
    `, [projId, name, description || null, dueDate || null]);

    res.status(201).json({ id: projId, message: 'Proyek berhasil dibuat.' });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

export default router;
