import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';

describe('Autonomous Orchestrator & System Telemetry API', () => {
  it('GET /api/orchestrator/status should return status object', async () => {
    const res = await request(app).get('/api/orchestrator/status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('enabled');
    expect(res.body).toHaveProperty('isRunning');
    expect(res.body).toHaveProperty('activeTasksCount');
  });

  it('POST /api/orchestrator/toggle should enable and disable orchestrator', async () => {
    // Enable
    const resEnable = await request(app)
      .post('/api/orchestrator/toggle')
      .send({ enabled: true });
    expect(resEnable.status).toBe(200);
    expect(resEnable.body.enabled).toBe(true);

    // Disable back
    const resDisable = await request(app)
      .post('/api/orchestrator/toggle')
      .send({ enabled: false });
    expect(resDisable.status).toBe(200);
    expect(resDisable.body.enabled).toBe(false);
  });

  it('GET /api/monitoring/logs should be 404 for tenant security', async () => {
    const res = await request(app).get('/api/monitoring/logs?limit=50');
    expect(res.status).toBe(404);
  });

  it('GET /api/system/backup should be 404 for tenant security', async () => {
    const backupRes = await request(app).get('/api/system/backup');
    expect(backupRes.status).toBe(404);
  });
});
