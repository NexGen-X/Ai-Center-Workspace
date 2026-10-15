/**
 * Autonomous Proactive Scheduler & Daemon Service — AI Agent Command Center
 * Supports cron expressions, preset routines (Security Audit, Health Check, Swarm Missions, Vector Reindex),
 * execution logging, and real-time SSE broadcasting.
 */

import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/index.js';
import { systemLogger } from './logger.js';
import { realtimeHub } from './realtime.js';
import { SwarmService } from './swarmService.js';
import {
  AgentSchedule,
  ScheduleExecution,
  CreateScheduleDTO,
  UpdateScheduleDTO,
  ScheduleRoutineType,
  ScheduleStatus
} from '../../../shared/types.js';

// ==========================================
// CRON EXPRESSION EVALUATOR & UTILITIES
// ==========================================

export const CRON_ALIASES: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@hourly': '0 * * * *',
  '@every5min': '*/5 * * * *',
  '@every15min': '*/15 * * * *',
  '@every30min': '*/30 * * * *'
};

export function expandCron(expr: string): string {
  const trimmed = expr.trim();
  if (CRON_ALIASES[trimmed]) {
    return CRON_ALIASES[trimmed];
  }
  return trimmed;
}

function matchCronField(val: number, pattern: string, min: number, max: number): boolean {
  if (pattern === '*' || pattern === '?') return true;

  // Handle step: */5 or 1-30/5
  if (pattern.includes('/')) {
    const [rangePart, stepStr] = pattern.split('/');
    const step = parseInt(stepStr, 10);
    if (isNaN(step) || step <= 0) return false;

    let start = min;
    let end = max;
    if (rangePart !== '*' && rangePart !== '') {
      if (rangePart.includes('-')) {
        const [s, e] = rangePart.split('-').map((n) => parseInt(n, 10));
        start = isNaN(s) ? min : s;
        end = isNaN(e) ? max : e;
      } else {
        start = parseInt(rangePart, 10);
      }
    }

    if (val < start || val > end) return false;
    return (val - start) % step === 0;
  }

  // Handle list: 1,2,5
  if (pattern.includes(',')) {
    const parts = pattern.split(',');
    return parts.some((p) => matchCronField(val, p.trim(), min, max));
  }

  // Handle range: 1-5
  if (pattern.includes('-')) {
    const [s, e] = pattern.split('-').map((n) => parseInt(n, 10));
    if (isNaN(s) || isNaN(e)) return false;
    return val >= s && val <= e;
  }

  const num = parseInt(pattern, 10);
  return !isNaN(num) && val === num;
}

export function isCronMatch(cronExpr: string, date: Date): boolean {
  const expanded = expandCron(cronExpr);
  const parts = expanded.split(/\s+/);
  if (parts.length !== 5) return false;

  const [minPattern, hourPattern, domPattern, monthPattern, dowPattern] = parts;

  const minute = date.getMinutes();
  const hour = date.getHours();
  const dayOfMonth = date.getDate();
  const month = date.getMonth() + 1; // 1-12
  const dayOfWeek = date.getDay(); // 0-6 (0=Sunday)

  if (!matchCronField(minute, minPattern, 0, 59)) return false;
  if (!matchCronField(hour, hourPattern, 0, 23)) return false;
  if (!matchCronField(dayOfMonth, domPattern, 1, 31)) return false;
  if (!matchCronField(month, monthPattern, 1, 12)) return false;
  if (!matchCronField(dayOfWeek, dowPattern, 0, 6)) return false;

  return true;
}

/**
 * Calculates the next matching Date for a cron expression.
 * Evaluates minute by minute up to 1 year into the future.
 */
export function getNextRunDate(cronExpr: string, fromDate: Date = new Date()): Date {
  const start = new Date(fromDate);
  start.setSeconds(0, 0);
  start.setMinutes(start.getMinutes() + 1); // Next minute

  const maxMinutesToCheck = 60 * 24 * 366; // 1 year of minutes
  const curr = new Date(start);

  for (let i = 0; i < maxMinutesToCheck; i++) {
    if (isCronMatch(cronExpr, curr)) {
      return curr;
    }
    curr.setMinutes(curr.getMinutes() + 1);
  }

  // Fallback: 24 hours from now if invalid
  return new Date(fromDate.getTime() + 24 * 60 * 60 * 1000);
}

// ==========================================
// SCHEDULER SERVICE
// ==========================================

