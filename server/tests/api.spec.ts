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

  it('GET /api/reports/summary should return FinOps analytics', async () => {
    const res = await request(app).get('/api/reports/summary?days=7');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('periodDays', 7);
    expect(res.body).toHaveProperty('totalRuns');
    expect(res.body).toHaveProperty('successRatePercent');
    expect(res.body).toHaveProperty('totalTokens');
    expect(res.body).toHaveProperty('estimatedTotalCostUsd');
    expect(res.body).toHaveProperty('agentMetrics');
    expect(Array.isArray(res.body.agentMetrics)).toBe(true);
  });

  it('CRUD /api/notifications should manage real-time alerts', async () => {
    // 1. Create notification
    const createRes = await request(app)
      .post('/api/notifications')
      .send({
        title: 'Uji Notifikasi Otomatis',
        message: 'Pengujian integrasi endpoint notifikasi command center',
        type: 'INFO'
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body).toHaveProperty('id');
    const notifId = createRes.body.id;

    // 2. Fetch list
    const listRes = await request(app).get('/api/notifications');
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveProperty('notifications');
    expect(listRes.body.unreadCount).toBeGreaterThan(0);

    // 3. Mark single as read
    const readRes = await request(app).post(`/api/notifications/${notifId}/read`);
    expect(readRes.status).toBe(200);
    expect(readRes.body.success).toBe(true);

    // 4. Mark all as read
    const readAllRes = await request(app).post('/api/notifications/read-all');
    expect(readAllRes.status).toBe(200);
    expect(readAllRes.body.success).toBe(true);
  });

  it('CRUD /api/documents should manage SOP & Knowledge Base', async () => {
    // 1. Create document
    const createRes = await request(app)
      .post('/api/documents')
      .send({
        title: 'SOP Deploy Kubernetes Cluster',
        content: '# SOP Panduan Deployment K8s\nLangkah-langkah deployment aman...',
        category: 'SOP',
        tags: ['DevOps', 'Kubernetes']
      });
    expect(createRes.status).toBe(201);
    const docId = createRes.body.id;
    expect(docId).toBeDefined();

    // 2. Get document by ID
    const getRes = await request(app).get(`/api/documents/${docId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.title).toBe('SOP Deploy Kubernetes Cluster');

    // 3. Update document
    const updateRes = await request(app)
      .put(`/api/documents/${docId}`)
      .send({ title: 'SOP Deploy Kubernetes Cluster (Updated)' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.title).toContain('(Updated)');

    // 4. Delete document
    const delRes = await request(app).delete(`/api/documents/${docId}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);
  });

  it('CRUD /api/projects with dynamic task progress computation', async () => {
    // 1. Create project
    const createProj = await request(app)
      .post('/api/projects')
      .send({
        name: 'Infrastruktur High-Availability & Disaster Recovery',
        description: 'Implementasi multi-zone failover dan sinkronisasi cluster',
        status: 'ACTIVE'
      });
    expect(createProj.status).toBe(201);
    const projId = createProj.body.id;
    expect(projId).toBeDefined();

    // 2. Create tasks linked to this project
    const task1 = await request(app)
      .post('/api/tasks')
      .send({
        title: 'Setup PostgreSQL Streaming Replication',
        projectId: projId,
        priority: 'HIGH'
      });
    expect(task1.status).toBe(201);

    const task2 = await request(app)
      .post('/api/tasks')
      .send({
        title: 'Konfigurasi Keepalived Virtual IP',
        projectId: projId,
        priority: 'CRITICAL'
      });
    expect(task2.status).toBe(201);

    // 3. Mark task1 as DONE to test 50% computed progress
    await request(app)
      .post(`/api/tasks/${task1.body.id}/transitions`)
      .send({ newStatus: 'IN_PROGRESS' });
    await request(app)
      .post(`/api/tasks/${task1.body.id}/transitions`)
      .send({ newStatus: 'DONE' });

    // 4. Get single project and verify calculated progress
    const getProj = await request(app).get(`/api/projects/${projId}`);
    expect(getProj.status).toBe(200);
    expect(getProj.body).toHaveProperty('project');
    expect(getProj.body).toHaveProperty('tasks');
    expect(getProj.body.project.totalTasks).toBe(2);
    expect(getProj.body.project.completedTasks).toBe(1);
    expect(getProj.body.project.progressPercentage).toBe(50);
    expect(getProj.body.tasks.length).toBe(2);

    // 5. Update project details
    const patchProj = await request(app)
      .patch(`/api/projects/${projId}`)
      .send({ status: 'COMPLETED', description: 'Implementasi selesai dan terverifikasi' });
    expect(patchProj.status).toBe(200);
    expect(patchProj.body.status).toBe('COMPLETED');

    // 6. Delete project
    const delProj = await request(app).delete(`/api/projects/${projId}`);
    expect(delProj.status).toBe(200);
    expect(delProj.body.success).toBe(true);

    // Cleanup tasks
    await request(app).delete(`/api/tasks/${task1.body.id}`);
    await request(app).delete(`/api/tasks/${task2.body.id}`);
  });

  it('CRUD /api/tasks extended operations (Details, Audit History, Update, Delete)', async () => {
    // 1. Create a task
    const createRes = await request(app)
      .post('/api/tasks')
      .send({
        title: 'Task Audit Trail Testing',
        description: 'Memastikan audit log tercatat saat perubahan atribut',
        priority: 'MEDIUM'
      });
    expect(createRes.status).toBe(201);
    const taskId = createRes.body.id;

    // 2. Update task details
    const updateRes = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .send({
        title: 'Task Audit Trail Testing (Updated)',
        priority: 'HIGH'
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.title).toContain('(Updated)');
    expect(updateRes.body.priority).toBe('HIGH');

    // 3. Get task details + runs + history
    const detailRes = await request(app).get(`/api/tasks/${taskId}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.task.title).toContain('(Updated)');
    expect(Array.isArray(detailRes.body.history)).toBe(true);
    expect(detailRes.body.history.length).toBeGreaterThan(0);

    // 4. Get task history directly
    const historyRes = await request(app).get(`/api/tasks/${taskId}/history`);
    expect(historyRes.status).toBe(200);
    expect(Array.isArray(historyRes.body)).toBe(true);
    expect(historyRes.body.length).toBeGreaterThan(0);

    // 5. Delete task
    const delRes = await request(app).delete(`/api/tasks/${taskId}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    // 6. Verify 404 after deletion
    const getDeleted = await request(app).get(`/api/tasks/${taskId}`);
    expect(getDeleted.status).toBe(404);
  });

  it('POST /api/agents/:id/execute should validate input and process runs', async () => {
    // Get existing agents
    const agentsRes = await request(app).get('/api/agents');
    expect(agentsRes.status).toBe(200);
    const targetAgent = agentsRes.body[0];
    expect(targetAgent).toBeDefined();

    // 1. Reject empty prompt
    const emptyPromptRes = await request(app)
      .post(`/api/agents/${targetAgent.id}/execute`)
      .send({ prompt: '' });
    expect(emptyPromptRes.status).toBe(400);

    // 2. Execute with valid prompt
    const executeRes = await request(app)
      .post(`/api/agents/${targetAgent.id}/execute`)
      .send({ prompt: 'Verifikasi status operasional agen command center' });
    expect(executeRes.status).toBe(200);
    expect(executeRes.body).toHaveProperty('id');
    expect(executeRes.body).toHaveProperty('status');
    expect(executeRes.body.agentId).toBe(targetAgent.id);

    // 3. Verify runs are accessible via GET /api/agents/:id/runs
    const runsRes = await request(app).get(`/api/agents/${targetAgent.id}/runs`);
    expect(runsRes.status).toBe(200);
    expect(Array.isArray(runsRes.body)).toBe(true);
    expect(runsRes.body.length).toBeGreaterThan(0);
  });
});
