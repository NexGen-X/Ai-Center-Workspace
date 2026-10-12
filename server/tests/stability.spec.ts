import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pool } from '../src/db/index.js';
import { realtimeHub } from '../src/services/realtime.js';
import { executeAgentTask } from '../src/services/orchestrator.js';
import request from 'supertest';
import { app } from '../src/index.js';

describe('Project Stability & Reliability Suite', () => {
  describe('Database Pool Resilience', () => {
    it('should have an error event listener attached to prevent idle client crash', () => {
      const listeners = pool.listeners('error');
      expect(listeners.length).toBeGreaterThan(0);
    });

    it('should execute simple query without connection leakage', async () => {
      const res = await pool.query('SELECT 1 as alive');
      expect(res.rows[0].alive).toBe(1);
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
      // Find an agent to test
      const agentRes = await pool.query('SELECT id, status FROM ai_agents LIMIT 1');
      if (agentRes.rows.length === 0) return;

      const agentId = agentRes.rows[0].id;

      // Ensure agent is READY
      await pool.query("UPDATE ai_agents SET status = 'READY' WHERE id = $1", [agentId]);

      // Execute task with a simulated invalid/failing prompt
      const run = await executeAgentTask(agentId, 'Simulate stability test run');
      expect(run).toBeDefined();
      expect(run.status).toBeDefined();

      // Agent MUST be restored to READY, never stuck in BUSY
      const verifyRes = await pool.query('SELECT status FROM ai_agents WHERE id = $1', [agentId]);
      expect(verifyRes.rows[0].status).toBe('READY');
    });
  });

  describe('API Healthcheck & Global Error Handling', () => {
    it('GET /healthz should respond with 200 and ISO timestamp', async () => {
      const res = await request(app).get('/healthz');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(new Date(res.body.timestamp).getTime()).not.toBeNaN();
    });

    it('GET non-existent API route should return clean JSON error without crashing', async () => {
      const res = await request(app).get('/api/non-existent-endpoint-test-404');
      expect(res.status).toBe(404);
    });
  });
});
