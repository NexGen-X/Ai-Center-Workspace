/**
 * Action Manager & Human-in-the-Loop Approval Service — AI Agent Command Center
 */

import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/index.js';
import { AgentAction, ActionApprovalStatus } from '../../../shared/types.js';
import { evaluateActionRisk, executeToolInSandbox } from './sandbox.js';
import { realtimeHub } from './realtime.js';
import { systemLogger } from './logger.js';

export class ActionManager {
  /**
   * Mendaftarkan aksi tool baru dari AI Agent
   */
  static async requestAction(params: {
    agentId: string;
    toolName: string;
    toolInput: Record<string, any>;
    taskId?: string;
    runId?: string;
    autoApprove?: boolean;
  }): Promise<AgentAction> {
    const actionId = `act-${uuidv4().slice(0, 8)}`;
    const { agentId, toolName, toolInput, taskId, runId, autoApprove } = params;

    // Ambil data agen
    const agentRes = await pool.query(
      'SELECT id, name FROM ai_agents WHERE id = $1',
      [agentId]
    );
    const agentName = agentRes.rows[0]?.name || 'Unknown Agent';

    // Ambil data task jika ada
    let taskTitle: string | undefined;
    if (taskId) {
      const taskRes = await pool.query('SELECT title FROM tasks WHERE id = $1', [taskId]);
      taskTitle = taskRes.rows[0]?.title;
    }

    // Evaluasi tingkat risiko & kebutuhan approval
    const riskEval = evaluateActionRisk(toolName, toolInput);
    const requiresApproval = autoApprove ? false : riskEval.requiresApproval;
    const initialStatus: ActionApprovalStatus = requiresApproval ? 'PENDING' : 'APPROVED';

    // Simpan ke database
    await pool.query(`
      INSERT INTO agent_actions (
        id, run_id, agent_id, task_id, tool_name, tool_input, status, risk_level, requires_approval
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
    `, [
      actionId,
      runId || null,
      agentId,
      taskId || null,
      toolName,
      JSON.stringify(toolInput),
      initialStatus,
      riskEval.riskLevel,
      requiresApproval
    ]);

    const actionData: AgentAction = {
      id: actionId,
      runId,
      agentId,
      agentName,
      taskId,
      taskTitle,
      toolName,
      toolInput,
      status: initialStatus,
      riskLevel: riskEval.riskLevel,
      requiresApproval,
      createdAt: new Date().toISOString()
    };

    if (requiresApproval) {
      systemLogger.warn('SECURITY', `Aksi [${toolName}] oleh agen [${agentName}] membutuhkan persetujuan operator. Alasan: ${riskEval.reason || 'Sensitivitas tinggi'}`);

      // Broadcast SSE agar operator di UI mendapat popup modal approval
      realtimeHub.broadcast('action.approval_requested', {
        ...actionData,
        reason: riskEval.reason
      });

      // Dispatch Outbound Webhook Alert
      import('./alertingService.js').then(({ AlertingService }) => {
        AlertingService.dispatchAlert({
          event: 'ACTION_PENDING',
          title: `Persetujuan Dibutuhkan: ${toolName}`,
          message: `Agen "${agentName}" mengajukan eksekusi tool berisiko "${toolName}". Alasan: ${riskEval.reason || 'Tindakan berisiko tinggi'}`,
          severity: 'WARNING',
          metadata: {
            action_id: actionId,
            agent_name: agentName,
            tool_name: toolName,
            risk_level: riskEval.riskLevel
          }
        }).catch(() => {});
      }).catch(() => {});

      return actionData;
    }

    // Jika tidak butuh approval, langsung eksekusi di sandbox
    return await this.executeAction(actionId, 'system-auto');
  }

