/**
 * Unified Shared Types & Contracts — AI Agent Command Center
 * Sesuai spesifikasi Rancangan_Arsitektur_AI_Command_Center_Antigravity.md
 */

export type ProtocolType = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'hermes_runtime';

export type ProviderType =
  | 'custom_api'
  | 'routex_local'
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'groq'
  | 'ollama'
  | 'hermes';

export type ConnectionStatus =
  | 'NOT_CONFIGURED'
  | 'CONNECTION_OK'
  | 'CONNECTION_FAILED'
  | 'MODEL_VERIFIED'
  | 'UNAVAILABLE';

export type AgentStatus =
  | 'READY'
  | 'IDLE'
  | 'BUSY'
  | 'UNAVAILABLE'
  | 'DISABLED';

export type AgentRole =
  | 'Orchestrator'
  | 'Planner'
  | 'Executor'
  | 'QA / Reviewer'
  | 'DevOps'
  | 'Domain Specialist';

export type RunStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'WAITING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED';

export type TaskStatus =
  | 'TODO'
  | 'IN_PROGRESS'
  | 'IN_REVIEW'
  | 'DONE'
  | 'CANCELLED';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ModelProviderConfig {
  id: string;
  name: string;
  providerType: ProviderType;
  baseUrl: string;
  protocol: ProtocolType;
  apiKeyMasked?: string;
  enabled: boolean;
  connectionStatus: ConnectionStatus;
  lastCheckedAt?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  agentCount?: number;
}

export interface AIAgent {
  id: string;
  workspaceId: string;
  name: string;
  role: AgentRole;
  description: string;
  systemPrompt: string;
  providerId: string;
  modelId: string;
  capabilities: string[];
  parameters: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  };
  enabled: boolean;
  status: AgentStatus;
  lastRunAt?: string;
  createdAt: string;
  updatedAt: string;
  // Joined provider metadata for UI display
  providerName?: string;
  providerType?: ProviderType;
  // Computed productivity & execution statistics
  totalTasks?: number;
  completedTasks?: number;
  totalRuns?: number;
}

export interface AgentRun {
  id: string;
  agentId: string;
  taskId?: string;
  modelId: string;
  status: RunStatus;
  inputPrompt: string;
  outputResult?: string;
  errorCode?: string;
  errorMessage?: string;
  durationMs?: number;
  tokensUsed?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
}

export interface Task {
  id: string;
  workspaceId: string;
  projectId?: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedAgentId?: string;
  assignedAgentName?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  status: 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'ON_HOLD';
  progressPercentage: number;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  workspaceId: string;
  actorType: 'AGENT' | 'USER' | 'SYSTEM';
  actorId?: string;
  actorName: string;
  eventType: string;
  summary: string;
  targetType?: string;
  targetId?: string;
  createdAt: string;
}

export interface ServerMetrics {
  cpuUsagePercent: number;
  cpuCores: number;
  memoryTotalBytes: number;
  memoryUsedBytes: number;
  memoryFreeBytes: number;
  memoryUsagePercent: number;
  diskTotalBytes: number;
  diskUsedBytes: number;
  diskUsagePercent: number;
  loadAvg: [number, number, number];
  uptimeSeconds: number;
  observedAt: string;
  status: 'NORMAL' | 'WARNING' | 'CRITICAL';
}

export interface DashboardSummary {
  runningTasksCount: number;
  completedTasksCount: number;
  onlineAgentsCount: number;
  totalAgentsCount: number;
  activeProjectsCount: number;
  systemStatus: 'OPERATIONAL' | 'DEGRADED' | 'MAINTENANCE';
  serverMetrics: ServerMetrics;
}

// Request & Response DTOs
export interface TestConnectionRequest {
  providerType: ProviderType;
  baseUrl: string;
  protocol: ProtocolType;
  apiKey?: string;
  existingProviderId?: string;
}

export interface TestConnectionResponse {
  success: boolean;
  status: ConnectionStatus;
  message: string;
  discoveredModels?: string[];
  latencyMs?: number;
}

export interface CreateProviderRequest {
  name: string;
  providerType: ProviderType;
  baseUrl: string;
  protocol?: ProtocolType;
  apiKey?: string;
  enabled?: boolean;
}

