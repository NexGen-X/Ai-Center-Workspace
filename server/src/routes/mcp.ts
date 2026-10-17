/**
 * Model Context Protocol (MCP) Router — AI Center
 * Endpoints for managing MCP server connections, discovering tools, and executing MCP tools.
 */

import { Router, Request, Response } from 'express';
import { McpClientService, POPULAR_MCP_TEMPLATES } from '../services/mcpClientService.js';
import { systemLogger } from '../services/logger.js';
import { requireAuth } from '../middleware/auth.js';

export const mcpRouter = Router();

// GET /api/mcp/servers - List all registered MCP servers
mcpRouter.get('/servers', async (_req: Request, res: Response) => {
  try {
    const servers = await McpClientService.getAllServers();
    res.json({
      success: true,
      data: servers
    });
  } catch (err: any) {
    systemLogger.error('API', 'Failed to retrieve MCP servers', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// GET /api/mcp/servers/:id - Get specific MCP server details
mcpRouter.get('/servers/:id', async (req: Request, res: Response) => {
  try {
    const server = await McpClientService.getServerById(req.params.id);
    if (!server) {
      return res.status(404).json({ error: 'MCP server not found' });
    }
    res.json({
      success: true,
      data: server
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/mcp/servers - Register a new MCP server
mcpRouter.post('/servers', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, description, transport, command, args, env, url, enabled } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Field "name" is required' });
    }

    if (transport === 'sse' && !url) {
      return res.status(400).json({ error: 'Field "url" is required for SSE transport' });
    }

    if (transport !== 'sse' && !command) {
      return res.status(400).json({ error: 'Field "command" is required for stdio transport' });
    }

    const server = await McpClientService.registerServer({
      name,
      description,
      transport: transport || 'stdio',
      command,
      args,
      env,
      url,
      enabled
    });

    res.status(201).json({
      success: true,
      data: server
    });
  } catch (err: any) {
    systemLogger.error('API', 'Failed to register MCP server', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/mcp/servers/:id - Update an MCP server configuration
mcpRouter.put('/servers/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const updated = await McpClientService.updateServer(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'MCP server not found' });
    }
    res.json({
      success: true,
      data: updated
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/mcp/servers/:id - Delete an MCP server
mcpRouter.delete('/servers/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const deleted = await McpClientService.deleteServer(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'MCP server not found' });
    }
    res.json({
      success: true,
      message: 'MCP server deleted successfully'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/mcp/servers/:id/test - Test connection, run initialize handshake & refresh tools
mcpRouter.post('/servers/:id/test', requireAuth, async (req: Request, res: Response) => {
  try {
    const testResult = await McpClientService.testAndRefreshServer(req.params.id);
    res.json({
      success: testResult.success,
      data: testResult
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// GET /api/mcp/tools - Aggregate all available tools across enabled servers
mcpRouter.get('/tools', async (_req: Request, res: Response) => {
  try {
    const tools = await McpClientService.getAllAvailableTools();
    res.json({
      success: true,
      data: tools
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/mcp/tools/call - Invoke an MCP tool
mcpRouter.post('/tools/call', requireAuth, async (req: Request, res: Response) => {
  try {
    const { serverId, toolName, arguments: toolArgs } = req.body;

    if (!serverId || !toolName) {
      return res.status(400).json({ error: 'Fields "serverId" and "toolName" are required' });
    }

    const result = await McpClientService.callTool(serverId, toolName, toolArgs || {});
    res.json({
      success: true,
      data: result
    });
  } catch (err: any) {
    systemLogger.error('API', `Tool invocation error: ${req.body?.toolName}`, err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// GET /api/mcp/templates - List popular pre-configured MCP templates
mcpRouter.get('/templates', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: POPULAR_MCP_TEMPLATES
  });
});
