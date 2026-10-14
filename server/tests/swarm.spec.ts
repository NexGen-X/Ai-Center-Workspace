import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { pool } from '../src/db/index.js';
import { SwarmService } from '../src/services/swarmService.js';

describe('Autonomous Multi-Agent Swarm & Hierarchical Delegation Mesh', () => {
  const testWorkspaceId = 'ws-default-command-center';
  let createdMissionId: string;

  beforeAll(async () => {
    // Ensure default agents exist for tests
    const agentCheck = await pool.query(`SELECT id FROM ai_agents WHERE workspace_id = $1 LIMIT 1`, [testWorkspaceId]);
    if (agentCheck.rows.length === 0) {
      await pool.query(`
        INSERT INTO ai_agents (id, workspace_id, name, role, system_prompt, provider_id, model_id, capabilities, enabled)
        VALUES
          ('agent-test-swarm-lead', $1, 'Swarm Lead', 'Planner', 'Coordinator prompt', 'prov-routex-local', 'coding-fast', '[]', true),
          ('agent-test-swarm-dev', $1, 'Swarm Engineer', 'Executor', 'Executor prompt', 'prov-routex-local', 'coding-fast', '[]', true),
          ('agent-test-swarm-qa', $1, 'Swarm Auditor', 'QA / Reviewer', 'QA prompt', 'prov-routex-local', 'coding-fast', '[]', true)
        ON CONFLICT (id) DO NOTHING;
      `, [testWorkspaceId]);
    }
  });

  describe('1. Swarm Mission Planning & DAG Decomposition', () => {
    it('POST /api/swarm/plan should reject empty objective with 400', async () => {
      const res = await request(app)
        .post('/api/swarm/plan')
        .send({ objective: '   ' });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('POST /api/swarm/plan should decompose objective into dynamic DAG subtasks', async () => {
      const res = await request(app)
        .post('/api/swarm/plan')
        .send({
          objective: 'Rancang arsitektur microservice telemetri real-time, implementasikan endpoint, dan audit keamanan API.',
          workspaceId: testWorkspaceId
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('title');
      expect(res.body).toHaveProperty('coordinatorAgent');
      expect(res.body).toHaveProperty('subtasks');
      expect(Array.isArray(res.body.subtasks)).toBe(true);
      expect(res.body.subtasks.length).toBeGreaterThanOrEqual(3);

      const subtasks = res.body.subtasks;
      // First subtask must be root node (no dependencies)
      expect(subtasks[0].dependencies).toEqual([]);
      expect(subtasks[0].role).toBe('Planner');

      // Subsequent subtasks must have dependencies
      expect(subtasks[1].dependencies.length).toBeGreaterThan(0);
      expect(subtasks[1].dependencies).toContain(subtasks[0].id);

      // Verify each subtask has assignedAgentId and promptTemplate
      for (const st of subtasks) {
        expect(st.assignedAgentId).toBeDefined();
        expect(st.promptTemplate).toBeDefined();
        expect(st.status).toBe('PENDING');
      }
    });
  });

  describe('2. Autonomous Mission Dispatch & Execution Lifecycle', () => {
    it('POST /api/swarm/dispatch should reject empty objective with 400', async () => {
      const res = await request(app)
        .post('/api/swarm/dispatch')
        .send({ objective: '' });

      expect(res.status).toBe(400);
    });

    it('POST /api/swarm/dispatch should initialize and launch a swarm mission', async () => {
      const res = await request(app)
        .post('/api/swarm/dispatch')
        .send({
          title: 'Unit Test Autonomous Swarm Mission',
          objective: 'Lakukan audit keamanan dan refaktor modul autentikasi.',
          workspaceId: testWorkspaceId
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.status).toBe('EXECUTING');
      expect(Array.isArray(res.body.subtasks)).toBe(true);
      expect(res.body.subtasks.length).toBeGreaterThanOrEqual(3);

      createdMissionId = res.body.id;
    });

    it('GET /api/swarm/missions should return list of active and completed missions', async () => {
      const res = await request(app).get('/api/swarm/missions');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('missions');
      expect(Array.isArray(res.body.missions)).toBe(true);

      const found = res.body.missions.find((m: any) => m.id === createdMissionId);
      expect(found).toBeDefined();
      expect(found.title).toContain('Unit Test Autonomous Swarm Mission');
    });

    it('GET /api/swarm/missions/:id should retrieve mission details and inter-agent messages', async () => {
      const res = await request(app).get(`/api/swarm/missions/${createdMissionId}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('mission');
      expect(res.body).toHaveProperty('messages');
      expect(res.body.mission.id).toBe(createdMissionId);
      expect(Array.isArray(res.body.messages)).toBe(true);

      // Must have initial DELEGATION message
      const delegationMsg = res.body.messages.find((m: any) => m.messageType === 'DELEGATION');
      expect(delegationMsg).toBeDefined();
    });

    it('POST /api/swarm/missions/:id/cancel should cancel an executing mission', async () => {
      const res = await request(app).post(`/api/swarm/missions/${createdMissionId}/cancel`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success');

      // Verify mission status updated
      const detailRes = await request(app).get(`/api/swarm/missions/${createdMissionId}`);
      expect(detailRes.body.mission.status).toBe('CANCELLED');
    });

    it('POST /api/swarm/missions/:id/resume should resume a cancelled or interrupted mission', async () => {
      const res = await request(app).post(`/api/swarm/missions/${createdMissionId}/resume`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('mission');
      expect(res.body.mission.status).toBe('EXECUTING');

      // Cancel again to keep test clean
      await request(app).post(`/api/swarm/missions/${createdMissionId}/cancel`);
    });

    it('GET /api/swarm/missions/:id should return 404 for non-existent mission', async () => {
      const res = await request(app).get('/api/swarm/missions/non-existent-mission-id');
      expect(res.status).toBe(404);
    });
  });

  describe('3. SwarmService Internal Unit & Logic', () => {
    it('SwarmService.planMission should adapt subtask roles to objective content', async () => {
      const plan = await SwarmService.planMission(
        'Audit keamanan menyeluruh dan hardening celah penetrasi',
        testWorkspaceId
      );

      expect(plan.subtasks.length).toBe(4);
      const qaSubtask = plan.subtasks.find(s => s.role === 'QA / Reviewer');
      expect(qaSubtask).toBeDefined();
      expect(qaSubtask?.title.toLowerCase()).toContain('keamanan');
    });

    it('SwarmService.cancelMission on non-existent ID should return false gracefully', async () => {
      const result = await SwarmService.cancelMission('invalid-dummy-id');
      expect(result).toBe(false);
    });

    it('SwarmService.recoverInterruptedMissions should safely checkpoint in-flight missions', async () => {
      // Simulate an interrupted mission left in EXECUTING state
      const crashMissionId = `swarm-crash-test-${Date.now()}`;
      await pool.query(`
        INSERT INTO swarm_missions (id, workspace_id, title, objective, status, subtasks_json)
        VALUES ($1, $2, 'Interrupted Mission', 'Crash recovery test', 'EXECUTING', $3)
      `, [
        crashMissionId,
        testWorkspaceId,
        JSON.stringify([{ id: 'subtask-1', title: 'Task 1', status: 'RUNNING', dependencies: [] }])
      ]);

      const recoveredCount = await SwarmService.recoverInterruptedMissions();
      expect(recoveredCount).toBeGreaterThanOrEqual(1);

      // Verify mission status was transitioned to CANCELLED with saved checkpoint
      const checkRes = await pool.query(`SELECT status, subtasks_json FROM swarm_missions WHERE id = $1`, [crashMissionId]);
      expect(checkRes.rows[0].status).toBe('CANCELLED');
      const subtasks = typeof checkRes.rows[0].subtasks_json === 'string'
        ? JSON.parse(checkRes.rows[0].subtasks_json)
        : checkRes.rows[0].subtasks_json;
      expect(subtasks[0].status).toBe('PENDING');

      // Cleanup
      await pool.query(`DELETE FROM swarm_missions WHERE id = $1`, [crashMissionId]);
    });
  });
});
