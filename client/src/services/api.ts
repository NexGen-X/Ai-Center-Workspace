/**
 * Frontend API Service — AI Agent Command Center
 */

import {
  AIAgent,
  CreateAgentRequest,
  Task,
  TaskStatus,
  Project,
  Activity,
  ServerMetrics,
  DashboardSummary,
  ModelProviderConfig,
  CreateProviderRequest,
  UpdateProviderRequest,
  TestConnectionRequest,
  TestConnectionResponse,
  AgentRun,
  DocumentItem,
  CreateDocumentRequest,
  NotificationItem,
  FinOpsReportsSummary,
  OrchestratorStatus,
  SystemLogEntry,
  WorkspaceBackup,
  PipelineTemplate,
  PipelineExecutionResult,
  AgentAction,
  ToolDefinition,
  ExecuteActionRequest
} from '../../../shared/types.js';

const BASE_URL = '/api';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('ai_center_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
        ...options?.headers
      },
      signal: options?.signal || controller.signal,
      ...options
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      throw new Error(errorBody.error?.message || errorBody.message || `Request failed with status ${res.status}`);
    }

    return await res.json();
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`Permintaan ke ${endpoint} melebihi batas waktu (timeout 30 detik).`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const api = {
  // Auth
  login: (email: string, password: string) => request<{ token: string; user: any }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  }),
  getMe: () => request<{ authenticated: boolean; user?: any }>('/auth/me'),
  logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),
  getSetupHint: () => request<{ defaultEmail: string; hint: string }>('/auth/setup-hint'),
  changePassword: (currentPassword: string, newPassword: string) => request<{ success: boolean }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword })
  }),
  // Dashboard
  getDashboardSummary: () => request<DashboardSummary>('/dashboard/summary'),

  // Agents
  getAgents: () => request<AIAgent[]>('/agents'),
  getAgent: (id: string) => request<AIAgent>(`/agents/${id}`),
  createAgent: (data: CreateAgentRequest) => request<{ id: string; message: string }>('/agents', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateAgent: (id: string, data: Partial<AIAgent>) => request<AIAgent>(`/agents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  deleteAgent: (id: string) => request<{ success: boolean; message: string }>(`/agents/${id}`, {
    method: 'DELETE'
  }),
  getAgentRuns: (agentId: string) => request<AgentRun[]>(`/agents/${agentId}/runs`),
  executeAgentDirect: (agentId: string, prompt: string) => request<AgentRun>(`/agents/${agentId}/execute`, {
    method: 'POST',
    body: JSON.stringify({ prompt })
  }),
  pingAgent: (id: string) => request<{ success: boolean; status: string; agentStatus: string; latencyMs: number; message?: string }>(`/agents/${id}/ping`, {
    method: 'POST'
  }),
  toggleAgentEnabled: (id: string, enabled: boolean) => request<AIAgent>(`/agents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled })
  }),

  // Tasks
  getTasks: (filter?: { status?: string; projectId?: string; search?: string }) => {
    const params = new URLSearchParams();
    if (filter?.status) params.append('status', filter.status);
    if (filter?.projectId) params.append('projectId', filter.projectId);
    if (filter?.search) params.append('search', filter.search);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<Task[]>(`/tasks${qs}`);
  },
  getTask: (id: string) => request<{ task: Task; runs: AgentRun[]; history: any[] }>(`/tasks/${id}`),
  createTask: (data: Partial<Task>) => request<{ id: string; message: string }>('/tasks', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateTask: (taskId: string, data: Partial<Task>) => request<Task>(`/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  deleteTask: (taskId: string) => request<{ success: boolean; message: string }>(`/tasks/${taskId}`, {
    method: 'DELETE'
  }),
  getTaskHistory: (taskId: string) => request<any[]>(`/tasks/${taskId}/history`),
  transitionTask: (taskId: string, newStatus: TaskStatus) => request<{ success: boolean; newStatus: TaskStatus }>(`/tasks/${taskId}/transitions`, {
    method: 'POST',
    body: JSON.stringify({ newStatus })
  }),
  executeTask: (taskId: string, agentId?: string, prompt?: string) => request<AgentRun>(`/tasks/${taskId}/execute`, {
    method: 'POST',
    body: JSON.stringify({ agentId, prompt })
  }),

  // Projects
  getProjects: () => request<(Project & { totalTasks: number; completedTasks: number })[]>('/projects'),
  getProject: (id: string) => request<{ project: Project & { totalTasks: number; completedTasks: number }; tasks: Task[] }>(`/projects/${id}`),
  createProject: (data: Partial<Project>) => request<{ id: string; message: string }>('/projects', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateProject: (id: string, data: Partial<Project>) => request<Project>(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  deleteProject: (id: string) => request<{ success: boolean; message: string }>(`/projects/${id}`, {
    method: 'DELETE'
  }),

  // Activities
  getActivities: (limit = 25) => request<Activity[]>(`/activities?limit=${limit}`),

  // Monitoring
  getMonitoringSummary: () => request<ServerMetrics>('/monitoring/summary'),

  // Providers & Connection Testing
  getProviders: () => request<ModelProviderConfig[]>('/providers'),
  getProvider: (id: string) => request<ModelProviderConfig>(`/providers/${id}`),
  createProvider: (data: CreateProviderRequest) => request<ModelProviderConfig>('/providers', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateProvider: (id: string, data: UpdateProviderRequest) => request<ModelProviderConfig>(`/providers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteProvider: (id: string) => request<{ success: boolean; message: string }>(`/providers/${id}`, {
    method: 'DELETE'
  }),
  testProviderById: (id: string) => request<TestConnectionResponse>(`/providers/${id}/test-connection`, {
    method: 'POST'
  }),
  testConnection: (data: TestConnectionRequest) => request<TestConnectionResponse>('/providers/test-connection', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  discoverModels: (baseUrl: string, apiKey?: string, providerType?: string, existingProviderId?: string) => request<{ models: string[] }>('/providers/discover-models', {
    method: 'POST',
    body: JSON.stringify({ baseUrl, apiKey, providerType, existingProviderId })
  }),

  // Reports & FinOps Analytics
  getReportsSummary: (days = 30) => request<FinOpsReportsSummary>(`/reports/summary?days=${days}`),

  // Notifications
  getNotifications: (limit = 30) => request<{ notifications: NotificationItem[]; unreadCount: number }>(`/notifications?limit=${limit}`),
  markNotificationRead: (id: string) => request<{ success: boolean }>(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => request<{ success: boolean }>('/notifications/read-all', { method: 'POST' }),

  // Documents & Knowledge Base
  getDocuments: (category?: string) => request<DocumentItem[]>(`/documents${category ? `?category=${category}` : ''}`),
  getDocument: (id: string) => request<DocumentItem>(`/documents/${id}`),
  createDocument: (data: CreateDocumentRequest) => request<DocumentItem>('/documents', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateDocument: (id: string, data: Partial<DocumentItem>) => request<DocumentItem>(`/documents/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteDocument: (id: string) => request<{ success: boolean; message: string }>(`/documents/${id}`, {
    method: 'DELETE'
  }),

  // Autonomous Orchestrator Daemon
  getOrchestratorStatus: () => request<OrchestratorStatus>('/orchestrator/status'),
  toggleOrchestrator: (enabled?: boolean) => request<{ success: boolean; enabled: boolean; status: OrchestratorStatus }>('/orchestrator/toggle', {
    method: 'POST',
    body: JSON.stringify({ enabled })
  }),
  runOrchestratorNow: () => request<{ success: boolean; message: string; status: OrchestratorStatus }>('/orchestrator/run-now', {
    method: 'POST'
  }),
  configOrchestrator: (intervalSeconds: number) => request<{ success: boolean; status: OrchestratorStatus }>('/orchestrator/config', {
    method: 'POST',
    body: JSON.stringify({ intervalSeconds })
  }),

  // Live System Telemetry Logs
  getSystemLogs: (limit = 100, category?: string, level?: string) => {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    if (category) params.set('category', category);
    if (level) params.set('level', level);
    return request<{ logs: SystemLogEntry[] }>(`/monitoring/logs?${params.toString()}`);
  },
  clearSystemLogs: () => request<{ success: boolean; message: string }>('/monitoring/logs/clear', {
    method: 'POST'
  }),

  // Workspace Backup & Restore
  getSystemBackup: () => request<WorkspaceBackup>('/system/backup'),
  restoreSystemBackup: (backup: WorkspaceBackup) => request<{ success: boolean; message: string; restoredEntities: any }>('/system/restore', {
    method: 'POST',
    body: JSON.stringify(backup)
  }),

  // AI Playground & Benchmark
  executePlayground: (data: {
    prompt: string;
    globalSystemPrompt?: string;
    targets: {
      slotId: 'A' | 'B';
      providerId: string;
      modelId: string;
      customSystemPrompt?: string;
      temperature?: number;
      maxTokens?: number;
    }[];
  }) => request<{
    results: {
      slotId: 'A' | 'B';
      providerId: string;
      providerName: string;
      modelId: string;
      success: boolean;
      status: string;
      outputResult?: string;
      durationMs: number;
      tokensUsed?: { promptTokens: number; completionTokens: number; totalTokens: number };
      errorMessage?: string;
    }[];
  }>('/playground/execute', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // Webhooks
  getWebhookInfo: () => request<{ status: string; endpoints: any }>('/webhooks/info'),
  dispatchWebhookTask: (data: any) => request<{ success: boolean; taskId: string; message: string }>('/webhooks/dispatch-task', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // Multi-Agent Swarm Pipeline
  getPipelineTemplates: () => request<{ templates: PipelineTemplate[] }>('/pipeline/templates'),
  decomposePipeline: (data: { title?: string; objective: string; templateId?: string; projectId?: string }) =>
    request<{
      pipelineId: string;
      title: string;
      objective: string;
      templateId: string;
      templateName: string;
      projectId?: string;
      stages: any[];
    }>('/pipeline/decompose', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  executePipeline: (data: { title?: string; objective: string; projectId?: string; stages: any[] }) =>
    request<PipelineExecutionResult>('/pipeline/execute', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // Agent Actions & Sandbox Tools (Human-in-the-Loop)
  getActions: (status?: string, limit = 50) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (limit) params.set('limit', String(limit));
    return request<{ actions: AgentAction[] }>(`/actions?${params.toString()}`);
  },
  getPendingActionsCount: () => request<{ pendingCount: number }>('/actions/pending-count'),
  getTools: () => request<{ tools: ToolDefinition[] }>('/actions/tools'),
  requestAction: (data: ExecuteActionRequest) => request<AgentAction>('/actions/request', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  approveAction: (actionId: string, operatorId?: string) => request<AgentAction>(`/actions/${actionId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ operatorId })
  }),
  rejectAction: (actionId: string, operatorId?: string, reason?: string) => request<AgentAction>(`/actions/${actionId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ operatorId, reason })
  })
};
