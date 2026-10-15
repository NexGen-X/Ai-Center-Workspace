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

export type DocumentCategory = 'SOP' | 'SPEC' | 'PROMPT_TEMPLATE' | 'ARCHITECTURE' | 'NOTE' | 'RESEARCH';

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
  fileMetadata?: {
    originalFileName?: string;
    fileType?: string;
    fileSize?: number;
    rowCount?: number;
    parsedFormat?: string;
  };
}

export interface CreateDocumentRequest {
  title: string;
  content: string;
  category: DocumentCategory;
  tags?: string[];
  projectId?: string;
}

export interface UploadDocumentRequest {
  fileName: string;
  fileType: string;
  fileContentBase64: string;
  category?: DocumentCategory;
  tags?: string[];
  projectId?: string;
  workspaceId?: string;
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

// Proactive Autonomous Routines & Cron Scheduler Types
export type ScheduleRoutineType =
  | 'SWARM_MISSION'
  | 'SECURITY_AUDIT'
  | 'HEALTH_CHECK'
  | 'VECTOR_REINDEX'
  | 'AGENT_TASK';

export type ScheduleStatus = 'IDLE' | 'RUNNING' | 'SUCCESS' | 'FAILED';

export interface AgentSchedule {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  cronExpression: string;
  routineType: ScheduleRoutineType;
  targetAgentId?: string;
  targetAgentName?: string;
  payload: Record<string, any>;
  isActive: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  lastStatus: ScheduleStatus;
  lastResultSummary?: string;
  totalRuns: number;
  failureCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleExecution {
  id: string;
  scheduleId: string;
  scheduleTitle?: string;
  routineType: ScheduleRoutineType;
  workspaceId: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED';
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  outputSummary?: string;
  errorMessage?: string;
  missionId?: string;
  details?: Record<string, any>;
}

export interface CreateScheduleDTO {
  title: string;
  description?: string;
  cronExpression: string;
  routineType: ScheduleRoutineType;
  targetAgentId?: string;
  payload?: Record<string, any>;
  isActive?: boolean;
  workspaceId?: string;
}

export interface UpdateScheduleDTO {
  title?: string;
  description?: string;
  cronExpression?: string;
  routineType?: ScheduleRoutineType;
  targetAgentId?: string;
  payload?: Record<string, any>;
  isActive?: boolean;
}

// Swarm Artifact Bundler & Git PR Generator Types
export interface SwarmExtractedFile {
  filePath: string;
  language: string;
  content: string;
  sourceSubtaskTitle: string;
  sourceAgentRole: AgentRole;
}

export interface SwarmArtifactBundle {
  missionId: string;
  missionTitle: string;
  objective: string;
  status: SwarmMissionStatus;
  markdownReport: string;
  extractedFiles: SwarmExtractedFile[];
  unifiedPatch: string;
  gitBranchCreated?: string;
  gitCommitHash?: string;
  generatedAt: string;
}

export interface CreateGitBranchRequest {
  branchName?: string;
  commitMessage?: string;
}

export interface CreateGitBranchResponse {
  success: boolean;
  branchName: string;
  commitHash: string;
  filesCommitted: string[];
  message: string;
}

// Outbound Alerting & Webhook Incident Dispatcher Types
export type AlertPlatform = 'DISCORD' | 'SLACK' | 'TELEGRAM' | 'GENERIC';

export type AlertEventType =
  | 'SECURITY_ALERT'
  | 'SWARM_COMPLETED'
  | 'ACTION_PENDING'
  | 'SCHEDULE_FAILED'
  | 'SYSTEM_ANOMALY';

export interface AlertWebhookItem {
  id: string;
  workspaceId: string;
  name: string;
  platform: AlertPlatform;
  webhookUrl: string;
  secretToken?: string;
  events: AlertEventType[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAlertWebhookRequest {
  name: string;
  platform: AlertPlatform;
  webhookUrl: string;
  secretToken?: string;
  events?: AlertEventType[];
  isActive?: boolean;
}

export interface UpdateAlertWebhookRequest {
  name?: string;
  platform?: AlertPlatform;
  webhookUrl?: string;
  secretToken?: string;
  events?: AlertEventType[];
  isActive?: boolean;
}

export interface AlertPayload {
  event: AlertEventType;
  title: string;
  message: string;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
  metadata?: Record<string, any>;
  timestamp?: string;
}

export interface AlertDeliveryLog {
  id: string;
  webhookId: string;
  workspaceId: string;
  eventType: string;
  payload: any;
  statusCode?: number;
  success: boolean;
  errorMessage?: string;
  createdAt: string;
}

// Automated Agent Evals & LLM-as-a-Judge Types
export type EvalCategory = 'CODING' | 'ARCHITECTURE' | 'SECURITY' | 'ANTI_HALLUCINATION';

export interface EvalBenchmarkItem {
  id: string;
  workspaceId: string;
  category: EvalCategory;
  title: string;
  prompt: string;
  referenceAnswer?: string;
  evaluationCriteria: string;
  createdAt: string;
}

export interface EvalRunResult {
  id: string;
  workspaceId: string;
  benchmarkId: string;
  benchmarkTitle?: string;
  benchmarkCategory?: EvalCategory;
  providerConfigId?: string;
  modelName: string;
  agentOutput: string;
  latencyMs: number;
  tokensUsed: number;
  costUsd: number;
  judgeScoreCorrectness: number;
  judgeScoreFaithfulness: number;
  judgeVerdict: string;
  judgeModel: string;
  createdAt: string;
}

export interface RunEvalRequest {
  benchmarkId: string;
  providerId: string;
  modelId: string;
  judgeProviderId?: string;
  judgeModelId?: string;
}

export interface EvalLeaderboardEntry {
  modelName: string;
  totalRuns: number;
  avgCorrectness: number;
  avgFaithfulness: number;
  overallScore: number;
  avgLatencyMs: number;
  totalCostUsd: number;
}

// Model Context Protocol (MCP) Client Types
export type McpTransport = 'stdio' | 'sse';
export type McpServerStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

export interface McpToolSchema {
  type: string;
  properties?: Record<string, any>;
  required?: string[];
}

export interface McpTool {
  serverId: string;
  serverName: string;
  name: string;
  description?: string;
  inputSchema: McpToolSchema;
}

export interface McpServer {
  id: string;
  name: string;
  description?: string;
  transport: McpTransport;
  command?: string;
  args: string[];
  env: Record<string, string>;
  url?: string;
  status: McpServerStatus;
  enabled: boolean;
  toolsCache: McpTool[];
  createdAt: string;
  updatedAt: string;
}

export interface McpToolCallRequest {
  serverId: string;
  toolName: string;
  arguments: Record<string, any>;
}

export interface McpToolCallResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

export interface McpServerTemplate {
  id: string;
  name: string;
  description: string;
  transport: McpTransport;
  command: string;
  args: string[];
  env?: Record<string, string>;
  defaultTools: string[];
}

// Visual Drag-and-Drop DAG Workflow Studio Types
export type WorkflowNodeType =
  | 'TRIGGER'
  | 'AGENT'
  | 'RAG'
  | 'CONDITION'
  | 'ACTION'
  | 'MCP_TOOL'
  | 'HUMAN_APPROVAL'
  | 'ALERT';

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  label: string;
  position: { x: number; y: number };
  config: Record<string, any>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  label?: string;
}

export interface Workflow {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type WorkflowExecutionStatus =
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'WAITING_APPROVAL'
  | 'CANCELLED';

export interface WorkflowNodeState {
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED' | 'WAITING_APPROVAL';
  output?: any;
  error?: string;
  durationMs?: number;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  workspaceId: string;
  status: WorkflowExecutionStatus;
  currentNodeId?: string;
  nodeStates: Record<string, WorkflowNodeState>;
  contextData: Record<string, any>;
  startedAt: string;
  completedAt?: string;
}

// Multi-Agent War Room & Live Debate Types
export type WarRoomStatus = 'ACTIVE' | 'CONCLUDED' | 'ARCHIVED';

export type DebateRole =
  | 'LEAD_ARCHITECT'
  | 'SECURITY_ANALYST'
  | 'DEV_LEAD'
  | 'PERFORMANCE_CRITIC'
  | 'MODERATOR'
  | 'SPECIALIST';

export interface WarRoomParticipant {
  id: string;
  warRoomId: string;
  agentId: string;
  roleInDebate: DebateRole;
  joinedAt: string;
  agentName?: string;
  agentRole?: string;
}

export interface WarRoomMessage {
  id: string;
  warRoomId: string;
  senderType: 'USER' | 'AGENT' | 'MODERATOR';
  senderId: string;
  senderName: string;
  content: string;
  roundNumber: number;
  isConsensusProposal?: boolean;
  critiqueTargetId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface WarRoom {
  id: string;
  workspaceId: string;
  title: string;
  topic: string;
  status: WarRoomStatus;
  consensusSummary?: string;
  participants: WarRoomParticipant[];
  messages?: WarRoomMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateWarRoomRequest {
  title: string;
  topic: string;
  agentIds: string[];
  roles?: Record<string, DebateRole>;
}

export interface DeliberateRoundRequest {
  roundNumber?: number;
  userPrompt?: string;
  targetAgentId?: string;
}

export interface ConvertWarRoomToTaskRequest {
  title?: string;
  projectId?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

// Autonomous Web Research & Live Browser Types
export interface WebSearchResultItem {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchResponse {
  query: string;
  results: WebSearchResultItem[];
  totalResults: number;
}

export interface WebBrowseResponse {
  url: string;
  title: string;
  markdownContent: string;
  metaDescription?: string;
  contentLength: number;
}

export interface WebResearchAndIngestRequest {
  query: string;
  documentTitle?: string;
  category?: DocumentCategory;
  tags?: string[];
  projectId?: string;
  workspaceId?: string;
}

export interface WebResearchAndIngestResponse {
  success: boolean;
  documentId: string;
  title: string;
  category: DocumentCategory;
  chunksIndexed: number;
  sources: Array<{ title: string; url: string }>;
  summary: string;
}





