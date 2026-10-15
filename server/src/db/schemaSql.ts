export const SCHEMA_SQL = `-- Database Schema for AI Agent Command Center
-- PostgreSQL 16 compatible

CREATE TABLE IF NOT EXISTS workspaces (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS human_users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    password_hash TEXT,
    role VARCHAR(32) DEFAULT 'ADMIN',
    session_token TEXT,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS model_providers (
    id VARCHAR(64) PRIMARY KEY,
    workspace_id VARCHAR(64) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    provider_type VARCHAR(64) NOT NULL,
    base_url TEXT NOT NULL,
    protocol VARCHAR(32) NOT NULL DEFAULT 'openai',
    api_key_encrypted TEXT,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    connection_status VARCHAR(32) NOT NULL DEFAULT 'NOT_CONFIGURED',
    last_checked_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_agents (
    id VARCHAR(64) PRIMARY KEY,
    workspace_id VARCHAR(64) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(64) NOT NULL,
    description TEXT,
    system_prompt TEXT NOT NULL,
    provider_id VARCHAR(64) NOT NULL REFERENCES model_providers(id) ON DELETE RESTRICT,
    model_id VARCHAR(128) NOT NULL,
    capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
    parameters_json JSONB NOT NULL DEFAULT '{"temperature": 0.7, "maxTokens": 2048}'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(32) NOT NULL DEFAULT 'READY',
    last_run_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(64) PRIMARY KEY,
    workspace_id VARCHAR(64) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    progress_percentage INTEGER NOT NULL DEFAULT 0,
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(64) PRIMARY KEY,
    workspace_id VARCHAR(64) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    project_id VARCHAR(64) REFERENCES projects(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'TODO',
    priority VARCHAR(32) NOT NULL DEFAULT 'MEDIUM',
    assigned_agent_id VARCHAR(64) REFERENCES ai_agents(id) ON DELETE SET NULL,
    due_date DATE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_history (
    id VARCHAR(64) PRIMARY KEY,
    task_id VARCHAR(64) NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    actor_type VARCHAR(32) NOT NULL,
    actor_id VARCHAR(64),
    event_type VARCHAR(64) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_runs (
    id VARCHAR(64) PRIMARY KEY,
    agent_id VARCHAR(64) NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
    task_id VARCHAR(64) REFERENCES tasks(id) ON DELETE SET NULL,
    model_id VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'QUEUED',
    input_prompt TEXT NOT NULL,
    output_result TEXT,
    error_code VARCHAR(64),
    error_message TEXT,
    duration_ms INTEGER,
    tokens_prompt INTEGER,
    tokens_completion INTEGER,
    tokens_total INTEGER,
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activities (
    id VARCHAR(64) PRIMARY KEY,
    workspace_id VARCHAR(64) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    actor_type VARCHAR(32) NOT NULL,
    actor_id VARCHAR(64),
    actor_name VARCHAR(255) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    summary TEXT NOT NULL,
    target_type VARCHAR(64),
    target_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS server_metrics (
    id VARCHAR(64) PRIMARY KEY,
    cpu_usage_percent REAL NOT NULL,
    memory_used_bytes BIGINT NOT NULL,
    memory_total_bytes BIGINT NOT NULL,
    disk_used_bytes BIGINT NOT NULL,
    disk_total_bytes BIGINT NOT NULL,
    load_avg_1m REAL NOT NULL,
    uptime_seconds BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'NORMAL',
    observed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(64) PRIMARY KEY,
    workspace_id VARCHAR(64) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    project_id VARCHAR(64) REFERENCES projects(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(64) NOT NULL DEFAULT 'SOP',
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    file_metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(64) PRIMARY KEY,
    workspace_id VARCHAR(64) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(32) NOT NULL DEFAULT 'INFO',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    target_type VARCHAR(64),
    target_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_actions (
    id VARCHAR(64) PRIMARY KEY,
    run_id VARCHAR(64) REFERENCES agent_runs(id) ON DELETE CASCADE,
    agent_id VARCHAR(64) NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
    task_id VARCHAR(64) REFERENCES tasks(id) ON DELETE SET NULL,
    tool_name VARCHAR(64) NOT NULL,
    tool_input JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    risk_level VARCHAR(32) NOT NULL DEFAULT 'MEDIUM',
    requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
    approved_by VARCHAR(64),
    output_result TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    executed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_tasks_workspace_status ON tasks(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_agents_workspace ON ai_agents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_runs_agent_created ON agent_runs(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_workspace_created ON activities(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_workspace ON documents(workspace_id, category);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(workspace_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_actions_status ON agent_actions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_actions_agent ON agent_actions(agent_id, created_at DESC);

CREATE TABLE IF NOT EXISTS document_chunks (
    id VARCHAR(64) PRIMARY KEY,
    document_id VARCHAR(64) NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    workspace_id VARCHAR(64) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    char_count INTEGER NOT NULL,
    token_count INTEGER NOT NULL,
    embedding vector(768),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_memories (
    id VARCHAR(64) PRIMARY KEY,
    agent_id VARCHAR(64) NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
    workspace_id VARCHAR(64) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    task_id VARCHAR(64) REFERENCES tasks(id) ON DELETE SET NULL,
    memory_type VARCHAR(32) NOT NULL DEFAULT 'EPISODIC',
    key_point TEXT NOT NULL,
    context TEXT,
    importance_score REAL NOT NULL DEFAULT 0.5,
    embedding vector(768),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_doc_chunks_doc_idx ON document_chunks(document_id, chunk_index);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_workspace ON document_chunks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_doc_chunks_hnsw ON document_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_agent_memories_agent ON agent_memories(agent_id, memory_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_memories_workspace ON agent_memories(workspace_id);
CREATE TABLE IF NOT EXISTS swarm_missions (
    id VARCHAR(64) PRIMARY KEY,
    workspace_id VARCHAR(64) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    objective TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PLANNING',
    coordinator_agent_id VARCHAR(64) REFERENCES ai_agents(id) ON DELETE SET NULL,
    subtasks_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    final_synthesis TEXT,
    total_duration_ms INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS swarm_messages (
    id VARCHAR(64) PRIMARY KEY,
    mission_id VARCHAR(64) NOT NULL REFERENCES swarm_missions(id) ON DELETE CASCADE,
    from_agent_id VARCHAR(64) REFERENCES ai_agents(id) ON DELETE SET NULL,
    to_agent_id VARCHAR(64) REFERENCES ai_agents(id) ON DELETE SET NULL,
    message_type VARCHAR(32) NOT NULL,
    content TEXT NOT NULL,
    metadata_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_swarm_missions_workspace_status ON swarm_missions(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_swarm_missions_created ON swarm_missions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_swarm_messages_mission ON swarm_messages(mission_id, created_at ASC);

CREATE TABLE IF NOT EXISTS agent_schedules (
    id VARCHAR(64) PRIMARY KEY,
    workspace_id VARCHAR(64) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    cron_expression VARCHAR(64) NOT NULL,
    routine_type VARCHAR(32) NOT NULL,
    target_agent_id VARCHAR(64) REFERENCES ai_agents(id) ON DELETE SET NULL,
    payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    last_status VARCHAR(32) NOT NULL DEFAULT 'IDLE',
    last_result_summary TEXT,
    total_runs INTEGER NOT NULL DEFAULT 0,
    failure_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS schedule_executions (
    id VARCHAR(64) PRIMARY KEY,
    schedule_id VARCHAR(64) NOT NULL REFERENCES agent_schedules(id) ON DELETE CASCADE,
    workspace_id VARCHAR(64) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'RUNNING',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER DEFAULT 0,
    output_summary TEXT,
    error_message TEXT,
    mission_id VARCHAR(64) REFERENCES swarm_missions(id) ON DELETE SET NULL,
    details_json JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_agent_schedules_workspace ON agent_schedules(workspace_id, is_active);
CREATE INDEX IF NOT EXISTS idx_agent_schedules_next_run ON agent_schedules(next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_schedule_executions_schedule ON schedule_executions(schedule_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_schedule_executions_workspace ON schedule_executions(workspace_id, started_at DESC);
`;

