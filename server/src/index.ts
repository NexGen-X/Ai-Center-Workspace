/**
 * AI Agent Command Center — Backend Server Entry Point
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { initializeDatabase, checkDatabaseHealth } from './db/index.js';
import { realtimeHub } from './services/realtime.js';
import { v4 as uuidv4 } from 'uuid';
import { securityHeadersMiddleware } from './middleware/securityHeaders.js';
import { authRateLimiter, computeRateLimiter, globalApiRateLimiter } from './middleware/rateLimiter.js';

import agentsRouter from './routes/agents.js';
import providersRouter from './routes/providers.js';
import tasksRouter from './routes/tasks.js';
import projectsRouter from './routes/projects.js';
import activitiesRouter from './routes/activities.js';
import monitoringRouter from './routes/monitoring.js';
import dashboardRouter from './routes/dashboard.js';
import authRouter from './routes/auth.js';
import reportsRouter from './routes/reports.js';
import notificationsRouter from './routes/notifications.js';
import documentsRouter from './routes/documents.js';
import orchestratorRouter from './routes/orchestrator.js';
import systemRouter from './routes/system.js';
import playgroundRouter from './routes/playground.js';
import webhooksRouter from './routes/webhooks.js';
import { pipelineRouter } from './routes/pipeline.js';
import actionsRouter from './routes/actions.js';
import ragRouter from './routes/rag.js';
import swarmRouter from './routes/swarm.js';
import { schedulesRouter } from './routes/schedules.js';
import { alertsRouter } from './routes/alerts.js';
import { evalsRouter } from './routes/evals.js';
import { mcpRouter } from './routes/mcp.js';
import { workflowsRouter } from './routes/workflows.js';
import { warRoomsRouter } from './routes/warRooms.js';
import { webResearchRouter } from './routes/webResearch.js';
import { sreRouter } from './routes/sre.js';
import { dataAnalystRouter } from './routes/dataAnalyst.js';
import { skillsRouter } from './routes/skills.js';
import memoryGraphRouter from './routes/memoryGraph.js';
import domainRouter from './routes/domain.js';
import workspacesRouter from './routes/workspaces.js';
import { billingRouter } from './routes/billing.js';
import { adminRouter } from './routes/admin.js';
import { requireAuth } from './middleware/auth.js';
import { systemLogger } from './services/logger.js';

export const app = express();

// Security Hardening: Trust Proxy for accurate client IP resolution behind Caddy
app.set('trust proxy', 1);

// Security Hardening: Disable fingerprinting headers
app.disable('x-powered-by');

// Global Graceful Shutdown State
let isShuttingDown = false;

// Reject new incoming traffic with 503 if server is gracefully shutting down
app.use((req: Request, res: Response, next: NextFunction) => {
  if (isShuttingDown) {
    res.setHeader('Connection', 'close');
    return res.status(503).json({
      error: {
        code: 'SERVER_SHUTTING_DOWN',
        message: 'Server sedang dalam proses shutdown. Silakan coba sesaat lagi.'
      }
    });
  }
  next();
});

// Security & Standard Middlewares
app.use(securityHeadersMiddleware);
app.use(cors());
app.use(express.json({ limit: '15mb' }));

// DoS & Flood Protection
app.use('/api', globalApiRateLimiter);

// Request logging (sanitized, zero secret leaking)
app.use((req: Request, _res: Response, next: NextFunction) => {
  const sanitizedUrl = req.originalUrl.split('?')[0];
  console.log(`[API] ${req.method} ${sanitizedUrl}`);
  if (!sanitizedUrl.startsWith('/api/realtime') && !sanitizedUrl.startsWith('/api/monitoring/logs')) {
    systemLogger.debug('API', `${req.method} ${sanitizedUrl}`);
  }
  next();
});

// Real-time Server-Sent Events (SSE) Stream
app.get('/api/realtime', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clientId = `client-${uuidv4().slice(0, 8)}`;
  realtimeHub.addClient(clientId, res);
});

// Targeted Abuse-Protection Rate Limiters
app.use('/api/auth/login', authRateLimiter);
app.use('/api/playground/execute', computeRateLimiter);
app.use('/api/evals/run', computeRateLimiter);
app.use('/api/webhooks/dispatch-task', computeRateLimiter);

// Mount modular feature routes
app.use('/api/auth', authRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/providers', providersRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/activities', activitiesRouter);
app.use('/api/monitoring', monitoringRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/orchestrator', orchestratorRouter);
app.use('/api/system', systemRouter);
app.use('/api/playground', playgroundRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/pipeline', pipelineRouter);
app.use('/api/actions', actionsRouter);
app.use('/api/rag', ragRouter);
app.use('/api/swarm', swarmRouter);
app.use('/api/schedules', schedulesRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/evals', evalsRouter);
app.use('/api/mcp', mcpRouter);
app.use('/api/workflows', workflowsRouter);
app.use('/api/war-rooms', warRoomsRouter);
app.use('/api/web-research', webResearchRouter);
app.use('/api/sre', sreRouter);
app.use('/api/data-analyst', dataAnalystRouter);
app.use('/api/skills', skillsRouter);
app.use('/api/memory-graph', memoryGraphRouter);
app.use('/api/system/domain', domainRouter);
app.use('/api/workspaces', requireAuth, workspacesRouter);
app.use('/api/billing', billingRouter);
app.use('/api/admin', adminRouter);

// Comprehensive Root Healthcheck with Database Connectivity Validation
app.get('/healthz', async (_req: Request, res: Response) => {
  const dbHealth = await checkDatabaseHealth();
  const isHealthy = dbHealth.ok && !isShuttingDown;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    database: dbHealth.ok ? 'connected' : 'disconnected',
    dbLatencyMs: dbHealth.latencyMs,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Serve frontend static files if client/dist exists
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const candidateDistPaths = [
  path.resolve(process.cwd(), 'client/dist'),
  path.resolve(__dirname, '../../../client/dist'),
  path.resolve(__dirname, '../../../../client/dist'),
  path.resolve(__dirname, '../../client/dist')
];

const clientDist = candidateDistPaths.find(p => fs.existsSync(p)) || candidateDistPaths[0];

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api') || req.path === '/healthz') {
      return next();
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Resilient Global Error Handler (Prevents ERR_HTTP_HEADERS_SENT crashes)
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }
  console.error('[Error]', err);
  res.status(err.status || 500).json({
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'Terjadi kesalahan internal pada server.'
    }
  });
});

export async function startServer() {
  await initializeDatabase();
  const { SwarmService } = await import('./services/swarmService.js');
  await SwarmService.recoverInterruptedMissions();
  const { SchedulerService } = await import('./services/schedulerService.js');
  SchedulerService.startDaemon(30000);
  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`[Server] AI Agent Command Center backend listening on port ${config.port} (0.0.0.0)`);
  });

  // Architectural Resilience: True Graceful Shutdown Handler
  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`[Server] Received ${signal}. Initiating graceful shutdown...`);

    // 10-second hard fallback timeout to avoid hanging processes
    const forceExitTimer = setTimeout(() => {
      console.error('[Server] Graceful shutdown timed out (10s). Forcing termination.');
      process.exit(1);
    }, 10000);
    forceExitTimer.unref();

    try {
      // 1. Stop background daemons and schedulers
      const { taskRunner } = await import('./services/orchestrator.js');
      taskRunner.stop();
      SchedulerService.stopDaemon();

      // 2. Disconnect real-time SSE clients
      realtimeHub.closeAll();

      // 3. Stop accepting new HTTP requests and drain active requests
      await new Promise<void>((resolve) => {
        server.close((err) => {
          if (err) console.error('[Server] Error while closing HTTP server:', err);
          else console.log('[Server] In-flight HTTP requests drained and server closed.');
          resolve();
        });
      });

      // 4. Safely terminate database pool after HTTP connections have drained
      const { pool } = await import('./db/index.js');
      await pool.end();
      console.log('[Server] Database pool closed cleanly. Shutdown complete.');

      clearTimeout(forceExitTimer);
      process.exit(0);
    } catch (shutdownErr) {
      console.error('[Server] Error during graceful shutdown:', shutdownErr);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  return server;
}

// Global Process Stability Handlers
process.on('uncaughtException', (err: Error) => {
  console.error('[Process UncaughtException]', err);
  systemLogger.error('SYSTEM', `Uncaught exception: ${err.message}`, { stack: err.stack });
});

process.on('unhandledRejection', (reason: any) => {
  console.error('[Process UnhandledRejection]', reason);
  systemLogger.error('SYSTEM', `Unhandled rejection: ${reason?.message || reason}`);
});

// Auto-start if executed directly
if (process.env.NODE_ENV !== 'test') {
  startServer().catch(err => {
    if (err && (err.code === '28P01' || err.code === 'ECONNREFUSED' || err.message?.includes('password authentication failed'))) {
      console.error(`\n\x1b[31m[AI Center Error] Gagal terhubung ke basis data PostgreSQL:\x1b[0m`);
      console.error(`\x1b[33mRincian:\x1b[0m ${err.message}`);
      console.error(`\n\x1b[36mPanduan Perbaikan:\x1b[0m`);
      console.error(`  1. Pastikan PostgreSQL berjalan dan database sudah dibuat.`);
      console.error(`  2. Pastikan username dan password di DATABASE_URL sudah sesuai.`);
      console.error(`  3. Contoh: DATABASE_URL="postgres://user:password@localhost:5432/ai_center" npx ai-agent-command-center\n`);
    } else {
      console.error('Failed to start server:', err);
    }
    process.exit(1);
  });
}
