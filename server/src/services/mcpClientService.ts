/**
 * Model Context Protocol (MCP) Client Service — AI Center
 * Implements Anthropic MCP specification (JSON-RPC 2.0 over stdio & SSE transports).
 * Provides dynamic tool discovery, validation, and safe sandboxed invocation.
 */

import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { pool } from '../db/index.js';
import { systemLogger } from './logger.js';
import { v4 as uuidv4 } from 'uuid';
import {
  McpServer,
  McpTool,
  McpToolCallResult,
  McpServerTemplate,
  McpTransport
} from '../../../shared/types.js';

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timer: NodeJS.Timeout;
}

export const POPULAR_MCP_TEMPLATES: McpServerTemplate[] = [
  {
    id: 'template-filesystem',
    name: 'Filesystem MCP Server',
    description: 'Akses pembacaan dan penulisan berkas aman pada direktori yang ditentukan.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/root/Ai-Center-Workspace'],
    defaultTools: ['read_file', 'write_file', 'list_directory', 'directory_tree', 'move_file']
  },
  {
    id: 'template-fetch',
    name: 'Web Fetch & Scraper MCP',
    description: 'Mengunduh konten halaman web dan mengonversinya menjadi markdown terstruktur.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-fetch'],
    defaultTools: ['fetch']
  },
  {
    id: 'template-postgres',
    name: 'PostgreSQL Database MCP',
    description: 'Inspeksi skema relasional, tabel, dan eksekusi query PostgreSQL.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://routex:a8ad6064dad32fc6ec79f0378d6b8c1e@127.0.0.1:5432/ai_center'],
    defaultTools: ['query', 'list_tables', 'describe_table']
  },
  {
    id: 'template-memory',
    name: 'Knowledge Graph Memory MCP',
    description: 'Memori relasi entitas persisten berbasis graf konteks.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    defaultTools: ['create_entities', 'create_relations', 'read_graph', 'search_nodes']
  },
  {
    id: 'template-sqlite',
    name: 'SQLite Explorer MCP',
    description: 'Membaca dan memanipulasi database SQLite lokal.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sqlite', '--db', '/tmp/ai_center_scratch.db'],
    defaultTools: ['read_query', 'write_query', 'list_tables']
  }
];

class StdioMcpProcessConnection {
  private child: ChildProcessWithoutNullStreams | null = null;
  private pendingRequests = new Map<number | string, PendingRequest>();
  private nextRequestId = 1;
  private buffer = '';
  private initialized = false;

  constructor(
    public readonly serverId: string,
    public readonly command: string,
    public readonly args: string[],
    public readonly env: Record<string, string> = {}
  ) {}

