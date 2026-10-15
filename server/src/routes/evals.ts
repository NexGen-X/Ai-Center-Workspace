/**
 * Automated Agent Evals & Benchmark Arena Routes
 * AI Agent Command Center
 */

import { Router, Request, Response, NextFunction } from 'express';
import { EvalService } from '../services/evalService.js';
import { RunEvalRequest } from '../../../shared/types.js';

export const evalsRouter = Router();

// GET /api/evals/benchmarks — List curated evaluation benchmarks
evalsRouter.get('/benchmarks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = (req.query.workspaceId as string) || 'ws-default-command-center';
    const benchmarks = await EvalService.listBenchmarks(workspaceId);
    res.json(benchmarks);
  } catch (err) {
    next(err);
  }
});

// POST /api/evals/run — Execute evaluation benchmark on a model
evalsRouter.post('/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body: RunEvalRequest = req.body;
    if (!body.benchmarkId || !body.providerId || !body.modelId) {
      return res.status(400).json({ error: { message: 'benchmarkId, providerId, and modelId are required.' } });
    }

    const workspaceId = (req.query.workspaceId as string) || 'ws-default-command-center';
    const result = await EvalService.runEvaluation(body, workspaceId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/evals/runs — List past evaluation runs
evalsRouter.get('/runs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = (req.query.workspaceId as string) || 'ws-default-command-center';
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const runs = await EvalService.listRuns(workspaceId, limit);
    res.json(runs);
  } catch (err) {
    next(err);
  }
});

// GET /api/evals/leaderboard — Aggregate leaderboard scores across models
evalsRouter.get('/leaderboard', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = (req.query.workspaceId as string) || 'ws-default-command-center';
    const leaderboard = await EvalService.getLeaderboard(workspaceId);
    res.json(leaderboard);
  } catch (err) {
    next(err);
  }
});
