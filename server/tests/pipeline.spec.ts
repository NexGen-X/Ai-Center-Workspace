import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';

describe('Multi-Agent Swarm Pipeline API', () => {
  it('GET /api/pipeline/templates should return pre-configured swarm templates', async () => {
    const res = await request(app).get('/api/pipeline/templates');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.templates)).toBe(true);
    expect(res.body.templates.length).toBeGreaterThanOrEqual(3);
    expect(res.body.templates[0]).toHaveProperty('id', 'feature-swarm');
    expect(res.body.templates[0].stages.length).toBe(3);
  });

  it('POST /api/pipeline/decompose should validate empty objective with 400', async () => {
    const res = await request(app)
      .post('/api/pipeline/decompose')
      .send({
        objective: ''
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('POST /api/pipeline/decompose should generate stage assignments for valid objective', async () => {
    const res = await request(app)
      .post('/api/pipeline/decompose')
      .send({
        title: 'Implement OAuth2 PKCE Authentication Swarm',
        objective: 'Rancang dan buat modul autentikasi OAuth2 PKCE lengkap dengan unit test dan verifikasi keamanan.',
        templateId: 'feature-swarm'
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('pipelineId');
    expect(res.body).toHaveProperty('stages');
    expect(Array.isArray(res.body.stages)).toBe(true);
    expect(res.body.stages.length).toBe(3);
    expect(res.body.stages[0]).toHaveProperty('agentId');
  });

  it('POST /api/pipeline/execute should reject empty stages with 400', async () => {
    const res = await request(app)
      .post('/api/pipeline/execute')
      .send({
        objective: 'Test swarm',
        stages: []
      });

    expect(res.status).toBe(400);
  });
});
