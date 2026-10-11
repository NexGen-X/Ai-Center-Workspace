import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db/index.js';
import { FinOpsReportsSummary, AgentMetric, ModelMetric } from '../../../shared/types.js';

const router = Router();

// GET /api/reports/summary?days=30
router.get('/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string, 10) || 30;

    // 1. Overall runs aggregation
    const overallRes = await pool.query(
      `SELECT 
        COUNT(*)::int as total_runs,
        COUNT(CASE WHEN status = 'SUCCEEDED' THEN 1 END)::int as successful_runs,
        COUNT(CASE WHEN status = 'FAILED' THEN 1 END)::int as failed_runs,
        COALESCE(SUM(tokens_prompt), 0)::int as total_prompt_tokens,
        COALESCE(SUM(tokens_completion), 0)::int as total_completion_tokens,
        COALESCE(SUM(tokens_total), 0)::int as total_tokens,
        COALESCE(AVG(duration_ms), 0)::int as avg_duration_ms
       FROM agent_runs
       WHERE created_at >= NOW() - INTERVAL '1 day' * $1`,
      [days]
    );

    const overall = overallRes.rows[0] || {
      total_runs: 0,
      successful_runs: 0,
      failed_runs: 0,
      total_prompt_tokens: 0,
      total_completion_tokens: 0,
      total_tokens: 0,
      avg_duration_ms: 0,
    };

    const totalRuns = overall.total_runs;
    const successfulRuns = overall.successful_runs;
    const failedRuns = overall.failed_runs;
    const successRatePercent = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 100;
    const totalPromptTokens = overall.total_prompt_tokens;
    const totalCompletionTokens = overall.total_completion_tokens;
    const totalTokens = overall.total_tokens;
    const averageLatencyMs = overall.avg_duration_ms;

    // Standard blende cost estimate: ~$0.0015 per 1K prompt, ~$0.003 per 1K completion
    const estimatedTotalCostUsd = Number(
      ((totalPromptTokens / 1000) * 0.0015 + (totalCompletionTokens / 1000) * 0.003).toFixed(4)
    );

    // 2. Metrics grouped by Agent
    const agentRes = await pool.query(
      `SELECT 
        a.id as agent_id,
        a.name as agent_name,
        a.role,
        COUNT(r.id)::int as total_runs,
        COUNT(CASE WHEN r.status = 'SUCCEEDED' THEN 1 END)::int as success_count,
        COUNT(CASE WHEN r.status = 'FAILED' THEN 1 END)::int as failure_count,
        COALESCE(AVG(r.duration_ms), 0)::int as avg_duration_ms,
        COALESCE(SUM(r.tokens_total), 0)::int as total_tokens
       FROM ai_agents a
       LEFT JOIN agent_runs r ON a.id = r.agent_id AND r.created_at >= NOW() - INTERVAL '1 day' * $1
       GROUP BY a.id, a.name, a.role
       ORDER BY total_runs DESC, a.name ASC`,
      [days]
    );

    const agentMetrics: AgentMetric[] = agentRes.rows.map((row: any) => ({
      agentId: row.agent_id,
      agentName: row.agent_name,
      role: row.role,
      totalRuns: row.total_runs,
      successCount: row.success_count,
      failureCount: row.failure_count,
      avgDurationMs: row.avg_duration_ms,
      totalTokens: row.total_tokens,
    }));

    // 3. Metrics grouped by Model
    const modelRes = await pool.query(
      `SELECT 
        model_id,
        COUNT(*)::int as total_runs,
        COALESCE(SUM(tokens_prompt), 0)::int as prompt_tokens,
        COALESCE(SUM(tokens_completion), 0)::int as completion_tokens,
        COALESCE(SUM(tokens_total), 0)::int as total_tokens,
        COALESCE(AVG(duration_ms), 0)::int as avg_duration_ms
       FROM agent_runs
       WHERE created_at >= NOW() - INTERVAL '1 day' * $1
       GROUP BY model_id
       ORDER BY total_runs DESC`,
      [days]
    );

    const modelMetrics: ModelMetric[] = modelRes.rows.map((row: any) => {
      const pTokens = row.prompt_tokens;
      const cTokens = row.completion_tokens;
      const cost = Number(((pTokens / 1000) * 0.0015 + (cTokens / 1000) * 0.003).toFixed(4));
      return {
        modelId: row.model_id,
        totalRuns: row.total_runs,
        totalPromptTokens: pTokens,
        totalCompletionTokens: cTokens,
        totalTokens: row.total_tokens,
        avgDurationMs: row.avg_duration_ms,
        estimatedCostUsd: cost,
      };
    });

    // 4. Daily Usage History
    const dailyRes = await pool.query(
      `SELECT 
        TO_CHAR(created_at, 'YYYY-MM-DD') as day,
        COUNT(*)::int as runs,
        COALESCE(SUM(tokens_total), 0)::int as tokens
       FROM agent_runs
       WHERE created_at >= NOW() - INTERVAL '1 day' * $1
       GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
       ORDER BY day ASC`,
      [days]
    );

    const dailyUsage = dailyRes.rows.map((row: any) => ({
      date: row.day,
      runs: row.runs,
      tokens: row.tokens,
    }));

    const response: FinOpsReportsSummary = {
      periodDays: days,
      totalRuns,
      successfulRuns,
      failedRuns,
      successRatePercent,
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens,
      estimatedTotalCostUsd,
      averageLatencyMs,
      agentMetrics,
      modelMetrics,
      dailyUsage,
    };

    res.json(response);
  } catch (err) {
    next(err);
  }
});

export default router;
