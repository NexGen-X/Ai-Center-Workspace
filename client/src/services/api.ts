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
  AgentRun
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
  getAgentRuns: (agentId: string) => request<AgentRun[]>(`/agents/${agentId}/runs`),

  // Tasks
  getTasks: (filter?: { status?: string; projectId?: string }) => {
    const params = new URLSearchParams();
    if (filter?.status) params.append('status', filter.status);
    if (filter?.projectId) params.append('projectId', filter.projectId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return request<Task[]>(`/tasks${qs}`);
  },
  createTask: (data: Partial<Task>) => request<{ id: string; message: string }>('/tasks', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  transitionTask: (taskId: string, newStatus: TaskStatus) => request<{ success: boolean; newStatus: TaskStatus }>(`/tasks/${taskId}/transitions`, {
    method: 'POST',
    body: JSON.stringify({ newStatus })
  }),
  executeTask: (taskId: string, agentId?: string, prompt?: string) => request<AgentRun>(`/tasks/${taskId}/execute`, {
    method: 'POST',
    body: JSON.stringify({ agentId, prompt })
  }),

  // Projects
  getProjects: () => request<Project[]>('/projects'),
  createProject: (data: Partial<Project>) => request<{ id: string; message: string }>('/projects', {
    method: 'POST',
    body: JSON.stringify(data)
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
  })
};
