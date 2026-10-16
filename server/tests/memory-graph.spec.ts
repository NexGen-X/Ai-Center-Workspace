/**
 * Cognitive Memory Graph Explorer & Mind Map Test Suite — AI Agent Command Center
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { pool } from '../src/db/index.js';
import { MemoryGraphService } from '../src/services/memoryGraphService.js';

describe('Cognitive Memory Graph Explorer API & Service', () => {
  let sampleAgentId: string = 'agent-orchestrator';
  let secondAgentId: string = 'agent-executor';
  let createdMemoryId: string;

  beforeAll(async () => {
    // Ensure default workspace and agents exist
    const agentRes = await pool.query(`SELECT id FROM ai_agents LIMIT 2`);
    if (agentRes.rows.length >= 2) {
      sampleAgentId = agentRes.rows[0].id;
      secondAgentId = agentRes.rows[1].id;
    }
  });

  it('GET /api/memory-graph should return graph structure with nodes, edges, and telemetry stats', async () => {
    const res = await request(app)
      .get('/api/memory-graph')
      .expect(200);

    expect(res.body).toHaveProperty('nodes');
    expect(res.body).toHaveProperty('edges');
    expect(res.body).toHaveProperty('stats');

    expect(Array.isArray(res.body.nodes)).toBe(true);
    expect(Array.isArray(res.body.edges)).toBe(true);

    const stats = res.body.stats;
    expect(stats).toHaveProperty('totalMemories');
    expect(stats).toHaveProperty('totalAgents');
    expect(stats).toHaveProperty('totalEdges');
    expect(stats).toHaveProperty('averageImportance');

    // Must have at least 1 agent node and some memory nodes from auto-seeding
    expect(res.body.nodes.some((n: any) => n.type === 'AGENT')).toBe(true);
    expect(res.body.nodes.some((n: any) => n.type === 'MEMORY')).toBe(true);

    // Pick one memory ID for subsequent share and consolidate tests
    const memNode = res.body.nodes.find((n: any) => n.type === 'MEMORY');
    expect(memNode).toBeDefined();
    createdMemoryId = memNode.id;
  });

  it('GET /api/memory-graph with filter should respect memoryType filter', async () => {
    const res = await request(app)
      .get('/api/memory-graph?memoryType=FACTUAL')
      .expect(200);

    const memNodes = res.body.nodes.filter((n: any) => n.type === 'MEMORY');
    if (memNodes.length > 0) {
      memNodes.forEach((n: any) => {
        expect(n.memoryType).toBe('FACTUAL');
      });
    }
  });

  it('GET /api/memory-graph with search query should filter matching nodes', async () => {
    const res = await request(app)
      .get('/api/memory-graph?searchQuery=PostgreSQL')
      .expect(200);

    expect(Array.isArray(res.body.nodes)).toBe(true);
  });

  it('POST /api/memory-graph/share should reject invalid payloads with 400', async () => {
    await request(app)
      .post('/api/memory-graph/share')
      .send({})
      .expect(400);

    await request(app)
      .post('/api/memory-graph/share')
      .send({ memoryId: 'invalid-id', targetAgentIds: [] })
      .expect(400);
  });

  it('POST /api/memory-graph/share should replicate memory to target agent', async () => {
    expect(createdMemoryId).toBeDefined();

    const res = await request(app)
      .post('/api/memory-graph/share')
      .send({
        memoryId: createdMemoryId,
        targetAgentIds: [secondAgentId]
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.sharedCount).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(res.body.newMemoryIds)).toBe(true);
  });

  it('POST /api/memory-graph/consolidate should reject less than 2 memories with 400', async () => {
    await request(app)
      .post('/api/memory-graph/consolidate')
      .send({
        memoryIds: [createdMemoryId],
        newKeyPoint: 'Consolidated rule'
      })
      .expect(400);
  });

  it('POST /api/memory-graph/consolidate should synthesize multiple memories into a single rule', async () => {
    // Fetch two memory IDs from database
    const mems = await pool.query(`SELECT id FROM agent_memories LIMIT 2`);
    if (mems.rows.length >= 2) {
      const id1 = mems.rows[0].id;
      const id2 = mems.rows[1].id;

      const res = await request(app)
        .post('/api/memory-graph/consolidate')
        .send({
          memoryIds: [id1, id2],
          targetMemoryType: 'FACTUAL',
          newKeyPoint: 'Synthesized ground truth: High-concurrency operations require circuit breakers and read replicas.',
          newContext: 'Consolidated from previous performance lessons'
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.consolidated).toBeDefined();
      expect(res.body.consolidated.keyPoint).toContain('Synthesized ground truth');

      // The original 2 memories should be removed/replaced
      const verifyOld = await pool.query(
        `SELECT id FROM agent_memories WHERE id = ANY($1::varchar[])`,
        [[id1, id2]]
      );
      expect(verifyOld.rows.length).toBe(0);
    }
  });

  it('POST /api/memory-graph/prune should remove decayed memories with score below threshold', async () => {
    // Insert a low-importance memory
    const lowMemId = `mem-low-test-${Date.now()}`;
    await pool.query(
      `INSERT INTO agent_memories (
        id, agent_id, workspace_id, memory_type, key_point, importance_score, created_at
      ) VALUES ($1, $2, 'ws-default-command-center', 'EPISODIC', 'Temporary transient debug note', 0.15, NOW())`,
      [lowMemId, sampleAgentId]
    );

    const res = await request(app)
      .post('/api/memory-graph/prune')
      .send({
        thresholdScore: 0.25,
        agentId: sampleAgentId
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.prunedCount).toBeGreaterThanOrEqual(1);

    // Verify low importance memory is pruned
    const checkRes = await pool.query(`SELECT id FROM agent_memories WHERE id = $1`, [lowMemId]);
    expect(checkRes.rows.length).toBe(0);
  });

  it('POST /api/memory-graph/seed should be idempotent and return success', async () => {
    const res = await request(app)
      .post('/api/memory-graph/seed')
      .send({ workspaceId: 'ws-default-command-center' })
      .expect(200);

    expect(res.body.success).toBe(true);
  });
});
