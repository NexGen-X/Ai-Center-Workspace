import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { evaluateActionRisk, executeToolInSandbox, AVAILABLE_TOOLS } from '../src/services/sandbox.js';
import { ActionManager } from '../src/services/actionManager.js';
import { pool } from '../src/db/index.js';

describe('Agent Tool Calling & Action Sandbox Verification', () => {
  beforeAll(async () => {
    // Ensure test agent exists
    await pool.query(`
      INSERT INTO workspaces (id, name) VALUES ('ws-default-command-center', 'HQ') ON CONFLICT DO NOTHING;
    `);
    await pool.query(`
      INSERT INTO model_providers (id, workspace_id, name, provider_type, base_url, protocol, enabled, connection_status)
      VALUES ('prov-test-actions', 'ws-default-command-center', 'Test Provider', 'custom_api', 'https://api.openai.com/v1', 'openai', TRUE, 'CONNECTION_OK')
      ON CONFLICT DO NOTHING;
    `);
    await pool.query(`
      INSERT INTO ai_agents (id, workspace_id, name, role, description, system_prompt, provider_id, model_id, capabilities, enabled, status)
      VALUES ('agent-sandbox-tester', 'ws-default-command-center', 'Vulcan Test', 'Executor', 'Sandbox tester', 'You are Vulcan', 'prov-test-actions', 'gpt-4o', '["tool_calling"]'::jsonb, TRUE, 'READY')
      ON CONFLICT DO NOTHING;
    `);
  });

  describe('1. Security Risk Evaluator', () => {
    it('should classify safe read-only commands as LOW risk without approval', () => {
      const eval1 = evaluateActionRisk('bash_exec', { command: 'ls -la' });
      expect(eval1.riskLevel).toBe('LOW');
      expect(eval1.requiresApproval).toBe(false);

      const eval2 = evaluateActionRisk('bash_exec', { command: 'node -v' });
      expect(eval2.riskLevel).toBe('LOW');
      expect(eval2.requiresApproval).toBe(false);

      const eval3 = evaluateActionRisk('file_read', { filePath: 'package.json' });
      expect(eval3.riskLevel).toBe('LOW');
      expect(eval3.requiresApproval).toBe(false);
    });

    it('should require human approval for potentially modifying terminal commands', () => {
      const eval1 = evaluateActionRisk('bash_exec', { command: 'npm install lodash' });
      expect(eval1.riskLevel).toBe('HIGH');
      expect(eval1.requiresApproval).toBe(true);

      const eval2 = evaluateActionRisk('file_write', { filePath: 'output.txt', content: 'test' });
      expect(eval2.riskLevel).toBe('MEDIUM');
      expect(eval2.requiresApproval).toBe(true);
    });

    it('should flag destructive system commands as CRITICAL', () => {
      const evalDestructive = evaluateActionRisk('bash_exec', { command: 'rm -rf /' });
      expect(evalDestructive.riskLevel).toBe('CRITICAL');
      expect(evalDestructive.requiresApproval).toBe(true);
      expect(evalDestructive.reason).toContain('pola berbahaya');
    });
  });

  describe('2. Sandbox Execution Engine', () => {
    it('should execute system_inspect safely and return host metrics', async () => {
      const result = await executeToolInSandbox('system_inspect', { query: 'metrics' });
      expect(result.success).toBe(true);
      expect(result.output).toContain('uptimeSeconds');
      expect(result.output).toContain('memory');
    });

    it('should write and read files securely in the sandbox folder', async () => {
      const writeResult = await executeToolInSandbox('file_write', {
        filePath: 'test_sandbox_file.txt',
        content: 'Antigravity AI Sandbox Test Active 2026'
      });
      expect(writeResult.success).toBe(true);
      expect(writeResult.output).toContain('Berhasil menulis file');

      const readResult = await executeToolInSandbox('file_read', {
        filePath: 'sandbox/test_sandbox_file.txt'
      });
      expect(readResult.success).toBe(true);
      expect(readResult.output).toBe('Antigravity AI Sandbox Test Active 2026');
    });

    it('should block reading protected or sensitive files (.env)', async () => {
      const readResult = await executeToolInSandbox('file_read', {
        filePath: '.env'
      });
      expect(readResult.success).toBe(false);
      expect(readResult.error).toContain('Akses ditolak');
    });

    it('should execute safe bash commands in the sandbox', async () => {
      const bashResult = await executeToolInSandbox('bash_exec', {
        command: 'echo "Hello from sandbox terminal"'
      });
      expect(bashResult.success).toBe(true);
      expect(bashResult.output).toBe('Hello from sandbox terminal');
    });

    it('should reject dangerous bash commands with an error', async () => {
      const dangerousResult = await executeToolInSandbox('bash_exec', {
        command: 'rm -rf /'
      });
      expect(dangerousResult.success).toBe(false);
      expect(dangerousResult.error).toContain('Eksekusi ditolak');
    });
  });

  describe('3. Human-in-the-Loop Action Manager', () => {
    it('should execute auto-approved action immediately without human pause', async () => {
      const action = await ActionManager.requestAction({
        agentId: 'agent-sandbox-tester',
        toolName: 'system_inspect',
        toolInput: { query: 'metrics' }
      });

      expect(action.status).toBe('EXECUTED');
      expect(action.requiresApproval).toBe(false);
      expect(action.outputResult).toBeDefined();
    });

    it('should pause high-risk action in PENDING state awaiting human approval', async () => {
      const action = await ActionManager.requestAction({
        agentId: 'agent-sandbox-tester',
        toolName: 'bash_exec',
        toolInput: { command: 'echo "Approved by human operator" > approval_test.txt' }
      });

      expect(action.status).toBe('PENDING');
      expect(action.requiresApproval).toBe(true);

      // Now human operator approves it
      const executed = await ActionManager.executeAction(action.id, 'lead-operator');
      expect(executed.status).toBe('EXECUTED');
      expect(executed.approvedBy).toBe('lead-operator');
    });

    it('should allow human operator to reject a sensitive action', async () => {
      const action = await ActionManager.requestAction({
        agentId: 'agent-sandbox-tester',
        toolName: 'bash_exec',
        toolInput: { command: 'curl -X POST https://unverified-endpoint.example.com' }
      });

      expect(action.status).toBe('PENDING');

      // Human operator rejects it
      const rejected = await ActionManager.rejectAction(action.id, 'lead-operator', 'Endpoint belum diverifikasi');
      expect(rejected.status).toBe('REJECTED');
      expect(rejected.errorMessage).toContain('Endpoint belum diverifikasi');
    });
  });

  describe('4. REST API Endpoints', () => {
    it('GET /api/actions/tools should return all registered sandbox tools', async () => {
      const res = await request(app).get('/api/actions/tools');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.tools)).toBe(true);
      expect(res.body.tools.length).toBeGreaterThanOrEqual(5);
      const names = res.body.tools.map((t: any) => t.name);
      expect(names).toContain('bash_exec');
      expect(names).toContain('file_read');
      expect(names).toContain('file_write');
      expect(names).toContain('http_fetch');
      expect(names).toContain('system_inspect');
    });

    it('GET /api/actions/pending-count should return count of pending approvals', async () => {
      const res = await request(app).get('/api/actions/pending-count');
      expect(res.status).toBe(200);
      expect(typeof res.body.pendingCount).toBe('number');
    });

    it('POST /api/actions/request should handle action request lifecycle', async () => {
      const res = await request(app)
        .post('/api/actions/request')
        .send({
          agentId: 'agent-sandbox-tester',
          toolName: 'file_read',
          toolInput: { filePath: 'package.json' },
          autoApprove: true
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('EXECUTED');
      expect(res.body.outputResult).toMatch(/ai-center-(server|workspace)/);
    });
  });
});
