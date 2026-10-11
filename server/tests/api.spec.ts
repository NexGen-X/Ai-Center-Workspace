import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { initializeDatabase } from '../src/db/index.js';

describe('AI Agent Command Center API Endpoints', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  it('GET /healthz should return ok', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/dashboard/summary should return comprehensive overview', async () => {
    const res = await request(app).get('/api/dashboard/summary');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('runningTasksCount');
    expect(res.body).toHaveProperty('completedTasksCount');
    expect(res.body).toHaveProperty('onlineAgentsCount');
    expect(res.body).toHaveProperty('totalAgentsCount');
    expect(res.body).toHaveProperty('serverMetrics');
    expect(res.body.serverMetrics).toHaveProperty('cpuUsagePercent');
  });

  it('GET /api/monitoring/summary should return live host metrics', async () => {
    const res = await request(app).get('/api/monitoring/summary');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('cpuUsagePercent');
    expect(res.body).toHaveProperty('memoryTotalBytes');
    expect(res.body).toHaveProperty('memoryUsagePercent');
    expect(res.body).toHaveProperty('uptimeSeconds');
  });

  it('GET /api/agents should list agents without leaking plain secrets', async () => {
    const res = await request(app).get('/api/agents');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    const firstAgent = res.body[0];
    expect(firstAgent).toHaveProperty('name');
    expect(firstAgent).toHaveProperty('role');
    expect(firstAgent).toHaveProperty('status');
    // Secret keys must never be in agents response
    expect(firstAgent).not.toHaveProperty('apiKey');
    expect(firstAgent).not.toHaveProperty('api_key_encrypted');
  });

  it('POST /api/tasks and status transition validation', async () => {
    // 1. Create task
    const createRes = await request(app)
      .post('/api/tasks')
      .send({
        title: 'Verifikasi QA Suite Integration',
        description: 'Uji transisi status dan integritas state machine task',
        priority: 'HIGH'
      });
    expect(createRes.status).toBe(201);
    const taskId = createRes.body.id;

    // 2. Legal transition: TODO -> IN_PROGRESS
    const transRes1 = await request(app)
      .post(`/api/tasks/${taskId}/transitions`)
      .send({ newStatus: 'IN_PROGRESS' });
    expect(transRes1.status).toBe(200);
    expect(transRes1.body.newStatus).toBe('IN_PROGRESS');

    // 3. Illegal transition: IN_PROGRESS -> INVALID_STATUS (should fail)
    const illegalRes = await request(app)
      .post(`/api/tasks/${taskId}/transitions`)
      .send({ newStatus: 'NON_EXISTENT_STATUS' });
    expect(illegalRes.status).toBe(400);

    // 4. Legal transition: IN_PROGRESS -> DONE
    const transRes2 = await request(app)
      .post(`/api/tasks/${taskId}/transitions`)
      .send({ newStatus: 'DONE' });
    expect(transRes2.status).toBe(200);
    expect(transRes2.body.newStatus).toBe('DONE');
  });

  it('POST /api/providers/test-connection with SSRF target should be blocked', async () => {
    const res = await request(app)
      .post('/api/providers/test-connection')
      .send({
        providerType: 'custom_api',
        baseUrl: 'http://169.254.169.254/secret',
        protocol: 'openai',
        apiKey: 'test-key'
      });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.status).toBe('CONNECTION_FAILED');
  });
});