export interface UpdateProviderRequest {
  name?: string;
  providerType?: ProviderType;
  baseUrl?: string;
  protocol?: ProtocolType;
  apiKey?: string;
  enabled?: boolean;
}

export interface CreateAgentRequest {
  name: string;
  role: AgentRole;
  description: string;
  systemPrompt: string;
  providerMode: 'existing' | 'new_custom' | 'new_preset' | 'hermes_runtime';
  providerId?: string;
  newProvider?: {
    name: string;
    providerType: ProviderType;
    baseUrl: string;
    protocol: ProtocolType;
    apiKey?: string;
  };
  modelId: string;
  capabilities?: string[];
  parameters?: {
    temperature?: number;
    maxTokens?: number;
  };
}

export interface ExecuteAgentRunRequest {
  agentId: string;
  taskId?: string;
  prompt: string;
}

export type DocumentCategory = 'SOP' | 'SPEC' | 'PROMPT_TEMPLATE' | 'ARCHITECTURE' | 'NOTE';

export interface DocumentItem {
  id: string;
  workspaceId: string;
  projectId?: string;
  title: string;
  content: string;
  category: DocumentCategory;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  chunkCount?: number;
  isIndexed?: boolean;
}

export interface CreateDocumentRequest {
  title: string;
  content: string;
  category: DocumentCategory;
  tags?: string[];
  projectId?: string;
}

export type NotificationType = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

export interface NotificationItem {
  id: string;
  workspaceId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  targetType?: string;
  targetId?: string;
  createdAt: string;
}

export interface AgentMetric {
  agentId: string;
  agentName: string;
  role: string;
  totalRuns: number;
  successCount: number;
  failureCount: number;
  avgDurationMs: number;
  totalTokens: number;
}

export interface ModelMetric {
  modelId: string;
  totalRuns: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  avgDurationMs: number;
  estimatedCostUsd: number;
}

export interface FinOpsReportsSummary {
  periodDays: number;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  successRatePercent: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  estimatedTotalCostUsd: number;
  averageLatencyMs: number;
  agentMetrics: AgentMetric[];
  modelMetrics: ModelMetric[];
  dailyUsage: {
    date: string;
    runs: number;
    tokens: number;
  }[];
}

export interface OrchestratorStatus {
  enabled: boolean;
  isRunning: boolean;
  intervalSeconds: number;
  activeTasksCount: number;
  completedTasksToday: number;
  lastTickAt: string | null;
  lastDispatchedTaskId?: string;
  lastDispatchedAgentName?: string;
}

export interface OrchestratorConfig {
  enabled: boolean;
  intervalSeconds?: number;
}

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  category: 'ORCHESTRATOR' | 'INFERENCE' | 'API' | 'SYSTEM' | 'SECURITY';
  message: string;
  meta?: any;
}

export interface WorkspaceBackup {
  version: string;
  exportedAt: string;
  workspaceId: string;
  data: {
    projects: Project[];
    tasks: Task[];
    agents: AIAgent[];
    documents: DocumentItem[];
    providers: ModelProviderConfig[];
    activities: Activity[];
  };
}

// Swarm & Multi-Agent Pipeline Types
export interface PipelineStageConfig {
  id: string;
  name: string;
  role: AgentRole;
  agentId?: string;
  agentName?: string;
  stagePromptTemplate: string;
}

export interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  stages: PipelineStageConfig[];
}

export interface PipelineStageExecution {
  stageId: string;
  stageName: string;
  agentId: string;
  agentName: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  prompt: string;
  output?: string;
  durationMs?: number;
  tokensUsed?: number;
  error?: string;
}

export interface PipelineExecutionResult {
  pipelineId: string;
  masterTaskId: string;
  title: string;
  objective: string;
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL';
  totalDurationMs: number;
  stages: PipelineStageExecution[];
  finalSummary: string;
}

// Agent Tool Calling & Action Sandbox Types
export type ToolRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ActionApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'FAILED';

export interface ToolDefinition {
  name: string;
  description: string;
  category: 'SYSTEM' | 'FILESYSTEM' | 'NETWORK' | 'RUNTIME';
  riskLevel: ToolRiskLevel;
  requiresApproval: boolean;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
}

