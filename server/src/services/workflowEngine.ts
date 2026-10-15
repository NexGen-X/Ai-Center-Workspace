/**
 * Visual Drag-and-Drop Workflow & DAG Pipeline Execution Engine — AI Center
 * Supports Directed Acyclic Graph resolution, branching, conditions, human approval gates,
 * RAG context injection, MCP tools, and real-time SSE execution telemetry.
 */

import { pool } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import {
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  WorkflowExecution,
  WorkflowExecutionStatus,
  WorkflowNodeState,
  RagSearchResult,
  AlertEventType
} from '../../../shared/types.js';
import { executeAgentTask } from './orchestrator.js';
import { RagService } from './ragService.js';
import { executeToolInSandbox } from './sandbox.js';
import { McpClientService } from './mcpClientService.js';
import { AlertingService } from './alertingService.js';
import { realtimeHub } from './realtime.js';
import { systemLogger } from './logger.js';

export const POPULAR_WORKFLOW_TEMPLATES: Partial<Workflow>[] = [
  {
    id: 'wf-security-audit-dag',
    name: 'Automated Security Audit & Hotfix DAG',
    description: 'Pemeriksaan keamanan kode ➔ Pencocokan SOP di RAG ➔ Evaluasi Risiko ➔ Persetujuan Manusia ➔ Notifikasi Insiden.',
    nodes: [
      {
        id: 'node-trigger',
        type: 'TRIGGER',
        label: 'Security Scan Trigger',
        position: { x: 80, y: 150 },
        config: { triggerType: 'MANUAL', initialPayload: { targetRepo: 'Ai-Center-Core' } }
      },
      {
        id: 'node-rag',
        type: 'RAG',
        label: 'Knowledge SOP Query',
        position: { x: 320, y: 150 },
        config: { query: 'Standar audit keamanan arsitektur dan penanganan insiden', limit: 2 }
      },
      {
        id: 'node-agent-audit',
        type: 'AGENT',
        label: 'Security Sentinel AI',
        position: { x: 560, y: 150 },
        config: {
          promptTemplate: 'Lakukan audit keamanan sistem dengan membandingkan target terhadap kebijakan SOP berikut:\n\n{node-rag.output}\n\nBerikan laporan risiko dan rekomendasi mitigasi.'
        }
      },
      {
        id: 'node-condition',
        type: 'CONDITION',
        label: 'Cek Risiko Kritis?',
        position: { x: 800, y: 150 },
        config: { expression: 'output.toLowerCase().includes("kritis") || output.toLowerCase().includes("vulnerability")' }
      },
      {
        id: 'node-approval',
        type: 'HUMAN_APPROVAL',
        label: 'Persetujuan Tindakan Manusia',
        position: { x: 1040, y: 80 },
        config: { reason: 'Persetujuan eksekusi mitigasi keamanan sistem' }
      },
      {
        id: 'node-alert',
        type: 'ALERT',
        label: 'Dispatch Incident Alert',
        position: { x: 1280, y: 80 },
        config: { title: 'Insiden Keamanan Terdeteksi', eventType: 'SECURITY_ALERT' }
      }
    ],
    edges: [
      { id: 'e1', source: 'node-trigger', target: 'node-rag' },
      { id: 'e2', source: 'node-rag', target: 'node-agent-audit' },
      { id: 'e3', source: 'node-agent-audit', target: 'node-condition' },
      { id: 'e4', source: 'node-condition', target: 'node-approval', sourceHandle: 'true', label: 'Risiko Kritis' },
      { id: 'e5', source: 'node-approval', target: 'node-alert' }
    ]
  },
  {
    id: 'wf-rag-research-dag',
    name: 'Multi-Agent Research & Synthesis DAG',
    description: 'Pencarian memori semantik pgvector ➔ Analisis Agen Peneliti ➔ Pembuatan Berkas Hasil ➔ Notifikasi Selesai.',
    nodes: [
      {
        id: 'node-trig-res',
        type: 'TRIGGER',
        label: 'Research Goal Input',
        position: { x: 80, y: 150 },
        config: { triggerType: 'MANUAL', initialPayload: { topic: 'Optimasi Latensi Inferensi LLM' } }
      },
      {
        id: 'node-rag-query',
        type: 'RAG',
        label: 'pgvector Semantic Search',
        position: { x: 320, y: 150 },
        config: { query: '{node-trig-res.topic}', limit: 3 }
      },
      {
        id: 'node-agent-synth',
        type: 'AGENT',
        label: 'Research Synthesizer AI',
        position: { x: 560, y: 150 },
        config: {
          promptTemplate: 'Rangkum dan sintesis temuan riset berikut menjadi rekomendasi teknis implementasi konkret:\n\n{node-rag-query.output}'
        }
      },
      {
        id: 'node-file-write',
        type: 'ACTION',
        label: 'Tulis Dokumen Laporan',
        position: { x: 800, y: 150 },
        config: { toolName: 'file_write', params: { filePath: 'sandbox/research_summary.md', content: '{node-agent-synth.output}' } }
      }
    ],
    edges: [
      { id: 'er1', source: 'node-trig-res', target: 'node-rag-query' },
      { id: 'er2', source: 'node-rag-query', target: 'node-agent-synth' },
      { id: 'er3', source: 'node-agent-synth', target: 'node-file-write' }
    ]
  }
];

