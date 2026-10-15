import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { pool } from '../src/db/index.js';
import { McpClientService } from '../src/services/mcpClientService.js';
import { executeToolInSandbox } from '../src/services/sandbox.js';

describe('Model Context Protocol (MCP) Client & Tool Engine', () => {
  let createdServerId: string = '';

  beforeAll(async () => {
    // Ensure table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mcp_servers (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        transport VARCHAR(32) NOT NULL DEFAULT 'stdio',
        command VARCHAR(255),
        args JSONB DEFAULT '[]'::jsonb,
        env JSONB DEFAULT '{}'::jsonb,
        url TEXT,
        status VARCHAR(32) DEFAULT 'DISCONNECTED',
        enabled BOOLEAN DEFAULT true,
        tools_cache JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
  });

  afterAll(async () => {
    if (createdServerId) {
      await McpClientService.deleteServer(createdServerId);
    }
    McpClientService.disconnectAll();
  });

  it('GET /api/mcp/templates should return popular pre-configured MCP templates', async () => {
    const res = await request(app).get('/api/mcp/templates');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);

    const fsTemplate = res.body.data.find((t: any) => t.id === 'template-filesystem');
    expect(fsTemplate).toBeDefined();
    expect(fsTemplate.transport).toBe('stdio');
    expect(fsTemplate.defaultTools).toContain('read_file');
  });

  it('POST /api/mcp/servers should reject incomplete payloads', async () => {
    const res = await request(app).post('/api/mcp/servers').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name/i);
  });

  it('POST /api/mcp/servers should register a new stdio MCP server', async () => {
    const res = await request(app).post('/api/mcp/servers').send({
      name: 'Test SQLite Explorer MCP',
      description: 'Test MCP server for database interrogation',
      transport: 'stdio',
      command: 'node',
      args: ['-e', 'console.log(JSON.stringify({jsonrpc:"2.0",id:1,result:{protocolVersion:"2024-11-05"}}))'],
      enabled: true
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.name).toBe('Test SQLite Explorer MCP');
    expect(res.body.data.status).toBe('DISCONNECTED');

    createdServerId = res.body.data.id;
  });

  it('GET /api/mcp/servers should list the newly registered server', async () => {
    const res = await request(app).get('/api/mcp/servers');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const found = res.body.data.find((s: any) => s.id === createdServerId);
    expect(found).toBeDefined();
    expect(found.name).toBe('Test SQLite Explorer MCP');
  });

  it('PUT /api/mcp/servers/:id should update server configuration', async () => {
    const res = await request(app).put(`/api/mcp/servers/${createdServerId}`).send({
      name: 'Renamed SQLite Explorer MCP',
      enabled: false
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Renamed SQLite Explorer MCP');
    expect(res.body.data.enabled).toBe(false);
  });

  it('POST /api/mcp/tools/call should validate required parameters and handle disabled server', async () => {
    // Missing parameters
    const badRes = await request(app).post('/api/mcp/tools/call').send({});
    expect(badRes.status).toBe(400);

    // Disabled server should reject execution
    const disabledRes = await request(app).post('/api/mcp/tools/call').send({
      serverId: createdServerId,
      toolName: 'read_query',
      arguments: { query: 'SELECT 1' }
    });
    expect(disabledRes.status).toBe(500);
    expect(disabledRes.body.error).toMatch(/disabled/i);
  });

  it('Sandbox executeToolInSandbox should handle mcp_call tool', async () => {
    // Re-enable server
    await McpClientService.updateServer(createdServerId, { enabled: true });

    // Calling non-existent or invalid tool triggers handled exception
    const result = await executeToolInSandbox('mcp_call', {
      serverId: 'non-existent-server-id',
      toolName: 'any_tool'
    }).catch(err => ({ success: false, output: '', durationMs: 0, error: err.message }));

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('DELETE /api/mcp/servers/:id should delete server cleanly', async () => {
    const res = await request(app).delete(`/api/mcp/servers/${createdServerId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify deletion
    const verifyRes = await request(app).get(`/api/mcp/servers/${createdServerId}`);
    expect(verifyRes.status).toBe(404);
    createdServerId = '';
  });
});
