import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { pool } from '../src/db/index.js';
import { WorkflowEngine } from '../src/services/workflowEngine.js';

describe('Visual DAG Workflow & Pipeline Engine', () => {
  let createdWorkflowId = '';
  let createdExecutionId = '';

  beforeAll(async () => {
    // Ensure tables exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS workflows (
        id VARCHAR(64) PRIMARY KEY,
        workspace_id VARCHAR(64) NOT NULL DEFAULT 'ws-default-command-center',
        name VARCHAR(255) NOT NULL,
        description TEXT,
        nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
        edges JSONB NOT NULL DEFAULT '[]'::jsonb,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS workflow_executions (
        id VARCHAR(64) PRIMARY KEY,
        workflow_id VARCHAR(64) NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
        workspace_id VARCHAR(64) NOT NULL DEFAULT 'ws-default-command-center',
        status VARCHAR(32) NOT NULL DEFAULT 'RUNNING',
        current_node_id VARCHAR(64),
        node_states JSONB NOT NULL DEFAULT '{}'::jsonb,
        context_data JSONB NOT NULL DEFAULT '{}'::jsonb,
        started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP WITH TIME ZONE
      );
    `);
  });

  afterAll(async () => {
    if (createdWorkflowId) {
      await WorkflowEngine.deleteWorkflow(createdWorkflowId);
    }
  });

  it('GET /api/workflows/templates should return pre-configured DAG templates', async () => {
    const res = await request(app).get('/api/workflows/templates');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);

    const secTemplate = res.body.data.find((t: any) => t.id === 'wf-security-audit-dag');
    expect(secTemplate).toBeDefined();
    expect(secTemplate.nodes.length).toBeGreaterThan(3);
    expect(secTemplate.edges.length).toBeGreaterThan(2);
  });

  it('POST /api/workflows should reject workflows with circular dependency cycles', async () => {
    const cyclicWorkflow = {
      name: 'Cyclic Graph',
      nodes: [
        { id: 'node-a', type: 'TRIGGER', label: 'Node A', position: { x: 0, y: 0 }, config: {} },
        { id: 'node-b', type: 'ACTION', label: 'Node B', position: { x: 100, y: 0 }, config: {} }
      ],
      edges: [
        { id: 'e1', source: 'node-a', target: 'node-b' },
        { id: 'e2', source: 'node-b', target: 'node-a' } // Cycle A -> B -> A
      ]
    };

    const res = await request(app).post('/api/workflows').send(cyclicWorkflow);
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/siklus|circular/i);
  });

  it('POST /api/workflows should successfully create a valid DAG workflow', async () => {
    const validWorkflow = {
      name: 'Test CI/CD Quality DAG',
      description: 'Trigger ➔ Action Test ➔ Alert Notification',
      nodes: [
        { id: 'n-trig', type: 'TRIGGER', label: 'Manual Trigger', position: { x: 50, y: 100 }, config: { input: 'unit-test' } },
        { id: 'n-action', type: 'ACTION', label: 'Run Echo', position: { x: 250, y: 100 }, config: { toolName: 'bash_exec', params: { command: 'echo "BUILD_OK"' } } },
        { id: 'n-approval', type: 'HUMAN_APPROVAL', label: 'Gate Approval', position: { x: 450, y: 100 }, config: { reason: 'Persetujuan rilis' } }
      ],
      edges: [
        { id: 'e1', source: 'n-trig', target: 'n-action' },
        { id: 'e2', source: 'n-action', target: 'n-approval' }
      ]
    };

    const res = await request(app).post('/api/workflows').send(validWorkflow);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.name).toBe('Test CI/CD Quality DAG');

    createdWorkflowId = res.body.data.id;
  });

  it('GET /api/workflows should list the created workflow', async () => {
    const res = await request(app).get('/api/workflows');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const found = res.body.data.find((w: any) => w.id === createdWorkflowId);
    expect(found).toBeDefined();
    expect(found.nodes.length).toBe(3);
  });

  it('POST /api/workflows/:id/execute should start DAG workflow execution', async () => {
    const res = await request(app).post(`/api/workflows/${createdWorkflowId}/execute`).send({
      branch: 'main',
      author: 'Tester'
    });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.workflowId).toBe(createdWorkflowId);
    expect(res.body.data.status).toBe('RUNNING');

    createdExecutionId = res.body.data.id;
  });

  it('GET /api/workflows/executions/:id should return execution state and context', async () => {
    const res = await request(app).get(`/api/workflows/executions/${createdExecutionId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(createdExecutionId);
    expect(res.body.data.nodeStates).toBeDefined();
  });

  it('POST /api/workflows/executions/:id/approve should validate approval request', async () => {
    // Missing approved boolean
    const badRes = await request(app).post(`/api/workflows/executions/${createdExecutionId}/approve`).send({});
    expect(badRes.status).toBe(400);
  });

  it('DELETE /api/workflows/:id should delete workflow cleanly', async () => {
    const res = await request(app).delete(`/api/workflows/${createdWorkflowId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const verify = await request(app).get(`/api/workflows/${createdWorkflowId}`);
    expect(verify.status).toBe(404);
    createdWorkflowId = '';
  });
});
