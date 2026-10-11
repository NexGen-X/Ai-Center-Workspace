/**
 * AI Agent Command Center — Backend Server Entry Point
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { initializeDatabase } from './db/index.js';
import { realtimeHub } from './services/realtime.js';
import { v4 as uuidv4 } from 'uuid';

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
import { systemLogger } from './services/logger.js';

export const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '15mb' }));

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

// Root healthcheck
app.get('/healthz', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve frontend static files if client/dist exists
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const clientDist = fs.existsSync(path.resolve(process.cwd(), 'client/dist'))
  ? path.resolve(process.cwd(), 'client/dist')
  : path.resolve(__dirname, '../../../../client/dist');

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api') || req.path === '/healthz') {
      return next();
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
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
  const server = app.listen(config.port, () => {
    console.log(`[Server] AI Agent Command Center backend listening on port ${config.port}`);
  });
  return server;
}

// Auto-start if executed directly
if (process.env.NODE_ENV !== 'test') {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