  /**
   * Menjalankan aksi yang sudah di-approve
   */
  static async executeAction(actionId: string, operatorId: string): Promise<AgentAction> {
    const res = await pool.query(`
      SELECT a.*, ag.name as agent_name, t.title as task_title
      FROM agent_actions a
      LEFT JOIN ai_agents ag ON a.agent_id = ag.id
      LEFT JOIN tasks t ON a.task_id = t.id
      WHERE a.id = $1;
    `, [actionId]);

    if (res.rows.length === 0) {
      throw new Error(`Aksi dengan ID ${actionId} tidak ditemukan.`);
    }

    const row = res.rows[0];
    const toolInput = typeof row.tool_input === 'string' ? JSON.parse(row.tool_input) : row.tool_input;

    systemLogger.info('INFERENCE', `Mengeksekusi tool [${row.tool_name}] di sandbox atas izin operator [${operatorId}]...`);

    const result = await executeToolInSandbox(row.tool_name, toolInput, {
      agentId: row.agent_id,
      taskId: row.task_id
    });
    const finalStatus: ActionApprovalStatus = result.success ? 'EXECUTED' : 'FAILED';
    const executedAt = new Date().toISOString();

    await pool.query(`
      UPDATE agent_actions SET
        status = $1,
        approved_by = $2,
        output_result = $3,
        error_message = $4,
        executed_at = $5
      WHERE id = $6;
    `, [
      finalStatus,
      operatorId,
      result.output || null,
      result.error || null,
      executedAt,
      actionId
    ]);

    const updatedAction: AgentAction = {
      id: actionId,
      runId: row.run_id,
      agentId: row.agent_id,
      agentName: row.agent_name,
      taskId: row.task_id,
      taskTitle: row.task_title,
      toolName: row.tool_name,
      toolInput,
      status: finalStatus,
      riskLevel: row.risk_level,
      requiresApproval: row.requires_approval,
      approvedBy: operatorId,
      outputResult: result.output,
      errorMessage: result.error,
      createdAt: row.created_at,
      executedAt
    };

    realtimeHub.broadcast('action.executed', updatedAction);

    // Rekam aktivitas
    try {
      await pool.query(`
        INSERT INTO activities (id, workspace_id, actor_type, actor_id, actor_name, event_type, summary, target_type, target_id)
        VALUES ($1, 'ws-default-command-center', 'AGENT', $2, $3, $4, $5, 'ACTION', $6);
      `, [
        `act-log-${uuidv4().slice(0, 8)}`,
        row.agent_id,
        row.agent_name,
        result.success ? 'action.succeeded' : 'action.failed',
        `${row.agent_name} menjalankan tool ${row.tool_name} (${finalStatus})`,
        actionId
      ]);
    } catch {
      // ignore log failure
    }

    return updatedAction;
  }

  /**
   * Menolak aksi (Rejection oleh operator)
   */
  static async rejectAction(actionId: string, operatorId: string, reason?: string): Promise<AgentAction> {
    const res = await pool.query(`
      SELECT a.*, ag.name as agent_name, t.title as task_title
      FROM agent_actions a
      LEFT JOIN ai_agents ag ON a.agent_id = ag.id
      LEFT JOIN tasks t ON a.task_id = t.id
      WHERE a.id = $1;
    `, [actionId]);

    if (res.rows.length === 0) {
      throw new Error(`Aksi dengan ID ${actionId} tidak ditemukan.`);
    }

    const row = res.rows[0];
    const executedAt = new Date().toISOString();
    const rejectionMsg = reason || 'Ditolak oleh operator demi keamanan sistem.';

    await pool.query(`
      UPDATE agent_actions SET
        status = 'REJECTED',
        approved_by = $1,
        error_message = $2,
        executed_at = $3
      WHERE id = $4;
    `, [operatorId, rejectionMsg, executedAt, actionId]);

    const updatedAction: AgentAction = {
      id: actionId,
      runId: row.run_id,
      agentId: row.agent_id,
      agentName: row.agent_name,
      taskId: row.task_id,
      taskTitle: row.task_title,
      toolName: row.tool_name,
      toolInput: typeof row.tool_input === 'string' ? JSON.parse(row.tool_input) : row.tool_input,
      status: 'REJECTED',
      riskLevel: row.risk_level,
      requiresApproval: row.requires_approval,
      approvedBy: operatorId,
      errorMessage: rejectionMsg,
      createdAt: row.created_at,
      executedAt
    };

    systemLogger.info('SECURITY', `Aksi [${row.tool_name}] oleh agen [${row.agent_name}] ditolak oleh operator [${operatorId}].`);
    realtimeHub.broadcast('action.rejected', updatedAction);

    return updatedAction;
  }

  /**
   * Ambil daftar aksi
   */
  static async listActions(status?: string, limit = 50): Promise<AgentAction[]> {
    let query = `
      SELECT a.*, ag.name as agent_name, t.title as task_title
      FROM agent_actions a
      LEFT JOIN ai_agents ag ON a.agent_id = ag.id
      LEFT JOIN tasks t ON a.task_id = t.id
    `;
    const params: any[] = [];

    if (status) {
      query += ' WHERE a.status = $1';
      params.push(status);
    }

    query += ' ORDER BY a.created_at DESC LIMIT ' + (params.length + 1);
    params.push(limit);

    const res = await pool.query(query, params);
    return res.rows.map(r => ({
      id: r.id,
      runId: r.run_id,
      agentId: r.agent_id,
      agentName: r.agent_name,
      taskId: r.task_id,
      taskTitle: r.task_title,
      toolName: r.tool_name,
      toolInput: typeof r.tool_input === 'string' ? JSON.parse(r.tool_input) : r.tool_input,
      status: r.status,
      riskLevel: r.risk_level,
      requiresApproval: r.requires_approval,
      approvedBy: r.approved_by,
      outputResult: r.output_result,
      errorMessage: r.error_message,
      createdAt: r.created_at,
      executedAt: r.executed_at
    }));
  }
}