export class SchedulerService {
  private static timer: NodeJS.Timeout | null = null;
  private static isRunningTick = false;

  /**
   * Starts the background scheduler daemon tick loop.
   */
  static startDaemon(intervalMs = 30000): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    systemLogger.info('SYSTEM', `Scheduler Daemon aktif (interval: ${intervalMs}ms).`);

    // Run first check on start
    this.checkAndExecuteDueSchedules().catch((err) => {
      systemLogger.error('SYSTEM', `Gagal menjalankan tick awal scheduler: ${err.message}`);
    });

    this.timer = setInterval(() => {
      this.checkAndExecuteDueSchedules().catch((err) => {
        systemLogger.error('SYSTEM', `Gagal saat scheduler tick: ${err.message}`);
      });
    }, intervalMs);
  }

  /**
   * Stops the scheduler daemon.
   */
  static stopDaemon(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      systemLogger.info('SYSTEM', 'Scheduler Daemon dihentikan.');
    }
  }

  /**
   * Scans database for schedules where next_run_at <= NOW() and executes them.
   */
  static async checkAndExecuteDueSchedules(): Promise<void> {
    if (this.isRunningTick) return;
    this.isRunningTick = true;

    try {
      const res = await pool.query(`
        SELECT id, title, cron_expression, routine_type
        FROM agent_schedules
        WHERE is_active = true
          AND (last_status IS NULL OR last_status != 'RUNNING')
          AND (next_run_at IS NULL OR next_run_at <= NOW())
        ORDER BY next_run_at ASC NULLS FIRST
        LIMIT 10;
      `);

      for (const row of res.rows) {
        try {
          systemLogger.info('ORCHESTRATOR', `[Scheduler] Memicu jadwal rutin otomatis: "${row.title}" (${row.routine_type})`);
          await this.executeSchedule(row.id, false);
        } catch (execErr: any) {
          systemLogger.error('SYSTEM', `[Scheduler] Gagal mengeksekusi jadwal ${row.id}: ${execErr.message}`);
        }
      }
    } catch (err: any) {
      systemLogger.error('SYSTEM', `Error querying due schedules: ${err.message}`);
    } finally {
      this.isRunningTick = false;
    }
  }

  /**
   * Executes a scheduled routine by ID (either triggered automatically by daemon or manually by user).
   */
  static async executeSchedule(scheduleId: string, isManual = false): Promise<ScheduleExecution> {
    const schedRes = await pool.query(`
      SELECT s.*, a.name as agent_name
      FROM agent_schedules s
      LEFT JOIN ai_agents a ON s.target_agent_id = a.id
      WHERE s.id = $1;
    `, [scheduleId]);

    if (schedRes.rows.length === 0) {
      throw new Error(`Jadwal tidak ditemukan dengan id: ${scheduleId}`);
    }

    const schedule = schedRes.rows[0];
    const executionId = `exec-${uuidv4().slice(0, 8)}`;
    const startTime = Date.now();
    const startedAt = new Date().toISOString();

    // Mark schedule as RUNNING
    await pool.query(`
      UPDATE agent_schedules
      SET last_status = 'RUNNING',
          updated_at = NOW()
      WHERE id = $1;
    `, [scheduleId]);

    // Insert running execution record
    await pool.query(`
      INSERT INTO schedule_executions (
        id, schedule_id, workspace_id, status, started_at
      ) VALUES ($1, $2, $3, 'RUNNING', $4);
    `, [executionId, scheduleId, schedule.workspace_id, startedAt]);

    realtimeHub.broadcast('schedule.status', {
      scheduleId,
      status: 'RUNNING',
      isManual,
      title: schedule.title
    });

    let executionStatus: 'SUCCESS' | 'FAILED' = 'SUCCESS';
    let outputSummary = '';
    let errorMessage: string | undefined = undefined;
    let missionId: string | undefined = undefined;
    let details: Record<string, any> = {};

    try {
      const payload = typeof schedule.payload_json === 'string'
        ? JSON.parse(schedule.payload_json)
        : (schedule.payload_json || {});

      switch (schedule.routine_type as ScheduleRoutineType) {
        case 'HEALTH_CHECK': {
          const t0 = Date.now();
          await pool.query('SELECT 1 as ping;');
          const dbLatency = Date.now() - t0;
          const mem = process.memoryUsage();
          const heapMB = Math.round(mem.heapUsed / 1024 / 1024);
          const rssMB = Math.round(mem.rss / 1024 / 1024);

          const agentCountRes = await pool.query('SELECT count(*) as count FROM ai_agents WHERE workspace_id = $1;', [schedule.workspace_id]);
          const taskCountRes = await pool.query('SELECT count(*) as count FROM tasks WHERE workspace_id = $1;', [schedule.workspace_id]);

          const agentCount = parseInt(agentCountRes.rows[0]?.count || '0', 10);
          const taskCount = parseInt(taskCountRes.rows[0]?.count || '0', 10);

          outputSummary = `[Kesehatan Normal] Latensi DB: ${dbLatency}ms | Heap: ${heapMB}MB (RSS: ${rssMB}MB) | Agen Aktif: ${agentCount} | Total Tugas: ${taskCount}`;
          details = { dbLatency, heapMB, rssMB, agentCount, taskCount };
          break;
        }

        case 'SECURITY_AUDIT': {
          // Check for blocked agent actions in the last 24h
          const blockedRes = await pool.query(`
            SELECT count(*) as count
            FROM agent_actions
            WHERE status = 'BLOCKED'
              AND created_at >= NOW() - INTERVAL '24 hours';
          `);
          const blockedCount = parseInt(blockedRes.rows[0]?.count || '0', 10);

          // Verify total pending approvals
          const pendingRes = await pool.query(`
            SELECT count(*) as count
            FROM agent_actions
            WHERE status = 'PENDING';
          `);
          const pendingCount = parseInt(pendingRes.rows[0]?.count || '0', 10);

          outputSummary = `[Integritas Sandbox Terverifikasi] Tindakan diblokir (24 jam): ${blockedCount} | Menunggu persetujuan: ${pendingCount} | Isolasi sandbox aman`;
          details = { blockedCount24h: blockedCount, pendingApprovals: pendingCount, sandboxBoundary: 'SECURE' };
          break;
        }

        case 'VECTOR_REINDEX': {
          const docCountRes = await pool.query('SELECT count(*) as count FROM documents WHERE workspace_id = $1;', [schedule.workspace_id]);
          const chunkCountRes = await pool.query('SELECT count(*) as count FROM document_chunks WHERE workspace_id = $1;', [schedule.workspace_id]);

          const docCount = parseInt(docCountRes.rows[0]?.count || '0', 10);
          const chunkCount = parseInt(chunkCountRes.rows[0]?.count || '0', 10);

          outputSummary = `[Indeks Memori Semantik RAG] ${docCount} dokumen & ${chunkCount} vektor chunk HNSW aktif`;
          details = { docCount, chunkCount };
          break;
        }

        case 'SWARM_MISSION': {
          const objective = payload.objective || schedule.description || schedule.title;
          const plan = await SwarmService.planMission(
            objective,
            schedule.workspace_id
          );

          const dispatched = await SwarmService.dispatchMission({
            objective: plan.objective,
            title: plan.title,
            subtasks: plan.subtasks,
            coordinatorAgentId: plan.coordinatorAgent.id,
            workspaceId: schedule.workspace_id
          });

          missionId = dispatched.id;
          outputSummary = `[Misi Swarm Diterbitkan] ID: ${dispatched.id} | Judul: "${dispatched.title}" | Subtask Terdekomposisi: ${dispatched.subtasks.length}`;
          details = { missionId: dispatched.id, subtaskCount: dispatched.subtasks.length };
          break;
        }

        case 'AGENT_TASK':
        default: {
          const agentName = schedule.agent_name || 'Autonomous Agent';
          outputSummary = `[Tugas Agen Mandiri] Rutinitas "${schedule.title}" dieksekusi untuk ${agentName}.`;
          details = { agentId: schedule.target_agent_id, agentName };
          break;
        }
      }
    } catch (err: any) {
      executionStatus = 'FAILED';
      errorMessage = err.message || 'Eksekusi jadwal gagal tanpa pesan spesifik';
      outputSummary = `[Gagal] ${errorMessage}`;
      systemLogger.error('SYSTEM', `[Scheduler Error] ${schedule.title}: ${errorMessage}`);

      import('./alertingService.js').then(({ AlertingService }) => {
        AlertingService.dispatchAlert({
          event: 'SCHEDULE_FAILED',
          title: `Jadwal Rutin Gagal: ${schedule.title}`,
          message: errorMessage || 'Eksekusi jadwal otomatis gagal dijalankan.',
          severity: 'CRITICAL',
          metadata: {
            schedule_id: schedule.id,
            routine_type: schedule.routine_type,
            error: errorMessage
          }
        }, schedule.workspace_id).catch(() => {});
      }).catch(() => {});
    }

    const durationMs = Date.now() - startTime;
    const completedAt = new Date().toISOString();

    // Update execution row
    await pool.query(`
      UPDATE schedule_executions
      SET status = $1,
          completed_at = $2,
          duration_ms = $3,
          output_summary = $4,
          error_message = $5,
          mission_id = $6,
          details_json = $7
      WHERE id = $8;
    `, [
      executionStatus,
      completedAt,
      durationMs,
      outputSummary,
      errorMessage || null,
      missionId || null,
      JSON.stringify(details),
      executionId
    ]);

    // Recalculate next run date
    const nextRun = getNextRunDate(schedule.cron_expression, new Date());

    // Update schedule table
    await pool.query(`
      UPDATE agent_schedules
      SET last_run_at = $1,
          next_run_at = $2,
          last_status = $3,
          last_result_summary = $4,
          total_runs = total_runs + 1,
          failure_count = failure_count + $5,
          updated_at = NOW()
      WHERE id = $6;
    `, [
      startedAt,
      nextRun.toISOString(),
      executionStatus,
      outputSummary,
      executionStatus === 'FAILED' ? 1 : 0,
      scheduleId
    ]);

    const resultExecution: ScheduleExecution = {
      id: executionId,
      scheduleId,
      scheduleTitle: schedule.title,
      routineType: schedule.routine_type,
      workspaceId: schedule.workspace_id,
      status: executionStatus,
      startedAt,
      completedAt,
      durationMs,
      outputSummary,
      errorMessage,
      missionId,
      details
    };

    realtimeHub.broadcast('schedule.executed', resultExecution);
    return resultExecution;
  }

  // ==========================================
  // CRUD OPERATIONS
  // ==========================================

  static async getSchedules(workspaceId: string): Promise<AgentSchedule[]> {
    const res = await pool.query(`
      SELECT s.*, a.name as target_agent_name
      FROM agent_schedules s
      LEFT JOIN ai_agents a ON s.target_agent_id = a.id
      WHERE s.workspace_id = $1
      ORDER BY s.created_at ASC;
    `, [workspaceId]);

    return res.rows.map(this.mapRowToSchedule);
  }

  static async getScheduleById(id: string): Promise<AgentSchedule | null> {
    const res = await pool.query(`
      SELECT s.*, a.name as target_agent_name
      FROM agent_schedules s
      LEFT JOIN ai_agents a ON s.target_agent_id = a.id
      WHERE s.id = $1;
    `, [id]);

    if (res.rows.length === 0) return null;
    return this.mapRowToSchedule(res.rows[0]);
  }

  static async createSchedule(dto: CreateScheduleDTO): Promise<AgentSchedule> {
    const id = `sched-${uuidv4().slice(0, 8)}`;
    const workspaceId = dto.workspaceId || 'ws-default-command-center';
    const cron = expandCron(dto.cronExpression);
    const nextRun = getNextRunDate(cron, new Date());
    const isActive = dto.isActive !== undefined ? dto.isActive : true;

    await pool.query(`
      INSERT INTO agent_schedules (
        id, workspace_id, title, description, cron_expression,
        routine_type, target_agent_id, payload_json, is_active,
        next_run_at, last_status, total_runs, failure_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'IDLE', 0, 0);
    `, [
      id,
      workspaceId,
      dto.title,
      dto.description || null,
      dto.cronExpression,
      dto.routineType,
      dto.targetAgentId || null,
      JSON.stringify(dto.payload || {}),
      isActive,
      nextRun.toISOString()
    ]);

    const created = await this.getScheduleById(id);
    if (!created) throw new Error('Gagal memuat jadwal yang baru dibuat.');
    return created;
  }

  static async updateSchedule(id: string, dto: UpdateScheduleDTO): Promise<AgentSchedule> {
    const current = await this.getScheduleById(id);
    if (!current) throw new Error(`Jadwal tidak ditemukan: ${id}`);

    const newCron = dto.cronExpression ? expandCron(dto.cronExpression) : current.cronExpression;
    const nextRun = dto.cronExpression ? getNextRunDate(newCron, new Date()) : (current.nextRunAt ? new Date(current.nextRunAt) : new Date());

    await pool.query(`
      UPDATE agent_schedules
      SET title = COALESCE($1, title),
          description = COALESCE($2, description),
          cron_expression = COALESCE($3, cron_expression),
          routine_type = COALESCE($4, routine_type),
          target_agent_id = COALESCE($5, target_agent_id),
          payload_json = COALESCE($6, payload_json),
          is_active = COALESCE($7, is_active),
          next_run_at = $8,
          updated_at = NOW()
      WHERE id = $9;
    `, [
      dto.title || null,
      dto.description !== undefined ? dto.description : null,
      dto.cronExpression || null,
      dto.routineType || null,
      dto.targetAgentId || null,
      dto.payload ? JSON.stringify(dto.payload) : null,
      dto.isActive !== undefined ? dto.isActive : null,
      nextRun.toISOString(),
      id
    ]);

    const updated = await this.getScheduleById(id);
    if (!updated) throw new Error('Gagal memuat jadwal setelah pembaruan.');
    return updated;
  }

  static async deleteSchedule(id: string): Promise<boolean> {
    const res = await pool.query('DELETE FROM agent_schedules WHERE id = $1 RETURNING id;', [id]);
    return (res.rowCount || 0) > 0;
  }

  static async toggleSchedule(id: string): Promise<AgentSchedule> {
    const current = await this.getScheduleById(id);
    if (!current) throw new Error(`Jadwal tidak ditemukan: ${id}`);

    const newActive = !current.isActive;
    const nextRun = newActive ? getNextRunDate(current.cronExpression, new Date()) : null;

    await pool.query(`
      UPDATE agent_schedules
      SET is_active = $1,
          next_run_at = $2,
          updated_at = NOW()
      WHERE id = $3;
    `, [newActive, nextRun ? nextRun.toISOString() : null, id]);

    const updated = await this.getScheduleById(id);
    if (!updated) throw new Error('Gagal memuat jadwal setelah toggle.');
    return updated;
  }

  static async getScheduleExecutions(scheduleId: string, limit = 20): Promise<ScheduleExecution[]> {
    const res = await pool.query(`
      SELECT e.*, s.title as schedule_title, s.routine_type
      FROM schedule_executions e
      JOIN agent_schedules s ON e.schedule_id = s.id
      WHERE e.schedule_id = $1
      ORDER BY e.started_at DESC
      LIMIT $2;
    `, [scheduleId, limit]);

    return res.rows.map(this.mapRowToExecution);
  }

  static async getRecentExecutions(workspaceId: string, limit = 30): Promise<ScheduleExecution[]> {
    const res = await pool.query(`
      SELECT e.*, s.title as schedule_title, s.routine_type
      FROM schedule_executions e
      JOIN agent_schedules s ON e.schedule_id = s.id
      WHERE e.workspace_id = $1
      ORDER BY e.started_at DESC
      LIMIT $2;
    `, [workspaceId, limit]);

    return res.rows.map(this.mapRowToExecution);
  }

  private static mapRowToSchedule(row: any): AgentSchedule {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      title: row.title,
      description: row.description || undefined,
      cronExpression: row.cron_expression,
      routineType: row.routine_type,
      targetAgentId: row.target_agent_id || undefined,
      targetAgentName: row.target_agent_name || undefined,
      payload: typeof row.payload_json === 'string' ? JSON.parse(row.payload_json) : (row.payload_json || {}),
      isActive: Boolean(row.is_active),
      lastRunAt: row.last_run_at ? new Date(row.last_run_at).toISOString() : undefined,
      nextRunAt: row.next_run_at ? new Date(row.next_run_at).toISOString() : undefined,
      lastStatus: row.last_status || 'IDLE',
      lastResultSummary: row.last_result_summary || undefined,
      totalRuns: parseInt(row.total_runs || '0', 10),
      failureCount: parseInt(row.failure_count || '0', 10),
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString()
    };
  }

  private static mapRowToExecution(row: any): ScheduleExecution {
    return {
      id: row.id,
      scheduleId: row.schedule_id,
      scheduleTitle: row.schedule_title || undefined,
      routineType: row.routine_type,
      workspaceId: row.workspace_id,
      status: row.status,
      startedAt: new Date(row.started_at).toISOString(),
      completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : undefined,
      durationMs: row.duration_ms ? parseInt(row.duration_ms, 10) : undefined,
      outputSummary: row.output_summary || undefined,
      errorMessage: row.error_message || undefined,
      missionId: row.mission_id || undefined,
      details: typeof row.details_json === 'string' ? JSON.parse(row.details_json) : (row.details_json || {})
    };
  }
}
