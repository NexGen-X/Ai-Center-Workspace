import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { pool } from '../src/db/index.js';
import { executeToolInSandbox } from '../src/services/sandbox.js';
import { ActionManager } from '../src/services/actionManager.js';

describe('No-Code Agent Skill Builder & Dynamic Tool Studio API', () => {
  let createdSkillId = '';
  const testSkillName = `test_skill_${Date.now().toString().slice(-6)}`;
  const testRestSkillName = `test_rest_${Date.now().toString().slice(-6)}`;

  afterAll(async () => {
    await pool.query(
      "DELETE FROM custom_agent_skills WHERE name LIKE 'test_%' OR id = $1;",
      [createdSkillId]
    );
  });

  it('POST /api/skills should reject invalid skill names and reserved built-in tool names', async () => {
    // 1. Invalid name format (uppercase, space)
    const res1 = await request(app).post('/api/skills').send({
      name: 'INVALID NAME!',
      displayName: 'Invalid Skill',
      description: 'Testing validation'
    });
    expect(res1.status).toBe(400);
    expect(res1.body.error).toContain('huruf kecil');

    // 2. Collision with built-in tool
    const res2 = await request(app).post('/api/skills').send({
      name: 'bash_exec',
      displayName: 'Override Bash',
      description: 'Should be rejected'
    });
    expect(res2.status).toBe(400);
    expect(res2.body.error).toContain('tool bawaan sistem');
  });

  it('POST /api/skills should create dynamic skill with mock response and parameter schema', async () => {
    const res = await request(app).post('/api/skills').send({
      name: testSkillName,
      displayName: 'Customer Greeting Generator',
      description: 'Menghasilkan sapaan hangat kepada pelanggan berdasarkan nama dan bahasa',
      category: 'CUSTOM',
      riskLevel: 'LOW',
      executionType: 'MOCK_RESPONSE',
      parametersSchema: {
        customerName: {
          type: 'string',
          description: 'Nama pelanggan',
          required: true
        },
        language: {
          type: 'string',
          description: 'Bahasa: ID atau EN',
          required: false,
          defaultValue: 'ID'
        }
      },
      mockOutputTemplate: '{"greeting":"Halo {{customerName}}, selamat datang di AI Command Center! (Bahasa: {{language}})","code":200}'
    });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe(testSkillName);
    expect(res.body.executionType).toBe('MOCK_RESPONSE');
    expect(res.body.parametersSchema.customerName.required).toBe(true);

    createdSkillId = res.body.id;
  });

  it('POST /api/skills/:id/test should validate required parameters and interpolate mock template', async () => {
    // 1. Missing required parameter should fail
    const resFail = await request(app).post(`/api/skills/${createdSkillId}/test`).send({
      input: { language: 'EN' }
    });
    expect(resFail.status).toBe(400);
    expect(resFail.body.error).toContain('customerName');

    // 2. Valid execution with interpolation
    const resSuccess = await request(app).post(`/api/skills/${createdSkillId}/test`).send({
      input: { customerName: 'Budi Santoso', language: 'ID' }
    });
    expect(resSuccess.status).toBe(200);
    expect(resSuccess.body.success).toBe(true);
    expect(resSuccess.body.output.greeting).toContain('Budi Santoso');
    expect(resSuccess.body.output.greeting).toContain('Bahasa: ID');
  });

  it('POST /api/skills should create REST_API skill and block SSRF on cloud metadata endpoints', async () => {
    const createRes = await request(app).post('/api/skills').send({
      name: testRestSkillName,
      displayName: 'SSRF Test Skill',
      description: 'Mencoba mengakses cloud metadata',
      category: 'NETWORK',
      riskLevel: 'HIGH',
      requiresApproval: true,
      executionType: 'REST_API',
      restConfig: {
        endpointUrl: 'http://169.254.169.254/latest/meta-data/{{category}}',
        method: 'GET'
      },
      parametersSchema: {
        category: { type: 'string', description: 'Metadata path', required: true }
      }
    });

    expect(createRes.status).toBe(201);
    const restSkillId = createRes.body.id;

    // Test execution should be blocked by anti-SSRF
    const testRes = await request(app).post(`/api/skills/${restSkillId}/test`).send({
      input: { category: 'iam' }
    });
    expect(testRes.status).toBe(200);
    expect(testRes.body.success).toBe(false);
    expect(testRes.body.error).toContain('SSRF Blocked');

    // Clean up
    await request(app).delete(`/api/skills/${restSkillId}`);
  });

  it('GET /api/skills and GET /api/skills/:id should retrieve custom skills', async () => {
    const resList = await request(app).get('/api/skills');
    expect(resList.status).toBe(200);
    expect(Array.isArray(resList.body)).toBe(true);
    expect(resList.body.some((s: any) => s.id === createdSkillId)).toBe(true);

    const resSingle = await request(app).get(`/api/skills/${createdSkillId}`);
    expect(resSingle.status).toBe(200);
    expect(resSingle.body.name).toBe(testSkillName);
  });

  it('PUT /api/skills/:id should update skill fields and permissions', async () => {
    const res = await request(app).put(`/api/skills/${createdSkillId}`).send({
      displayName: 'Customer Greeting Generator V2',
      riskLevel: 'MEDIUM',
      allowedAgentIds: ['agent-devops']
    });

    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe('Customer Greeting Generator V2');
    expect(res.body.riskLevel).toBe('MEDIUM');
    expect(res.body.allowedAgentIds).toContain('agent-devops');
  });

  it('executeToolInSandbox should execute custom dynamic skill by name', async () => {
    const toolRes = await executeToolInSandbox(testSkillName, {
      customerName: 'Siti Aminah',
      language: 'ID'
    }, { agentId: 'agent-devops' });

    expect(toolRes.success).toBe(true);
    expect(toolRes.output).toContain('Siti Aminah');
  });

  it('ActionManager.requestAction should evaluate custom skill risk level dynamically', async () => {
    const action = await ActionManager.requestAction({
      agentId: 'agent-devops',
      toolName: testSkillName,
      toolInput: { customerName: 'Rian' }
    });

    expect(action.toolName).toBe(testSkillName);
    // Was updated to MEDIUM in PUT test above
    expect(action.riskLevel).toBe('MEDIUM');
  });

  it('DELETE /api/skills/:id should delete custom skill', async () => {
    const res = await request(app).delete(`/api/skills/${createdSkillId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const checkRes = await request(app).get(`/api/skills/${createdSkillId}`);
    expect(checkRes.status).toBe(404);
    createdSkillId = '';
  });
});