export class WorkflowEngine {
  /**
   * Retrieves all configured workflows
   */
  public static async getAllWorkflows(workspaceId = 'ws-default-command-center'): Promise<Workflow[]> {
    const res = await pool.query(
      `SELECT * FROM workflows WHERE workspace_id = $1 ORDER BY created_at DESC`,
      [workspaceId]
    );
    return res.rows.map(this.mapRowToWorkflow);
  }

  /**
   * Retrieves a single workflow by ID
   */
  public static async getWorkflowById(id: string): Promise<Workflow | null> {
    const res = await pool.query(`SELECT * FROM workflows WHERE id = $1`, [id]);
    if (res.rows.length === 0) return null;
    return this.mapRowToWorkflow(res.rows[0]);
  }

  /**
   * Creates or updates a workflow
   */
  public static async createWorkflow(data: {
    id?: string;
    workspaceId?: string;
    name: string;
    description?: string;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    isActive?: boolean;
  }): Promise<Workflow> {
    const id = data.id || `wf-${uuidv4().slice(0, 8)}`;
    const workspaceId = data.workspaceId || 'ws-default-command-center';
    const isActive = data.isActive !== undefined ? data.isActive : true;

    // Validate DAG cycle
    this.validateDAG(data.nodes, data.edges);

    const res = await pool.query(
      `INSERT INTO workflows (id, workspace_id, name, description, nodes, edges, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        id,
        workspaceId,
        data.name,
        data.description || null,
        JSON.stringify(data.nodes),
        JSON.stringify(data.edges),
        isActive
      ]
    );

    systemLogger.info('SYSTEM', `Created workflow: ${data.name} (${id})`);
    return this.mapRowToWorkflow(res.rows[0]);
  }

  /**
   * Updates an existing workflow
   */
  public static async updateWorkflow(
    id: string,
    updates: Partial<{
      name: string;
      description: string;
      nodes: WorkflowNode[];
      edges: WorkflowEdge[];
      isActive: boolean;
    }>
  ): Promise<Workflow | null> {
    const existing = await this.getWorkflowById(id);
    if (!existing) return null;

    const name = updates.name !== undefined ? updates.name : existing.name;
    const description = updates.description !== undefined ? updates.description : existing.description;
    const nodes = updates.nodes !== undefined ? updates.nodes : existing.nodes;
    const edges = updates.edges !== undefined ? updates.edges : existing.edges;
    const isActive = updates.isActive !== undefined ? updates.isActive : existing.isActive;

    if (updates.nodes || updates.edges) {
      this.validateDAG(nodes, edges);
    }

    const res = await pool.query(
      `UPDATE workflows
       SET name = $1, description = $2, nodes = $3, edges = $4, is_active = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [name, description, JSON.stringify(nodes), JSON.stringify(edges), isActive, id]
    );

    return this.mapRowToWorkflow(res.rows[0]);
  }

