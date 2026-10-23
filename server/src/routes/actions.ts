/**
 * Agent Actions & Tool Calling Router — AI Agent Command Center
 */

import { Router, Request, Response } from 'express';
import { ActionManager } from '../services/actionManager.js';
import { AVAILABLE_TOOLS, SANDBOX_DIR } from '../services/sandbox.js';
import { pool } from '../db/index.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);
const router = Router();

// GET /api/actions — List recent actions
router.get('/', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const actions = await ActionManager.listActions(status, limit);
    res.json({ actions });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// GET /api/actions/tools — List available sandbox tools and risk definitions
router.get('/tools', (_req: Request, res: Response) => {
  res.json({ tools: Object.values(AVAILABLE_TOOLS) });
});

// GET /api/actions/pending-count — Quick count of actions awaiting approval
router.get('/pending-count', async (_req: Request, res: Response) => {
  try {
    const countRes = await pool.query(
      "SELECT count(*) as count FROM agent_actions WHERE status = 'PENDING';"
    );
    res.json({ pendingCount: parseInt(countRes.rows[0].count, 10) });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/actions/request — Request a new tool execution
router.post('/request', async (req: Request, res: Response) => {
  try {
    const { agentId, toolName, toolInput, taskId, runId, autoApprove } = req.body;
    if (!agentId || !toolName || !toolInput) {
      return res.status(400).json({ error: { message: 'agentId, toolName, dan toolInput wajib diisi.' } });
    }

    const action = await ActionManager.requestAction({
      agentId,
      toolName,
      toolInput,
      taskId,
      runId,
      autoApprove
    });

    res.status(201).json(action);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/actions/sandbox/run-code — Direct interactive sandbox code execution
router.post('/sandbox/run-code', requireAuth, async (req: Request, res: Response) => {
  try {
    const { language = 'javascript', code, timeoutMs = 15000 } = req.body;
    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: { message: 'Parameter "code" wajib diisi dalam format teks.' } });
    }

    const startTime = Date.now();
    const cleanLang = (language || 'javascript').toLowerCase().trim();
    const execId = `exec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    // Choose file extension & command
    let scriptFileName = '';
    let execCommand = '';

    if (cleanLang === 'python' || cleanLang === 'py') {
      scriptFileName = `${execId}.py`;
      execCommand = `python3 ${scriptFileName}`;
    } else if (cleanLang === 'javascript' || cleanLang === 'js' || cleanLang === 'node') {
      scriptFileName = `${execId}.mjs`;
      execCommand = `node ${scriptFileName}`;
    } else if (cleanLang === 'typescript' || cleanLang === 'ts') {
      scriptFileName = `${execId}.ts`;
      execCommand = `node --experimental-strip-types ${scriptFileName}`;
    } else if (cleanLang === 'bash' || cleanLang === 'sh' || cleanLang === 'shell') {
      scriptFileName = `${execId}.sh`;
      execCommand = `bash ${scriptFileName}`;
    } else {
      scriptFileName = `${execId}.js`;
      execCommand = `node ${scriptFileName}`;
    }

    // Ensure SANDBOX_DIR exists
    if (!fs.existsSync(SANDBOX_DIR)) {
      fs.mkdirSync(SANDBOX_DIR, { recursive: true });
    }

    const scriptPath = path.join(SANDBOX_DIR, scriptFileName);
    fs.writeFileSync(scriptPath, code, 'utf-8');

    const timeout = Math.min(30000, Math.max(1000, Number(timeoutMs) || 15000));
    const cleanEnv: Record<string, string | undefined> = {
      PATH: process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      HOME: SANDBOX_DIR,
      USER: 'sandbox-agent',
      LANG: process.env.LANG || 'en_US.UTF-8',
      TERM: 'xterm',
      NODE_ENV: 'test',
      SANDBOX: '1'
    };

    let stdout = '';
    let stderr = '';
    let exitCode = 0;
    let isSuccess = true;

    try {
      const result = await execAsync(execCommand, {
        cwd: SANDBOX_DIR,
        timeout,
        maxBuffer: 1024 * 1024 * 2,
        env: cleanEnv
      });
      stdout = result.stdout || '';
      stderr = result.stderr || '';
    } catch (err: any) {
      isSuccess = false;
      stdout = err.stdout || '';
      stderr = err.stderr || err.message || 'Execution error';
      exitCode = err.code ?? (err.killed ? 137 : 1);
    } finally {
      // Clean up script file
      try {
        if (fs.existsSync(scriptPath)) {
          fs.unlinkSync(scriptPath);
        }
      } catch {}
    }

    const durationMs = Date.now() - startTime;

    res.json({
      success: isSuccess && exitCode === 0,
      exitCode,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      durationMs,
      language: cleanLang,
      executedAt: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/actions/:id/approve — Operator approves an action (Protected)
router.post('/:id/approve', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const operatorId = authReq.user?.displayName || authReq.user?.id || 'lead-operator';
    const action = await ActionManager.executeAction(req.params.id, operatorId);
    res.json(action);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/actions/:id/reject — Operator rejects an action (Protected)
router.post('/:id/reject', requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const operatorId = authReq.user?.displayName || authReq.user?.id || 'lead-operator';
    const reason = req.body.reason;
    const action = await ActionManager.rejectAction(req.params.id, operatorId, reason);
    res.json(action);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

export default router;
