/**
 * Unit & Integration Test Suite — Proactive Autonomous Schedules & Cron Engine
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { pool } from '../src/db/index.js';
import {
  expandCron,
  isCronMatch,
  getNextRunDate,
  SchedulerService,
  CRON_ALIASES
} from '../src/services/schedulerService.js';

describe('Proactive Autonomous Schedules & Cron Engine Verification', () => {
  beforeAll(async () => {
    // Ensure test tables exist and are ready
    await pool.query('SELECT 1;');
  });

  describe('1. Cron Parser & Expression Evaluator', () => {
    it('should expand cron preset aliases accurately', () => {
      expect(expandCron('@hourly')).toBe('0 * * * *');
      expect(expandCron('@daily')).toBe('0 0 * * *');
      expect(expandCron('@weekly')).toBe('0 0 * * 0');
      expect(expandCron('@every15min')).toBe('*/15 * * * *');
      expect(expandCron('0 12 * * 1-5')).toBe('0 12 * * 1-5');
    });

    it('should match cron date conditions correctly', () => {
      // 2026-10-14 12:00:00 (Wednesday, day 3)
      const d1 = new Date(2026, 9, 14, 12, 0, 0); // October is month 9 in 0-indexed JS
      expect(isCronMatch('0 12 * * *', d1)).toBe(true);
      expect(isCronMatch('0 13 * * *', d1)).toBe(false);
      expect(isCronMatch('*/15 * * * *', d1)).toBe(true);
      expect(isCronMatch('0 12 * * 3', d1)).toBe(true); // Wednesday is 3
      expect(isCronMatch('0 12 * * 0', d1)).toBe(false); // Sunday is 0
    });

    it('should calculate future next run date monotonically', () => {
      const now = new Date();
      const nextRun = getNextRunDate('0 * * * *', now); // Next top of hour
      expect(nextRun.getTime()).toBeGreaterThan(now.getTime());
      expect(nextRun.getMinutes()).toBe(0);
      expect(nextRun.getSeconds()).toBe(0);
    });
  });

  describe('2. Autonomous Routine Execution Engine', () => {
    it('should execute a HEALTH_CHECK routine and record metrics', async () => {
      // Create a test schedule
      const sched = await SchedulerService.createSchedule({
        title: 'Test Health Audit',
        cronExpression: '@hourly',
        routineType: 'HEALTH_CHECK',
        workspaceId: 'ws-default-command-center'
      });

      expect(sched.id).toBeDefined();
      expect(sched.routineType).toBe('HEALTH_CHECK');

      const execution = await SchedulerService.executeSchedule(sched.id, true);
      expect(execution.status).toBe('SUCCESS');
      expect(execution.outputSummary).toContain('Kesehatan Normal');
      expect(execution.durationMs).toBeGreaterThanOrEqual(0);

      // Verify schedule was updated
      const updated = await SchedulerService.getScheduleById(sched.id);
      expect(updated?.totalRuns).toBe(1);
      expect(updated?.lastStatus).toBe('SUCCESS');
      expect(updated?.lastRunAt).toBeDefined();

      // Clean up
      await SchedulerService.deleteSchedule(sched.id);
    });

    it('should execute a SECURITY_AUDIT routine and verify sandbox boundaries', async () => {
      const sched = await SchedulerService.createSchedule({
        title: 'Test Security Audit',
        cronExpression: '0 2 * * *',
        routineType: 'SECURITY_AUDIT',
        workspaceId: 'ws-default-command-center'
      });

      const execution = await SchedulerService.executeSchedule(sched.id, true);
      expect(execution.status).toBe('SUCCESS');
      expect(execution.outputSummary).toContain('Integritas Sandbox Terverifikasi');

      await SchedulerService.deleteSchedule(sched.id);
    });

    it('should execute a VECTOR_REINDEX routine and verify semantic memory status', async () => {
      const sched = await SchedulerService.createSchedule({
        title: 'Test Vector Sync',
        cronExpression: '0 4 * * *',
        routineType: 'VECTOR_REINDEX',
        workspaceId: 'ws-default-command-center'
      });

      const execution = await SchedulerService.executeSchedule(sched.id, true);
      expect(execution.status).toBe('SUCCESS');
      expect(execution.outputSummary).toContain('Indeks Memori Semantik RAG');

      await SchedulerService.deleteSchedule(sched.id);
    });
  });

  describe('3. REST API Endpoints Lifecycle', () => {
    let createdScheduleId = '';

    it('GET /api/schedules should return all active schedules', async () => {
      const res = await request(app).get('/api/schedules');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('POST /api/schedules should create a new custom autonomous schedule', async () => {
      const res = await request(app)
        .post('/api/schedules')
        .send({
          title: 'Custom Nightly Swarm Review',
          description: 'Melakukan dekomposisi audit kode di malam hari',
          cronExpression: '0 1 * * *',
          routineType: 'SWARM_MISSION',
          payload: { objective: 'Audit security and code cleanliness' }
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.title).toBe('Custom Nightly Swarm Review');
      expect(res.body.data.isActive).toBe(true);

      createdScheduleId = res.body.data.id;
    });

    it('GET /api/schedules/:id should fetch schedule details', async () => {
      const res = await request(app).get(`/api/schedules/${createdScheduleId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createdScheduleId);
      expect(res.body.data.routineType).toBe('SWARM_MISSION');
    });

    it('POST /api/schedules/:id/toggle should toggle active state', async () => {
      const res = await request(app).post(`/api/schedules/${createdScheduleId}/toggle`);
      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);

      // Toggle back to active
      const res2 = await request(app).post(`/api/schedules/${createdScheduleId}/toggle`);
      expect(res2.status).toBe(200);
      expect(res2.body.data.isActive).toBe(true);
    });

    it('POST /api/schedules/:id/run-now should trigger immediate execution', async () => {
      const res = await request(app).post(`/api/schedules/${createdScheduleId}/run-now`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('SUCCESS');
      expect(res.body.data.outputSummary).toBeDefined();
    });

    it('GET /api/schedules/:id/history should return execution logs', async () => {
      const res = await request(app).get(`/api/schedules/${createdScheduleId}/history`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].status).toBe('SUCCESS');
    });

    it('GET /api/schedules/executions/recent should list recent executions workspace-wide', async () => {
      const res = await request(app).get('/api/schedules/executions/recent?limit=10');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('DELETE /api/schedules/:id should remove the schedule', async () => {
      const res = await request(app).delete(`/api/schedules/${createdScheduleId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const check = await request(app).get(`/api/schedules/${createdScheduleId}`);
      expect(check.status).toBe(404);
    });
  });
});