  /**
   * Deletes a workflow
   */
  public static async deleteWorkflow(id: string): Promise<boolean> {
    const res = await pool.query(`DELETE FROM workflows WHERE id = $1`, [id]);
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Starts execution of a DAG workflow
   */
  public static async executeWorkflow(
    workflowId: string,
    initialPayload: Record<string, any> = {}
  ): Promise<WorkflowExecution> {
    const workflow = await this.getWorkflowById(workflowId);
    if (!workflow) {
      throw new Error(`Workflow with ID ${workflowId} not found`);
    }

    if (!workflow.isActive) {
      throw new Error(`Workflow "${workflow.name}" is currently disabled`);
    }

    const executionId = `exec-${uuidv4().slice(0, 8)}`;
    const nodeStates: Record<string, WorkflowNodeState> = {};
    for (const node of workflow.nodes) {
      nodeStates[node.id] = { status: 'PENDING' };
    }

    const contextData: Record<string, any> = {
      trigger: initialPayload,
      ...initialPayload
    };

    const insertRes = await pool.query(
      `INSERT INTO workflow_executions (
        id, workflow_id, workspace_id, status, node_states, context_data, started_at
      ) VALUES ($1, $2, $3, 'RUNNING', $4, $5, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        executionId,
        workflow.id,
        workflow.workspaceId,
        JSON.stringify(nodeStates),
        JSON.stringify(contextData)
      ]
    );

    const execution = this.mapRowToExecution(insertRes.rows[0]);

    // Dispatch background execution runner
    setImmediate(() => {
      this.runDAGExecution(workflow, executionId, nodeStates, contextData).catch((err) => {
        systemLogger.error('SYSTEM', `DAG Execution error on ${executionId}`, err);
      });
    });

    return execution;
  }

  /**
   * Background DAG step executor
   */
  private static async runDAGExecution(
    workflow: Workflow,
    executionId: string,
    nodeStates: Record<string, WorkflowNodeState>,
    contextData: Record<string, any>
  ): Promise<void> {
    realtimeHub.broadcast('workflow.started', {
      executionId,
      workflowId: workflow.id,
      workflowName: workflow.name
    });

    try {
      let isHalted = false;

      while (!isHalted) {
        // Find nodes ready to run (all incoming dependency nodes are COMPLETED or SKIPPED)
        const readyNodes = workflow.nodes.filter((node) => {
          const currentState = nodeStates[node.id]?.status;
          if (currentState !== 'PENDING') return false;

          const incomingEdges = workflow.edges.filter((e) => e.target === node.id);
          if (incomingEdges.length === 0) return true;

          // All upstream nodes must have completed or been skipped
          return incomingEdges.every((edge) => {
            const parentState = nodeStates[edge.source]?.status;
            return parentState === 'COMPLETED' || parentState === 'SKIPPED';
          });
        });

        if (readyNodes.length === 0) {
          // Check if any nodes are waiting approval
          const waitingApproval = Object.values(nodeStates).some((s) => s.status === 'WAITING_APPROVAL');
          if (waitingApproval) {
            await this.updateExecutionStatus(executionId, 'WAITING_APPROVAL', nodeStates, contextData);
            return;
          }

          // Check if all nodes are finished
          const hasPending = Object.values(nodeStates).some((s) => s.status === 'PENDING' || s.status === 'RUNNING');
          if (!hasPending) {
            const hasFailed = Object.values(nodeStates).some((s) => s.status === 'FAILED');
            const finalStatus: WorkflowExecutionStatus = hasFailed ? 'FAILED' : 'COMPLETED';
            await this.updateExecutionStatus(executionId, finalStatus, nodeStates, contextData);

            realtimeHub.broadcast('workflow.completed', {
              executionId,
              status: finalStatus
            });
          }
          break;
        }

        // Execute ready nodes (in parallel when possible)
        for (const node of readyNodes) {
          // Check if incoming edge skipped this node (e.g. conditional branch false)
          const incomingEdges = workflow.edges.filter((e) => e.target === node.id);
          const allIncomingSkipped = incomingEdges.length > 0 && incomingEdges.every((e) => {
            return nodeStates[e.source]?.status === 'SKIPPED';
          });

          if (allIncomingSkipped) {
            nodeStates[node.id] = { status: 'SKIPPED' };
            continue;
          }

          // Execute single node
          nodeStates[node.id] = { status: 'RUNNING' };
          realtimeHub.broadcast('workflow.node_started', {
            executionId,
            nodeId: node.id,
            nodeLabel: node.label
          });

          const startTime = Date.now();
          try {
            if (node.type === 'HUMAN_APPROVAL') {
              nodeStates[node.id] = {
                status: 'WAITING_APPROVAL',
                durationMs: Date.now() - startTime
              };
              await this.updateExecutionStatus(executionId, 'WAITING_APPROVAL', nodeStates, contextData, node.id);
              realtimeHub.broadcast('workflow.approval_required', {
                executionId,
                nodeId: node.id,
                nodeLabel: node.label,
                reason: node.config?.reason || 'Persetujuan eksekusi workflow diperlukan.'
              });
              isHalted = true;
              return;
            }

            const output = await this.executeNodeStep(node, contextData);
            const durationMs = Date.now() - startTime;

            nodeStates[node.id] = {
              status: 'COMPLETED',
              output,
              durationMs
            };
            contextData[node.id] = output;

            realtimeHub.broadcast('workflow.node_completed', {
              executionId,
              nodeId: node.id,
              output,
              durationMs
            });

            // If this was a condition node, conditionally skip downstream edges
            if (node.type === 'CONDITION') {
              const conditionResult = Boolean(output?.conditionMet);
              const outgoingEdges = workflow.edges.filter((e) => e.source === node.id);

              for (const edge of outgoingEdges) {
                if (edge.sourceHandle === 'true' && !conditionResult) {
                  nodeStates[edge.target] = { status: 'SKIPPED' };
                } else if (edge.sourceHandle === 'false' && conditionResult) {
                  nodeStates[edge.target] = { status: 'SKIPPED' };
                }
              }
            }
          } catch (err: any) {
            nodeStates[node.id] = {
              status: 'FAILED',
              error: err.message,
              durationMs: Date.now() - startTime
            };

            realtimeHub.broadcast('workflow.node_failed', {
              executionId,
              nodeId: node.id,
              error: err.message
            });

            // Mark downstream nodes as skipped
            this.skipDownstreamNodes(node.id, workflow, nodeStates);
          }
        }

        // Persist current execution progress
        await pool.query(
          `UPDATE workflow_executions
           SET node_states = $1, context_data = $2
           WHERE id = $3`,
          [JSON.stringify(nodeStates), JSON.stringify(contextData), executionId]
        );
      }
    } catch (err: any) {
      systemLogger.error('SYSTEM', `Unexpected error in DAG runner for ${executionId}`, err);
      await this.updateExecutionStatus(executionId, 'FAILED', nodeStates, contextData);
    }
  }

  /**
   * Executes individual node logic
   */
  private static async executeNodeStep(node: WorkflowNode, contextData: Record<string, any>): Promise<any> {
    switch (node.type) {
      case 'TRIGGER': {
        return contextData.trigger || {};
      }

      case 'AGENT': {
        const rawPrompt = String(node.config?.promptTemplate || 'Bantu selesaikan tugas ini.');
        const prompt = this.interpolateVariables(rawPrompt, contextData);

        // Fetch target agent or first active agent
        let agentId = node.config?.agentId;
        if (!agentId) {
          const firstAgentRes = await pool.query('SELECT id FROM ai_agents WHERE status != \'OFFLINE\' LIMIT 1');
          agentId = firstAgentRes.rows[0]?.id || 'agent-core';
        }

        const taskResult = await executeAgentTask(agentId, prompt);
        return taskResult;
      }

      case 'RAG': {
        const rawQuery = String(node.config?.query || '');
        const query = this.interpolateVariables(rawQuery, contextData);
        const limit = Number(node.config?.limit) || 3;

        const results = await RagService.searchSimilarChunks('ws-default-command-center', query, { limit });
        const formattedContext = results
          .map((r: RagSearchResult, i: number) => `[Sumber ${i + 1} (${r.documentTitle})]: ${r.content}`)
          .join('\n\n');

        return formattedContext || '(Tidak ada dokumen relevan yang ditemukan)';
      }

      case 'CONDITION': {
        const expression = String(node.config?.expression || 'true');
        // Evaluate condition expression with context
        const conditionMet = this.safeEvaluateExpression(expression, contextData);
        return { conditionMet, expression };
      }

      case 'ACTION': {
        const toolName = String(node.config?.toolName || 'bash_exec');
        const params = node.config?.params || {};
        const interpolatedParams: Record<string, any> = {};

        for (const [key, val] of Object.entries(params)) {
          if (typeof val === 'string') {
            interpolatedParams[key] = this.interpolateVariables(val, contextData);
          } else {
            interpolatedParams[key] = val;
          }
        }

        const actionResult = await executeToolInSandbox(toolName, interpolatedParams);
        return actionResult.output;
      }

      case 'MCP_TOOL': {
        const serverId = String(node.config?.serverId || '');
        const toolName = String(node.config?.toolName || '');
        const toolArgs = node.config?.args || {};

        if (!serverId || !toolName) {
          throw new Error('MCP_TOOL node requires "serverId" and "toolName"');
        }

        const mcpResult = await McpClientService.callTool(serverId, toolName, toolArgs);
        return mcpResult.content.map((c) => c.text || JSON.stringify(c)).join('\n');
      }

      case 'ALERT': {
        const title = this.interpolateVariables(String(node.config?.title || 'Workflow Alert'), contextData);
        const message = this.interpolateVariables(
          String(node.config?.message || 'Workflow step completed successfully.'),
          contextData
        );
        const event: AlertEventType = (node.config?.eventType as AlertEventType) || 'SWARM_COMPLETED';

        await AlertingService.dispatchAlert({
          event,
          title,
          message,
          severity: 'INFO',
          timestamp: new Date().toISOString()
        });

        return { dispatched: true, title, message };
      }

      default:
        return { success: true, nodeType: node.type };
    }
  }

  /**
   * Resumes a paused execution after human approval or rejection
   */
  public static async approveExecution(
    executionId: string,
    approved: boolean,
    approver = 'Human Operator'
  ): Promise<WorkflowExecution> {
    const res = await pool.query(`SELECT * FROM workflow_executions WHERE id = $1`, [executionId]);
    if (res.rows.length === 0) {
      throw new Error(`Execution ${executionId} not found`);
    }

    const execution = this.mapRowToExecution(res.rows[0]);
    if (execution.status !== 'WAITING_APPROVAL') {
      throw new Error(`Execution is not in WAITING_APPROVAL status (Current: ${execution.status})`);
    }

    const workflow = await this.getWorkflowById(execution.workflowId);
    if (!workflow) {
      throw new Error('Associated workflow not found');
    }

    const nodeStates = { ...execution.nodeStates };
    const contextData = { ...execution.contextData };
    const currentNodeId = execution.currentNodeId;

    if (!approved) {
      if (currentNodeId) {
        nodeStates[currentNodeId] = {
          status: 'FAILED',
          error: `Ditolak oleh ${approver}`
        };
        this.skipDownstreamNodes(currentNodeId, workflow, nodeStates);
      }

      await this.updateExecutionStatus(executionId, 'CANCELLED', nodeStates, contextData);
      return (await this.getExecutionById(executionId))!;
    }

    // Approved: Mark approval node COMPLETED and resume DAG
    if (currentNodeId) {
      nodeStates[currentNodeId] = {
        status: 'COMPLETED',
        output: `Disetujui oleh ${approver} pada ${new Date().toLocaleTimeString('id-ID')}`
      };
      contextData[currentNodeId] = nodeStates[currentNodeId].output;
    }

    await this.updateExecutionStatus(executionId, 'RUNNING', nodeStates, contextData);

    setImmediate(() => {
      this.runDAGExecution(workflow, executionId, nodeStates, contextData).catch((err) => {
        systemLogger.error('SYSTEM', `DAG resumption error on ${executionId}`, err);
      });
    });

    return (await this.getExecutionById(executionId))!;
  }

  public static async getExecutionById(executionId: string): Promise<WorkflowExecution | null> {
    const res = await pool.query(`SELECT * FROM workflow_executions WHERE id = $1`, [executionId]);
    if (res.rows.length === 0) return null;
    return this.mapRowToExecution(res.rows[0]);
  }

  public static async getWorkflowExecutions(workflowId: string, limit = 20): Promise<WorkflowExecution[]> {
    const res = await pool.query(
      `SELECT * FROM workflow_executions WHERE workflow_id = $1 ORDER BY started_at DESC LIMIT $2`,
      [workflowId, limit]
    );
    return res.rows.map(this.mapRowToExecution);
  }

  private static interpolateVariables(text: string, contextData: Record<string, any>): string {
    return text.replace(/\{([\w.-]+)\}/g, (_match, key) => {
      const parts = key.split('.');
      let val: any = contextData;

      for (const p of parts) {
        if (val && typeof val === 'object' && p in val) {
          val = val[p];
        } else {
          return '';
        }
      }

      return typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
    });
  }

  private static safeEvaluateExpression(expression: string, contextData: Record<string, any>): boolean {
    try {
      // Find latest string output from contextData
      let latestOutput = '';
      for (const val of Object.values(contextData)) {
        if (typeof val === 'string') {
          latestOutput = val;
        }
      }

      const func = new Function('output', 'context', `
        try {
          return Boolean(${expression});
        } catch {
          return false;
        }
      `);

      return Boolean(func(latestOutput, contextData));
    } catch {
      return false;
    }
  }

  private static skipDownstreamNodes(
    failedNodeId: string,
    workflow: Workflow,
    nodeStates: Record<string, WorkflowNodeState>
  ): void {
    const queue = [failedNodeId];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const outgoing = workflow.edges.filter((e) => e.source === curr);
      for (const edge of outgoing) {
        if (nodeStates[edge.target]?.status === 'PENDING') {
          nodeStates[edge.target] = { status: 'SKIPPED' };
          queue.push(edge.target);
        }
      }
    }
  }

  private static async updateExecutionStatus(
    executionId: string,
    status: WorkflowExecutionStatus,
    nodeStates: Record<string, WorkflowNodeState>,
    contextData: Record<string, any>,
    currentNodeId?: string
  ): Promise<void> {
    const isFinished = status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED';
    await pool.query(
      `UPDATE workflow_executions
       SET status = $1, node_states = $2, context_data = $3, current_node_id = $4,
           completed_at = ${isFinished ? 'CURRENT_TIMESTAMP' : 'completed_at'}
       WHERE id = $5`,
      [status, JSON.stringify(nodeStates), JSON.stringify(contextData), currentNodeId || null, executionId]
    );
  }

  private static validateDAG(nodes: WorkflowNode[], edges: WorkflowEdge[]): void {
    // Detect cycles using topological sort (Kahn's algorithm)
    const inDegree = new Map<string, number>();
    const adj = new Map<string, string[]>();

    for (const node of nodes) {
      inDegree.set(node.id, 0);
      adj.set(node.id, []);
    }

    for (const edge of edges) {
      if (!inDegree.has(edge.source) || !inDegree.has(edge.target)) {
        continue;
      }
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
      adj.get(edge.source)!.push(edge.target);
    }

    const queue: string[] = [];
    for (const [nodeId, deg] of inDegree.entries()) {
      if (deg === 0) queue.push(nodeId);
    }

    let visitedCount = 0;
    while (queue.length > 0) {
      const curr = queue.shift()!;
      visitedCount++;

      for (const neighbor of adj.get(curr) || []) {
        inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
        if (inDegree.get(neighbor) === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (visitedCount < nodes.length) {
      throw new Error('Alur kerja mengandung siklus (Circular Dependency terdeteksi pada grafik DAG).');
    }
  }

  private static mapRowToWorkflow(row: any): Workflow {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      description: row.description || undefined,
      nodes: typeof row.nodes === 'string' ? JSON.parse(row.nodes) : row.nodes,
      edges: typeof row.edges === 'string' ? JSON.parse(row.edges) : row.edges,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
    };
  }

  private static mapRowToExecution(row: any): WorkflowExecution {
    return {
      id: row.id,
      workflowId: row.workflow_id,
      workspaceId: row.workspace_id,
      status: row.status,
      currentNodeId: row.current_node_id || undefined,
      nodeStates: typeof row.node_states === 'string' ? JSON.parse(row.node_states) : row.node_states,
      contextData: typeof row.context_data === 'string' ? JSON.parse(row.context_data) : row.context_data,
      startedAt: row.started_at ? new Date(row.started_at).toISOString() : new Date().toISOString(),
      completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : undefined
    };
  }
}
