/**
 * Visual DAG Workflows Router — AI Center
 * Endpoints for managing DAG workflows, templates, starting executions, and human approval gates.
 */

import { Router, Request, Response } from 'express';
import { WorkflowEngine, POPULAR_WORKFLOW_TEMPLATES } from '../services/workflowEngine.js';
import { systemLogger } from '../services/logger.js';

export const workflowsRouter = Router();

// GET /api/workflows - List all workflows
workflowsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const workspaceId = (req.query.workspaceId as string) || 'ws-default-command-center';
    const workflows = await WorkflowEngine.getAllWorkflows(workspaceId);
    res.json({
      success: true,
      data: workflows
    });
  } catch (err: any) {
    systemLogger.error('API', 'Failed to retrieve workflows', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/workflows/templates - Pre-configured DAG workflow templates
workflowsRouter.get('/templates', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: POPULAR_WORKFLOW_TEMPLATES
  });
});

// GET /api/workflows/executions/:id - Get specific execution status & node states
workflowsRouter.get('/executions/:id', async (req: Request, res: Response) => {
  try {
    const execution = await WorkflowEngine.getExecutionById(req.params.id);
    if (!execution) {
      return res.status(404).json({ error: 'Execution not found' });
    }
    res.json({
      success: true,
      data: execution
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workflows/executions/:id/approve - Approve or reject human approval gate
workflowsRouter.post('/executions/:id/approve', async (req: Request, res: Response) => {
  try {
    const { approved, approver } = req.body;
    if (approved === undefined) {
      return res.status(400).json({ error: 'Field "approved" (boolean) is required' });
    }

    const updated = await WorkflowEngine.approveExecution(
      req.params.id,
      Boolean(approved),
      approver || 'Human Operator'
    );

    res.json({
      success: true,
      data: updated
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/workflows/:id - Get specific workflow
workflowsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const workflow = await WorkflowEngine.getWorkflowById(req.params.id);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    res.json({
      success: true,
      data: workflow
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workflows - Create a new workflow
workflowsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, nodes, edges, isActive, workspaceId } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Field "name" is required' });
    }

    if (!Array.isArray(nodes)) {
      return res.status(400).json({ error: 'Field "nodes" must be an array' });
    }

    const workflow = await WorkflowEngine.createWorkflow({
      name,
      description,
      nodes,
      edges: edges || [],
      isActive,
      workspaceId
    });

    res.status(201).json({
      success: true,
      data: workflow
    });
  } catch (err: any) {
    systemLogger.error('API', 'Failed to create workflow', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/workflows/:id - Update workflow definition
workflowsRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const updated = await WorkflowEngine.updateWorkflow(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    res.json({
      success: true,
      data: updated
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/workflows/:id - Delete workflow
workflowsRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await WorkflowEngine.deleteWorkflow(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Workflow not found' });
    }
    res.json({
      success: true,
      message: 'Workflow deleted successfully'
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workflows/:id/execute - Trigger DAG workflow execution
workflowsRouter.post('/:id/execute', async (req: Request, res: Response) => {
  try {
    const initialPayload = req.body || {};
    const execution = await WorkflowEngine.executeWorkflow(req.params.id, initialPayload);

    res.status(202).json({
      success: true,
      data: execution
    });
  } catch (err: any) {
    systemLogger.error('API', `Failed to execute workflow: ${req.params.id}`, err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/workflows/:id/executions - Get recent executions of workflow
workflowsRouter.get('/:id/executions', async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 20;
    const executions = await WorkflowEngine.getWorkflowExecutions(req.params.id, limit);
    res.json({
      success: true,
      data: executions
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