export interface AgentAction {
  id: string;
  runId?: string;
  agentId: string;
  agentName?: string;
  taskId?: string;
  taskTitle?: string;
  toolName: string;
  toolInput: Record<string, any>;
  status: ActionApprovalStatus;
  riskLevel: ToolRiskLevel;
  requiresApproval: boolean;
  approvedBy?: string;
  outputResult?: string;
  errorMessage?: string;
  createdAt: string;
  executedAt?: string;
}

export interface ExecuteActionRequest {
  agentId: string;
  toolName: string;
  toolInput: Record<string, any>;
  taskId?: string;
  runId?: string;
  autoApprove?: boolean;
}

// RAG & Semantic Vector Memory Types
export interface DocumentChunk {
  id: string;
  documentId: string;
  workspaceId: string;
  chunkIndex: number;
  content: string;
  charCount: number;
  tokenCount: number;
  similarity?: number;
  documentTitle?: string;
  category?: DocumentCategory;
  createdAt: string;
}

export interface RagSearchResult {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  category: DocumentCategory;
  chunkIndex: number;
  content: string;
  similarity: number; // 0.0 to 1.0 (cosine similarity)
  distance: number;   // cosine distance
}

export interface RagSearchRequest {
  query: string;
  limit?: number;
  minSimilarity?: number;
  category?: DocumentCategory;
  projectId?: string;
}

export interface RagIndexStats {
  totalDocuments: number;
  indexedDocuments: number;
  totalChunks: number;
  totalMemories: number;
  embeddingDimensions: number;
  storageEngine: string;
}

export type AgentMemoryType = 'EPISODIC' | 'FACTUAL' | 'PREFERENCE' | 'GOAL';

export interface AgentMemoryItem {
  id: string;
  agentId: string;
  agentName?: string;
  workspaceId: string;
  taskId?: string;
  taskTitle?: string;
  memoryType: AgentMemoryType;
  keyPoint: string;
  context?: string;
  importanceScore: number; // 0.1 to 1.0
  similarity?: number;
  createdAt: string;
}

export interface StoreMemoryRequest {
  agentId: string;
  taskId?: string;
  memoryType?: AgentMemoryType;
  keyPoint: string;
  context?: string;
  importanceScore?: number;
}

// Autonomous Multi-Agent Swarm & Hierarchical Delegation Mesh Types
export type SwarmMissionStatus = 'PLANNING' | 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type SwarmSubtaskStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
export type SwarmMessageType = 'DELEGATION' | 'HANDOFF' | 'FEEDBACK' | 'SYNTHESIS';

export interface SwarmSubtask {
  id: string;
  title: string;
  role: AgentRole;
  assignedAgentId?: string;
  assignedAgentName?: string;
  status: SwarmSubtaskStatus;
  dependencies: string[]; // IDs of predecessor subtasks
  promptTemplate: string;
  outputResult?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  feedbackLoopCount?: number;
  revisions?: { iteration: number; critique: string; patchResult: string; timestamp: string }[];
}

export interface SwarmMission {
  id: string;
  workspaceId: string;
  title: string;
  objective: string;
  status: SwarmMissionStatus;
  coordinatorAgentId?: string;
  coordinatorAgentName?: string;
  subtasks: SwarmSubtask[];
  finalSynthesis?: string;
  totalDurationMs?: number;
  totalTokens?: number;
  selfCorrectionCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SwarmMessage {
  id: string;
  missionId: string;
  fromAgentId?: string;
  fromAgentName?: string;
  toAgentId?: string;
  toAgentName?: string;
  messageType: SwarmMessageType;
  content: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface SwarmPlanRequest {
  objective: string;
  workspaceId?: string;
}

export interface SwarmPlanResponse {
  coordinatorAgent: AIAgent;
  title: string;
  objective: string;
  subtasks: SwarmSubtask[];
}

export interface SwarmDispatchRequest {
  objective: string;
  title?: string;
  subtasks?: SwarmSubtask[];
  coordinatorAgentId?: string;
  workspaceId?: string;
}



