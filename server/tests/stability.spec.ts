import { describe, it, expect, vi } from 'vitest';
import { pool, checkDatabaseHealth } from '../src/db/index.js';
import { realtimeHub } from '../src/services/realtime.js';
import { executeAgentTask } from '../src/services/orchestrator.js';
import { createRateLimiter } from '../src/middleware/rateLimiter.js';
import { executeToolInSandbox } from '../src/services/sandbox.js';
import request from 'supertest';
import { app } from '../src/index.js';

describe('Project Stability & Reliability Suite', () => {
  describe('Database Pool Resilience & Health Monitoring', () => {
    it('should have an error event listener attached to prevent idle client crash', () => {
      const listeners = pool.listeners('error');
      expect(listeners.length).toBeGreaterThan(0);
    });

    it('should execute simple query without connection leakage', async () => {
      const res = await pool.query('SELECT 1 as alive');
      expect(res.rows[0].alive).toBe(1);
    });

    it('checkDatabaseHealth should return ok: true and low latency', async () => {
      const health = await checkDatabaseHealth();
      expect(health.ok).toBe(true);
      expect(typeof health.latencyMs).toBe('number');
      expect(health.latencyMs).toBeLessThan(1000);
    });
  });

  describe('RealtimeHub SSE Connection & Keep-Alive Stability', () => {
    it('should add client and clean up when client disconnects or errors', () => {
      const initialCount = realtimeHub.getClientCount();
      
      const mockCloseListeners: (() => void)[] = [];
      const mockErrorListeners: (() => void)[] = [];

      const mockRes: any = {
        write: vi.fn(),
        on: vi.fn((event: string, callback: () => void) => {
          if (event === 'close') mockCloseListeners.push(callback);
          if (event === 'error') mockErrorListeners.push(callback);
        }),
        end: vi.fn()
      };

      realtimeHub.addClient('test-stability-client-1', mockRes);
      expect(realtimeHub.getClientCount()).toBe(initialCount + 1);
      expect(mockRes.write).toHaveBeenCalledWith(expect.stringContaining('event: connected'));

      // Simulate client close event
      mockCloseListeners.forEach(fn => fn());
      expect(realtimeHub.getClientCount()).toBe(initialCount);
    });

    it('should cleanly broadcast and ignore dropped clients without throwing', () => {
      const mockRes: any = {
        write: vi.fn().mockImplementation(() => {
          throw new Error('EPIPE: broken pipe');
        }),
        on: vi.fn(),
        end: vi.fn()
      };

      realtimeHub.addClient('broken-client', mockRes);
      expect(() => {
        realtimeHub.broadcast('test.event', { message: 'hello' });
      }).not.toThrow();
    });
  });

  describe('Orchestrator Exception Recovery & Agent Lock Prevention', () => {
    it('should restore agent to READY status even if an unknown or failing adapter is invoked', async () => {
      const agentRes = await pool.query('SELECT id, status FROM ai_agents LIMIT 1');
      if (agentRes.rows.length === 0) return;

      const agentId = agentRes.rows[0].id;

      await pool.query("UPDATE ai_agents SET status = 'READY' WHERE id = $1", [agentId]);

      const run = await executeAgentTask(agentId, 'Simulate stability test run');
      expect(run).toBeDefined();
      expect(run.status).toBeDefined();

      const verifyRes = await pool.query('SELECT status FROM ai_agents WHERE id = $1', [agentId]);
      expect(verifyRes.rows[0].status).toBe('READY');
    });
  });

  describe('HTTP Security Headers & Information Leakage Defense', () => {
    it('should enforce security headers and remove X-Powered-By', async () => {
      const res = await request(app).get('/healthz');
      expect(res.status).toBe(200);
      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['strict-transport-security']).toContain('max-age=');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    it('GET /healthz should include database status and uptime telemetry', async () => {
      const res = await request(app).get('/healthz');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.database).toBe('connected');
      expect(typeof res.body.uptimeSeconds).toBe('number');
      expect(new Date(res.body.timestamp).getTime()).not.toBeNaN();
    });
  });

  describe('Rate Limiter Protection Against DoS & Brute Force', () => {
    it('should track hits and trigger 429 when max threshold is exceeded', () => {
      const limiter = createRateLimiter({
        windowMs: 10000,
        max: 3,
        skipInTests: false
      });

      const mockReq: any = { ip: '192.0.2.1', socket: { remoteAddress: '192.0.2.1' }, headers: {} };
      const headersSet: Record<string, any> = {};
      const mockRes: any = {
        setHeader: vi.fn((k, v) => { headersSet[k] = v; }),
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };
      const nextFn = vi.fn();

      // Hit 1
      limiter(mockReq, mockRes, nextFn);
      expect(nextFn).toHaveBeenCalledTimes(1);

      // Hit 2
      limiter(mockReq, mockRes, nextFn);
      expect(nextFn).toHaveBeenCalledTimes(2);

      // Hit 3
      limiter(mockReq, mockRes, nextFn);
      expect(nextFn).toHaveBeenCalledTimes(3);

      // Hit 4 -> Should be blocked with 429
      limiter(mockReq, mockRes, nextFn);
      expect(nextFn).toHaveBeenCalledTimes(3); // Not called again
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({ code: 'RATE_LIMIT_EXCEEDED' })
      }));
    });
  });

  describe('Sandbox Execution Guardrails & Path Confinement', () => {
    it('should strictly block directory traversal attempts escaping workspace in file_read', async () => {
      const traversalResult = await executeToolInSandbox('file_read', {
        filePath: '../../../../etc/hosts'
      });
      expect(traversalResult.success).toBe(false);
      expect(traversalResult.error).toContain('Akses ditolak');
    });

    it('bash_exec child process should not leak DATABASE_URL in environment', async () => {
      const envCheck = await executeToolInSandbox('bash_exec', {
        command: 'echo "DB=$DATABASE_URL"'
      });
      expect(envCheck.success).toBe(true);
      expect(envCheck.output).toBe('DB=');
      expect(envCheck.output).not.toContain('postgres://');
    });
  });
});
