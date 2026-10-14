/**
 * Schedules & Autonomous Routines REST Endpoints — AI Agent Command Center
 */

import { Router, Request, Response } from 'express';
import { SchedulerService, expandCron, getNextRunDate } from '../services/schedulerService.js';
import { systemLogger } from '../services/logger.js';
import { CreateScheduleDTO, UpdateScheduleDTO } from '../../../shared/types.js';

export const schedulesRouter = Router();

// GET /api/schedules - List all schedules in workspace
schedulesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const workspaceId = (req.query.workspaceId as string) || 'ws-default-command-center';
    const schedules = await SchedulerService.getSchedules(workspaceId);
    res.json({
      success: true,
      data: schedules
    });
  } catch (err: any) {
    systemLogger.error('API', `GET /api/schedules error: ${err.message}`);
    res.status(500).json({ error: 'Gagal memuat daftar jadwal rutin.', details: err.message });
  }
});

// GET /api/schedules/executions/recent - Recent execution history
schedulesRouter.get('/executions/recent', async (req: Request, res: Response) => {
  try {
    const workspaceId = (req.query.workspaceId as string) || 'ws-default-command-center';
    const limit = parseInt(req.query.limit as string || '30', 10);
    const executions = await SchedulerService.getRecentExecutions(workspaceId, limit);
    res.json({
      success: true,
      data: executions
    });
  } catch (err: any) {
    systemLogger.error('API', `GET /api/schedules/executions/recent error: ${err.message}`);
    res.status(500).json({ error: 'Gagal memuat riwayat eksekusi jadwal.', details: err.message });
  }
});

// GET /api/schedules/:id - Get schedule by ID
schedulesRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const schedule = await SchedulerService.getScheduleById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ error: 'Jadwal tidak ditemukan.' });
    }
    res.json({
      success: true,
      data: schedule
    });
  } catch (err: any) {
    systemLogger.error('API', `GET /api/schedules/${req.params.id} error: ${err.message}`);
    res.status(500).json({ error: 'Gagal memuat detail jadwal.', details: err.message });
  }
});

// POST /api/schedules - Create new autonomous routine
schedulesRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { title, description, cronExpression, routineType, targetAgentId, payload, isActive, workspaceId } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Judul jadwal wajib diisi.' });
    }
    if (!cronExpression || !cronExpression.trim()) {
      return res.status(400).json({ error: 'Ekspresi cron wajib diisi.' });
    }
    if (!routineType) {
      return res.status(400).json({ error: 'Tipe rutinitas wajib dipilih.' });
    }

    const dto: CreateScheduleDTO = {
      title: title.trim(),
      description: description?.trim(),
      cronExpression: cronExpression.trim(),
      routineType,
      targetAgentId,
      payload: payload || {},
      isActive: isActive !== undefined ? isActive : true,
      workspaceId: workspaceId || 'ws-default-command-center'
    };

    const created = await SchedulerService.createSchedule(dto);
    res.status(201).json({
      success: true,
      data: created
    });
  } catch (err: any) {
    systemLogger.error('API', `POST /api/schedules error: ${err.message}`);
    res.status(500).json({ error: 'Gagal membuat jadwal rutin.', details: err.message });
  }
});

// PUT /api/schedules/:id - Update schedule
schedulesRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const dto: UpdateScheduleDTO = req.body;
    const updated = await SchedulerService.updateSchedule(req.params.id, dto);
    res.json({
      success: true,
      data: updated
    });
  } catch (err: any) {
    systemLogger.error('API', `PUT /api/schedules/${req.params.id} error: ${err.message}`);
    res.status(500).json({ error: 'Gagal memperbarui jadwal.', details: err.message });
  }
});

// DELETE /api/schedules/:id - Delete schedule
schedulesRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await SchedulerService.deleteSchedule(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Jadwal tidak ditemukan atau sudah dihapus.' });
    }
    res.json({
      success: true,
      message: 'Jadwal berhasil dihapus.'
    });
  } catch (err: any) {
    systemLogger.error('API', `DELETE /api/schedules/${req.params.id} error: ${err.message}`);
    res.status(500).json({ error: 'Gagal menghapus jadwal.', details: err.message });
  }
});

// POST /api/schedules/:id/toggle - Toggle schedule active state
schedulesRouter.post('/:id/toggle', async (req: Request, res: Response) => {
  try {
    const toggled = await SchedulerService.toggleSchedule(req.params.id);
    res.json({
      success: true,
      data: toggled
    });
  } catch (err: any) {
    systemLogger.error('API', `POST /api/schedules/${req.params.id}/toggle error: ${err.message}`);
    res.status(500).json({ error: 'Gagal mengubah status aktif jadwal.', details: err.message });
  }
});

// POST /api/schedules/:id/run-now - Trigger immediate manual execution
schedulesRouter.post('/:id/run-now', async (req: Request, res: Response) => {
  try {
    systemLogger.info('ORCHESTRATOR', `Manual run triggered for schedule: ${req.params.id}`);
    const execution = await SchedulerService.executeSchedule(req.params.id, true);
    res.json({
      success: true,
      data: execution
    });
  } catch (err: any) {
    systemLogger.error('API', `POST /api/schedules/${req.params.id}/run-now error: ${err.message}`);
    res.status(500).json({ error: 'Gagal menjalankan jadwal saat ini.', details: err.message });
  }
});

// GET /api/schedules/:id/history - Get execution history of specific schedule
schedulesRouter.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string || '20', 10);
    const history = await SchedulerService.getScheduleExecutions(req.params.id, limit);
    res.json({
      success: true,
      data: history
    });
  } catch (err: any) {
    systemLogger.error('API', `GET /api/schedules/${req.params.id}/history error: ${err.message}`);
    res.status(500).json({ error: 'Gagal memuat riwayat jadwal.', details: err.message });
  }
});
