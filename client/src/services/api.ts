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
  TestConnectionRequest,
  TestConnectionResponse,
  AgentRun,
  DocumentItem,
  CreateDocumentRequest,
  NotificationItem,
  FinOpsReportsSummary
} from '../../../shared/types.js';

const BASE_URL = '/api';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('ai_center_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
      ...options?.headers
    },
    ...options
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error?.message || errorBody.message || `Request failed with status ${res.status}`);
  }

  return res.json();
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
  testConnection: (data: TestConnectionRequest) => request<TestConnectionResponse>('/providers/test-connection', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  discoverModels: (baseUrl: string, apiKey?: string, providerType?: string) => request<{ models: string[] }>('/providers/discover-models', {
    method: 'POST',
    body: JSON.stringify({ baseUrl, apiKey, providerType })
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
  })
};
