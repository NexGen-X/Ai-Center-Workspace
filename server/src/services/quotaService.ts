/**
 * Multi-Tenant Quota & Metering Service — AI Agent Command Center
 */

import { pool } from '../db/index.js';
import { WorkspaceUsageStats, WorkspacePlan } from '../../../shared/types.js';

export class QuotaService {
  /**
   * Check if workspace has enough task quota to execute or create a task
   */
  static async checkTaskQuota(workspaceId: string): Promise<{
    allowed: boolean;
    tasksUsed: number;
    limit: number;
    plan: WorkspacePlan;
    planStatus: string;
    remaining: number;
  }> {
    const res = await pool.query(`
      SELECT plan, plan_status, task_quota_limit, tasks_used_this_month
      FROM workspaces
      WHERE id = $1
    `, [workspaceId]);

    if (res.rows.length === 0) {
      // Default fallback if workspace not found yet
      return {
        allowed: true,
        tasksUsed: 0,
        limit: 999999,
        plan: 'ENTERPRISE',
        planStatus: 'ACTIVE',
        remaining: 999999
      };
    }

    const row = res.rows[0];
    const limit = row.task_quota_limit ?? 50;
    const tasksUsed = row.tasks_used_this_month ?? 0;
    const remaining = Math.max(0, limit - tasksUsed);

    return {
      allowed: tasksUsed < limit,
      tasksUsed,
      limit,
      plan: (row.plan || 'FREE') as WorkspacePlan,
      planStatus: row.plan_status || 'TRIALING',
      remaining
    };
  }

  /**
   * Increment task usage count for workspace
   */
  static async incrementTaskUsage(workspaceId: string, count: number = 1): Promise<number> {
    const res = await pool.query(`
      UPDATE workspaces
      SET tasks_used_this_month = COALESCE(tasks_used_this_month, 0) + $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING tasks_used_this_month
    `, [workspaceId, count]);

    return res.rows[0]?.tasks_used_this_month || 0;
  }

  /**
   * Get detailed usage statistics for workspace
   */
  static async getUsageStats(workspaceId: string): Promise<WorkspaceUsageStats> {
    const wsRes = await pool.query(`
      SELECT 
        w.id, w.name, w.plan, w.plan_status, w.task_quota_limit, w.tasks_used_this_month,
        w.billing_cycle_end,
        (SELECT COUNT(*)::int FROM ai_agents WHERE workspace_id = w.id) as agent_count,
        (SELECT COUNT(*)::int FROM workspace_members WHERE workspace_id = w.id) as member_count
      FROM workspaces w
      WHERE w.id = $1
    `, [workspaceId]);

    if (wsRes.rows.length === 0) {
      throw new Error(`Workspace "${workspaceId}" tidak ditemukan.`);
    }

    const row = wsRes.rows[0];
    const limit = row.task_quota_limit ?? 50;
    const used = row.tasks_used_this_month ?? 0;
    const remaining = Math.max(0, limit - used);
    const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

    const cycleEnd = row.billing_cycle_end ? new Date(row.billing_cycle_end) : new Date(Date.now() + 14 * 86400000);
    const now = new Date();
    const daysRemaining = Math.max(0, Math.ceil((cycleEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    return {
      workspaceId: row.id,
      workspaceName: row.name,
      plan: (row.plan || 'FREE') as WorkspacePlan,
      planStatus: row.plan_status || 'TRIALING',
      taskQuotaLimit: limit,
      tasksUsedThisMonth: used,
      quotaPercentUsed: percent,
      remainingTasks: remaining,
      agentCount: row.agent_count || 0,
      memberCount: row.member_count || 1,
      billingCycleEnd: cycleEnd.toISOString(),
      daysRemainingInCycle: daysRemaining
    };
  }
}
