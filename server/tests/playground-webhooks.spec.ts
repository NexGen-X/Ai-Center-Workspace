import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';

describe('Playground Benchmark & Webhook Dispatcher API', () => {
  it('GET /api/webhooks/info should return webhook documentation', async () => {
    const res = await request(app).get('/api/webhooks/info');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.endpoints).toHaveProperty('dispatchTask');
  });

  it('POST /api/webhooks/dispatch-task should validate and create a task', async () => {
    const res = await request(app)
      .post('/api/webhooks/dispatch-task')
      .send({
        title: 'CI/CD Automated Code Quality Gate',
        description: 'Lint and test execution validation via external webhook pipeline.',
        priority: 'HIGH',
        autoExecute: false
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('taskId');
  });

  it('POST /api/playground/execute should reject empty prompt with 400', async () => {
    const res = await request(app)
      .post('/api/playground/execute')
      .send({
        prompt: '',
        targets: []
      });

    expect(res.status).toBe(400);
  });
});
