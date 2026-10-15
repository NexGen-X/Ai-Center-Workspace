import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { pool } from '../src/db/index.js';

describe('Multi-Agent War Room & Live Debate Studio API', () => {
  let createdRoomId = '';
  let createdTaskId = '';

  beforeAll(async () => {
    // Ensure tables exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS war_rooms (
        id VARCHAR(64) PRIMARY KEY,
        workspace_id VARCHAR(64) NOT NULL DEFAULT 'ws-default-command-center',
        title VARCHAR(255) NOT NULL,
        topic TEXT NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
        consensus_summary TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS war_room_participants (
        id VARCHAR(64) PRIMARY KEY,
        war_room_id VARCHAR(64) NOT NULL REFERENCES war_rooms(id) ON DELETE CASCADE,
        agent_id VARCHAR(64) NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
        role_in_debate VARCHAR(64) NOT NULL DEFAULT 'SPECIALIST',
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(war_room_id, agent_id)
      );

      CREATE TABLE IF NOT EXISTS war_room_messages (
        id VARCHAR(64) PRIMARY KEY,
        war_room_id VARCHAR(64) NOT NULL REFERENCES war_rooms(id) ON DELETE CASCADE,
        sender_type VARCHAR(32) NOT NULL,
        sender_id VARCHAR(64) NOT NULL,
        sender_name VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        round_number INTEGER NOT NULL DEFAULT 1,
        is_consensus_proposal BOOLEAN DEFAULT FALSE,
        critique_target_id VARCHAR(64),
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
  });

  afterAll(async () => {
    if (createdRoomId) {
      await pool.query('DELETE FROM war_rooms WHERE id = $1', [createdRoomId]);
    }
    if (createdTaskId) {
      await pool.query('DELETE FROM tasks WHERE id = $1', [createdTaskId]);
    }
  });

  it('POST /api/war-rooms should reject request with missing required parameters', async () => {
    const res = await request(app).post('/api/war-rooms').send({
      title: 'Missing Topic Room'
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('POST /api/war-rooms should successfully create a War Room with participants and initial moderator message', async () => {
    const res = await request(app)
      .post('/api/war-rooms')
      .send({
        title: 'Microservices vs Monolith Migration',
        topic: 'Evaluasi apakah sistem harus dipecah menjadi event-driven microservices atau tetap modular monolith.',
        agentIds: ['agent-planner', 'agent-orchestrator', 'agent-devops'],
        roles: {
          'agent-planner': 'LEAD_ARCHITECT',
          'agent-orchestrator': 'SECURITY_ANALYST',
          'agent-devops': 'PERFORMANCE_CRITIC'
        }
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.participants.length).toBe(3);
    expect(res.body.messages.length).toBe(1);
    expect(res.body.messages[0].senderType).toBe('MODERATOR');

    createdRoomId = res.body.id;
  });

  it('GET /api/war-rooms should return all active war rooms', async () => {
    const res = await request(app).get('/api/war-rooms');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const found = res.body.find((r: any) => r.id === createdRoomId);
    expect(found).toBeDefined();
    expect(found.title).toBe('Microservices vs Monolith Migration');
  });

  it('GET /api/war-rooms/:id should return complete room details with participant profiles and transcript', async () => {
    const res = await request(app).get(`/api/war-rooms/${createdRoomId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdRoomId);
    expect(res.body.participants.length).toBe(3);
    expect(res.body.messages.length).toBeGreaterThanOrEqual(1);

    const architect = res.body.participants.find((p: any) => p.roleInDebate === 'LEAD_ARCHITECT');
    expect(architect).toBeDefined();
  });

  it('POST /api/war-rooms/:id/messages should allow user commander to interject a message', async () => {
    const res = await request(app)
      .post(`/api/war-rooms/${createdRoomId}/messages`)
      .send({
        content: 'Perhatikan latensi jaringan jika memecah service ke k8s cluster!'
      });

    expect(res.status).toBe(201);
    expect(res.body.senderType).toBe('USER');
    expect(res.body.senderName).toContain('Commander');
    expect(res.body.content).toContain('latensi jaringan');
  });

  it('POST /api/war-rooms/:id/deliberate should trigger a round of multi-agent debate contributions', async () => {
    const res = await request(app)
      .post(`/api/war-rooms/${createdRoomId}/deliberate`)
      .send({
        roundNumber: 1
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.messages)).toBe(true);
    expect(res.body.messages.length).toBe(3);

    // Verify messages came from agents with substantive content
    for (const msg of res.body.messages) {
      expect(msg.senderType).toBe('AGENT');
      expect(msg.content.length).toBeGreaterThan(30);
    }
  });

  it('POST /api/war-rooms/:id/conclude should synthesize consensus and mark room CONCLUDED', async () => {
    const res = await request(app).post(`/api/war-rooms/${createdRoomId}/conclude`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CONCLUDED');
    expect(res.body.consensusSummary).toBeDefined();
    expect(res.body.consensusSummary).toContain('KONSENSUS AKHIR');
  });

  it('POST /api/war-rooms/:id/convert-to-task should convert consensus into a project Task with 1-click', async () => {
    const res = await request(app)
      .post(`/api/war-rooms/${createdRoomId}/convert-to-task`)
      .send({
        title: 'Implementasi Arsitektur Modular Monolith Berdasarkan War Room',
        priority: 'HIGH'
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.title).toContain('Modular Monolith');
    expect(res.body.status).toBe('TODO');
    expect(res.body.priority).toBe('HIGH');

    createdTaskId = res.body.id;
  });
});