  public async start(timeoutMs = 15000): Promise<void> {
    if (this.child) return;

    return new Promise((resolve, reject) => {
      try {
        const mergedEnv = {
          ...process.env,
          ...this.env
        };

        this.child = spawn(this.command, this.args, {
          env: mergedEnv,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let startTimeout: NodeJS.Timeout | null = setTimeout(() => {
          this.terminate();
          reject(new Error(`MCP Process timeout after ${timeoutMs}ms starting '${this.command}'`));
        }, timeoutMs);

        this.child.stdout.on('data', (chunk: Buffer) => {
          this.handleStdout(chunk.toString('utf-8'));
        });

        this.child.stderr.on('data', (errChunk: Buffer) => {
          systemLogger.warn('SYSTEM', `[Server ${this.serverId} STDERR]: ${errChunk.toString('utf-8').trim()}`);
        });

        this.child.on('error', (err) => {
          if (startTimeout) {
            clearTimeout(startTimeout);
            startTimeout = null;
          }
          systemLogger.error('SYSTEM', `Process spawn error for server ${this.serverId}`, err);
          this.rejectAllPending(err);
          reject(err);
        });

        this.child.on('close', (code) => {
          systemLogger.info('SYSTEM', `Process exited with code ${code} for server ${this.serverId}`);
          this.child = null;
          this.initialized = false;
          this.rejectAllPending(new Error(`MCP process exited with code ${code}`));
        });

        // Send JSON-RPC initialize handshake
        this.sendRequest('initialize', {
          protocolVersion: '2024-11-05',
          capabilities: {
            roots: { listChanged: true },
            sampling: {}
          },
          clientInfo: {
            name: 'AI-Center-MCP-Client',
            version: '1.0.0'
          }
        }, timeoutMs)
          .then(() => {
            // Send initialized notification
            this.sendNotification('notifications/initialized');
            this.initialized = true;
            if (startTimeout) {
              clearTimeout(startTimeout);
              startTimeout = null;
            }
            resolve();
          })
          .catch((initErr) => {
            if (startTimeout) {
              clearTimeout(startTimeout);
              startTimeout = null;
            }
            this.terminate();
            reject(initErr);
          });
      } catch (err: any) {
        reject(err);
      }
    });
  }

  private handleStdout(data: string): void {
    this.buffer += data;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      try {
        const json = JSON.parse(line);
        if (json.id !== undefined && this.pendingRequests.has(json.id)) {
          const req = this.pendingRequests.get(json.id)!;
          this.pendingRequests.delete(json.id);
          clearTimeout(req.timer);

          if (json.error) {
            req.reject(new Error(json.error.message || JSON.stringify(json.error)));
          } else {
            req.resolve(json.result);
          }
        }
      } catch {
        // Line might be non-JSON debug logging from server
      }
    }
  }

  public async sendRequest(method: string, params: any = {}, timeoutMs = 15000): Promise<any> {
    if (!this.child || !this.child.stdin.writable) {
      throw new Error(`MCP process for server ${this.serverId} is not running or writable`);
    }

    const id = this.nextRequestId++;
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      params
    }) + '\n';

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`MCP Request '${method}' timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timer });
      this.child!.stdin.write(payload);
    });
  }

  public sendNotification(method: string, params: any = {}): void {
    if (!this.child || !this.child.stdin.writable) return;
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      method,
      params
    }) + '\n';
    this.child.stdin.write(payload);
  }

  private rejectAllPending(err: Error): void {
    for (const [id, req] of this.pendingRequests.entries()) {
      clearTimeout(req.timer);
      req.reject(err);
    }
    this.pendingRequests.clear();
  }

  public isAlive(): boolean {
    return Boolean(this.child && !this.child.killed && this.initialized);
  }

  public terminate(): void {
    this.rejectAllPending(new Error('Connection terminated'));
    if (this.child) {
      try {
        this.child.kill('SIGTERM');
      } catch {
        // ignore
      }
      this.child = null;
    }
    this.initialized = false;
  }
}

export class McpClientService {
  private static activeConnections = new Map<string, StdioMcpProcessConnection>();

  /**
   * Retrieves all registered MCP servers from database
   */
  public static async getAllServers(): Promise<McpServer[]> {
    const res = await pool.query(`
      SELECT 
        id, name, description, transport, command, args, env, url, 
        status, enabled, tools_cache, created_at, updated_at
      FROM mcp_servers
      ORDER BY created_at ASC
    `);

    return res.rows.map(this.mapRowToMcpServer);
  }

  /**
   * Retrieves a specific MCP server by ID
   */
  public static async getServerById(id: string): Promise<McpServer | null> {
    const res = await pool.query(
      `SELECT * FROM mcp_servers WHERE id = $1`,
      [id]
    );
    if (res.rows.length === 0) return null;
    return this.mapRowToMcpServer(res.rows[0]);
  }

  /**
   * Registers a new MCP server
   */
  public static async registerServer(data: {
    id?: string;
    name: string;
    description?: string;
    transport?: McpTransport;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    url?: string;
    enabled?: boolean;
  }): Promise<McpServer> {
    const id = data.id || `mcp-${uuidv4().slice(0, 8)}`;
    const transport = data.transport || 'stdio';
    const enabled = data.enabled !== undefined ? data.enabled : true;
    const argsJson = JSON.stringify(data.args || []);
    const envJson = JSON.stringify(data.env || {});

    const res = await pool.query(
      `INSERT INTO mcp_servers (id, name, description, transport, command, args, env, url, enabled, status, tools_cache)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'DISCONNECTED', '[]'::jsonb)
       RETURNING *`,
      [
        id,
        data.name,
        data.description || null,
        transport,
        data.command || null,
        argsJson,
        envJson,
        data.url || null,
        enabled
      ]
    );

    systemLogger.info('SYSTEM', `Registered new MCP server: ${data.name} (${id})`);
    return this.mapRowToMcpServer(res.rows[0]);
  }

  /**
   * Updates an existing MCP server configuration
   */
  public static async updateServer(
    id: string,
    updates: Partial<{
      name: string;
      description: string;
      transport: McpTransport;
      command: string;
      args: string[];
      env: Record<string, string>;
      url: string;
      enabled: boolean;
    }>
  ): Promise<McpServer | null> {
    const existing = await this.getServerById(id);
    if (!existing) return null;

    // Disconnect active process if config changed
    this.disconnectServer(id);

    const name = updates.name !== undefined ? updates.name : existing.name;
    const description = updates.description !== undefined ? updates.description : existing.description;
    const transport = updates.transport !== undefined ? updates.transport : existing.transport;
    const command = updates.command !== undefined ? updates.command : existing.command;
    const argsJson = JSON.stringify(updates.args !== undefined ? updates.args : existing.args);
    const envJson = JSON.stringify(updates.env !== undefined ? updates.env : existing.env);
    const url = updates.url !== undefined ? updates.url : existing.url;
    const enabled = updates.enabled !== undefined ? updates.enabled : existing.enabled;

    const res = await pool.query(
      `UPDATE mcp_servers
       SET name = $1, description = $2, transport = $3, command = $4, args = $5,
           env = $6, url = $7, enabled = $8, updated_at = CURRENT_TIMESTAMP
       WHERE id = $9
       RETURNING *`,
      [name, description, transport, command, argsJson, envJson, url, enabled, id]
    );

    return this.mapRowToMcpServer(res.rows[0]);
  }

  /**
   * Deletes an MCP server and terminates connection
   */
  public static async deleteServer(id: string): Promise<boolean> {
    this.disconnectServer(id);
    const res = await pool.query(`DELETE FROM mcp_servers WHERE id = $1`, [id]);
    systemLogger.info('SYSTEM', `Deleted MCP server: ${id}`);
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Tests connection, completes handshake, and refreshes tools cache
   */
  public static async testAndRefreshServer(id: string): Promise<{
    success: boolean;
    server: McpServer;
    tools: McpTool[];
    error?: string;
  }> {
    const server = await this.getServerById(id);
    if (!server) {
      throw new Error(`MCP Server with id ${id} not found`);
    }

    try {
      let tools: McpTool[] = [];

      if (server.transport === 'stdio') {
        if (!server.command) {
          throw new Error('Command is required for stdio MCP transport');
        }

        // Recycle existing connection or create new
        this.disconnectServer(id);
        const conn = new StdioMcpProcessConnection(
          server.id,
          server.command,
          server.args,
          server.env
        );

        await conn.start(10000);
        this.activeConnections.set(id, conn);

        // Call tools/list
        const listResult = await conn.sendRequest('tools/list', {}, 8000);
        const rawTools: any[] = listResult?.tools || [];

        tools = rawTools.map((t) => ({
          serverId: server.id,
          serverName: server.name,
          name: t.name,
          description: t.description || '',
          inputSchema: t.inputSchema || { type: 'object', properties: {} }
        }));
      } else {
        // SSE transport testing
        if (!server.url) {
          throw new Error('URL is required for SSE MCP transport');
        }

        const resp = await fetch(server.url, {
          method: 'GET',
          headers: { Accept: 'text/event-stream, application/json' },
          signal: AbortSignal.timeout(6000)
        });

        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status} ${resp.statusText} connecting to SSE endpoint`);
        }
      }

      // Update DB status and tools_cache
      const updatedRes = await pool.query(
        `UPDATE mcp_servers
         SET status = 'CONNECTED', tools_cache = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [JSON.stringify(tools), id]
      );

      const updatedServer = this.mapRowToMcpServer(updatedRes.rows[0]);
      systemLogger.info('SYSTEM', `Server ${server.name} connected successfully. Discovered ${tools.length} tools.`);

      return {
        success: true,
        server: updatedServer,
        tools
      };
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to connect to MCP server';
      systemLogger.error('SYSTEM', `Error connecting to server ${server.name}`, err);

      await pool.query(
        `UPDATE mcp_servers
         SET status = 'ERROR', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id]
      );

      const updatedServer = (await this.getServerById(id))!;
      return {
        success: false,
        server: updatedServer,
        tools: [],
        error: errorMsg
      };
    }
  }

  /**
   * Invokes an MCP tool on the given server
   */
  public static async callTool(
    serverId: string,
    toolName: string,
    toolArgs: Record<string, any>
  ): Promise<McpToolCallResult> {
    const server = await this.getServerById(serverId);
    if (!server) {
      throw new Error(`MCP Server with id ${serverId} not found`);
    }

    if (!server.enabled) {
      throw new Error(`MCP Server '${server.name}' is currently disabled`);
    }

    if (server.transport === 'stdio') {
      let conn = this.activeConnections.get(serverId);
      if (!conn || !conn.isAlive()) {
        // Start on-demand
        conn = new StdioMcpProcessConnection(
          server.id,
          server.command || 'npx',
          server.args,
          server.env
        );
        await conn.start(10000);
        this.activeConnections.set(serverId, conn);
      }

      const res = await conn.sendRequest('tools/call', {
        name: toolName,
        arguments: toolArgs
      }, 20000);

      return {
        content: res?.content || [{ type: 'text', text: JSON.stringify(res) }],
        isError: Boolean(res?.isError)
      };
    } else {
      // HTTP/SSE endpoint execution
      const endpoint = `${server.url?.replace(/\/$/, '')}/tools/call`;
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: toolName,
          arguments: toolArgs
        }),
        signal: AbortSignal.timeout(20000)
      });

      if (!resp.ok) {
        throw new Error(`Remote MCP returned HTTP ${resp.status}: ${await resp.text()}`);
      }

      const json: any = await resp.json();
      return {
        content: json.content || [{ type: 'text', text: JSON.stringify(json) }],
        isError: Boolean(json.isError)
      };
    }
  }

  /**
   * Aggregates all available tools across all enabled servers
   */
  public static async getAllAvailableTools(): Promise<McpTool[]> {
    const servers = await this.getAllServers();
    const enabledServers = servers.filter((s) => s.enabled);
    const allTools: McpTool[] = [];

    for (const s of enabledServers) {
      if (Array.isArray(s.toolsCache)) {
        for (const t of s.toolsCache) {
          allTools.push({
            ...t,
            serverId: s.id,
            serverName: s.name
          });
        }
      }
    }

    return allTools;
  }

  public static disconnectServer(serverId: string): void {
    const conn = this.activeConnections.get(serverId);
    if (conn) {
      conn.terminate();
      this.activeConnections.delete(serverId);
    }
  }

  public static disconnectAll(): void {
    for (const [id, conn] of this.activeConnections.entries()) {
      conn.terminate();
    }
    this.activeConnections.clear();
  }

  private static mapRowToMcpServer(row: any): McpServer {
    let args: string[] = [];
    if (typeof row.args === 'string') {
      try { args = JSON.parse(row.args); } catch { args = []; }
    } else if (Array.isArray(row.args)) {
      args = row.args;
    }

    let env: Record<string, string> = {};
    if (typeof row.env === 'string') {
      try { env = JSON.parse(row.env); } catch { env = {}; }
    } else if (typeof row.env === 'object' && row.env !== null) {
      env = row.env;
    }

    let toolsCache: McpTool[] = [];
    if (typeof row.tools_cache === 'string') {
      try { toolsCache = JSON.parse(row.tools_cache); } catch { toolsCache = []; }
    } else if (Array.isArray(row.tools_cache)) {
      toolsCache = row.tools_cache;
    }

    return {
      id: row.id,
      name: row.name,
      description: row.description || undefined,
      transport: row.transport,
      command: row.command || undefined,
      args,
      env,
      url: row.url || undefined,
      status: row.status,
      enabled: Boolean(row.enabled),
      toolsCache,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
    };
  }
}
