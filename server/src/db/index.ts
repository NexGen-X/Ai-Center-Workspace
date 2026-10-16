import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config/index.js';
import { encryptSecret } from '../utils/crypto.js';
import { hashPassword } from '../utils/auth.js';
import { SCHEMA_SQL } from './schemaSql.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 30000, // 30s query execution ceiling
  query_timeout: 35000     // 35s client timeout
});

// Prevent unhandled errors on idle clients from crashing the process
pool.on('error', (err) => {
  console.error('[PostgreSQL Pool Idle Client Error]', err);
});

/**
 * Health check helper for PostgreSQL connection pool
 */
export async function checkDatabaseHealth(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const res = await pool.query('SELECT 1 as alive;');
    return { ok: res.rows[0]?.alive === 1, latencyMs: Date.now() - start };
  } catch (err: any) {
    return { ok: false, latencyMs: Date.now() - start, error: err.message };
  }
}

/**
 * Run migrations and initial seeds idempotently
 */
export async function initializeDatabase(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log('[DB] Connecting to PostgreSQL database...');
    
    // Run schema migrations idempotently
    await client.query(SCHEMA_SQL);
    await client.query(`
      ALTER TABLE human_users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT TRUE;
    `);
    console.log('[DB] Schema migrations applied successfully.');

    // Seed default workspace
    await client.query(`
      INSERT INTO workspaces (id, name)
      VALUES ($1, $2)
      ON CONFLICT (id) DO NOTHING;
    `, [config.defaultWorkspaceId, 'Command Center Headquarters']);

    // Seed default human operator user (only if not already created)
    const defaultPasswordHash = hashPassword('Admin#AiCenter2026!');
    await client.query(`
      INSERT INTO human_users (id, email, display_name, password_hash, must_change_password)
      VALUES ($1, $2, $3, $4, TRUE)
      ON CONFLICT (id) DO NOTHING;
    `, ['user-admin', 'operator@ai-center.local', 'Lead Command Operator', defaultPasswordHash]);

    // Seed default Route-X provider if not exists
    const provRes = await client.query(`
      SELECT id FROM model_providers WHERE id = 'prov-routex-local';
    `);

    if (provRes.rows.length === 0) {
      await client.query(`
        INSERT INTO model_providers (
          id, workspace_id, name, provider_type, base_url, protocol, api_key_encrypted, enabled, connection_status
        ) VALUES (
          'prov-routex-local', $1, 'Route-X Local Gateway', 'routex_local', 'http://localhost:8080/v1', 'openai', $2, TRUE, 'CONNECTION_OK'
        );
      `, [config.defaultWorkspaceId, encryptSecret('default-local-token')]);
      console.log('[DB] Seeded Route-X Local Gateway provider.');
    }

    // Seed default initial AI Team agents if none exist
    const agentRes = await client.query(`
      SELECT count(*) as count FROM ai_agents WHERE workspace_id = $1;
    `, [config.defaultWorkspaceId]);

    if (parseInt(agentRes.rows[0].count, 10) === 0) {
      console.log('[DB] Seeding core AI Team agents (Orchestrator, Planner, Executor, QA, DevOps)...');
      
      const seedAgents = [
        {
          id: 'agent-orchestrator',
          name: 'Nexus Prime',
          role: 'Orchestrator',
          description: 'Kepala orkestrator sistem yang mendelegasikan tugas dan memantau status operasional AI Team.',
          systemPrompt: 'Anda adalah Lead AI Orchestrator untuk AI Agent Command Center. Kelola alur kerja dengan presisi dan integritas.',
          modelId: 'coding-fast',
          capabilities: JSON.stringify(['task_delegation', 'workflow_routing', 'state_monitoring'])
        },
        {
          id: 'agent-planner',
          name: 'Athena Stratos',
          role: 'Planner',
          description: 'Spesialis perencanaan arsitektur, graf dependensi, dan dekomposisi acceptance criteria.',
          systemPrompt: 'Anda adalah AI Planner. Analisis kebutuhan, periksa dependensi, dan susun kriteria penerimaan yang terukur.',
          modelId: 'claude-3-7-sonnet',
          capabilities: JSON.stringify(['action_planning', 'dependency_mapping', 'acceptance_criteria'])
        },
        {
          id: 'agent-executor',
          name: 'Vulcan Forge',
          role: 'Executor',
          description: 'Agen eksekutor implementasi kode, pemanggilan tool, dan otomatisasi tugas teknis.',
          systemPrompt: 'Anda adalah Vulcan, spesialis eksekusi tugas teknis berorientasi hasil bersih dan aman.',
          modelId: 'coding-fast',
          capabilities: JSON.stringify(['code_generation', 'tool_calling', 'pipeline_execution'])
        },
        {
          id: 'agent-qa',
          name: 'Aegis Sentinel',
          role: 'QA / Reviewer',
          description: 'Auditor independen yang memverifikasi acceptance criteria empiris dan kepatuhan anti-halusinasi.',
          systemPrompt: 'Anda adalah Aegis Sentinel. Jangan menyetujui hasil kerja tanpa bukti empiris (No Evidence = No Acceptance).',
          modelId: 'claude-3-7-sonnet',
          capabilities: JSON.stringify(['empirical_verification', 'anti_hallucination', 'code_review'])
        },
        {
          id: 'agent-devops',
          name: 'Atlas Monitor',
          role: 'DevOps',
          description: 'Pengawas kesehatan server, telemetri host, utilisasi CPU/RAM, dan kehandalan runtime.',
          systemPrompt: 'Anda adalah Atlas DevOps. Pantau performa server, deteksi anomali metrik, dan laporkan status infrastruktur.',
          modelId: 'coding-fast',
          capabilities: JSON.stringify(['server_telemetry', 'health_check', 'log_auditing'])
        }
      ];

      for (const ag of seedAgents) {
        await client.query(`
          INSERT INTO ai_agents (
            id, workspace_id, name, role, description, system_prompt, provider_id, model_id, capabilities, enabled, status
          ) VALUES (
            $1, $2, $3, $4, $5, $6, 'prov-routex-local', $7, $8, TRUE, 'READY'
          );
        `, [ag.id, config.defaultWorkspaceId, ag.name, ag.role, ag.description, ag.systemPrompt, ag.modelId, ag.capabilities]);
      }

      // Seed initial sample projects
      await client.query(`
        INSERT INTO projects (id, workspace_id, name, description, status, progress_percentage)
        VALUES 
          ('proj-command-center', $1, 'AI Command Center Deployment', 'Membangun dashboard 3D interaktif dan orkestrasi AI Team terpadu.', 'ACTIVE', 75),
          ('proj-gateway-sync', $1, 'Route-X Gateway Synchronization', 'Sinkronisasi telemetri latensi rendah dengan Route-X AI Gateway lokal.', 'ACTIVE', 90)
        ON CONFLICT (id) DO NOTHING;
      `, [config.defaultWorkspaceId]);

      // Seed initial sample tasks
      await client.query(`
        INSERT INTO tasks (id, workspace_id, project_id, title, description, status, priority, assigned_agent_id)
        VALUES
          ('task-001', $1, 'proj-command-center', 'Audit Lingkungan & Matriks Anti-Halusinasi', 'Lakukan inspeksi sistem host, database, dan verifikasi ketersediaan runtime.', 'DONE', 'HIGH', 'agent-orchestrator'),
          ('task-002', $1, 'proj-command-center', 'Implementasi Multi-Provider Connection Adapter', 'Bangun adapter Custom API, Route-X Preset, dan penanganan diagnostik Hermes.', 'IN_PROGRESS', 'CRITICAL', 'agent-executor'),
          ('task-003', $1, 'proj-command-center', 'Verifikasi 3D Virtual Workspace & 2D Fallback', 'Uji render Three.js dan pastikan fail-safe 2D berfungsi pada mobile/tanpa WebGL.', 'TODO', 'MEDIUM', 'agent-qa'),
          ('task-004', $1, 'proj-gateway-sync', 'Audit Metrik Host & Collector Telemetri', 'Implementasikan pemantauan penggunaan CPU, memori, disk, dan uptime sistem.', 'IN_PROGRESS', 'HIGH', 'agent-devops')
        ON CONFLICT (id) DO NOTHING;
      `, [config.defaultWorkspaceId]);

      // Seed initial activity
      await client.query(`
        INSERT INTO activities (id, workspace_id, actor_type, actor_id, actor_name, event_type, summary)
        VALUES
          ('act-001', $1, 'SYSTEM', 'system', 'Command Center Core', 'system.initialized', 'AI Agent Command Center workspace diinisialisasi dengan PostgreSQL 16.'),
          ('act-002', $1, 'AGENT', 'agent-orchestrator', 'Nexus Prime', 'task.assigned', 'Nexus Prime mendelegasikan Task Implementasi Adapter ke Vulcan Forge.')
        ON CONFLICT (id) DO NOTHING;
      `, [config.defaultWorkspaceId]);
    }

    // Seed initial autonomous proactive schedules if none exist
    const schedCountRes = await client.query(`
      SELECT count(*) as count FROM agent_schedules WHERE workspace_id = $1;
    `, [config.defaultWorkspaceId]);

    if (parseInt(schedCountRes.rows[0].count, 10) === 0) {
      console.log('[DB] Seeding default autonomous routines (Health Check, Security Audit, Vector Sync, Weekly Swarm Audit)...');
      await client.query(`
        INSERT INTO agent_schedules (
          id, workspace_id, title, description, cron_expression, routine_type, is_active, last_status
        ) VALUES 
          ('sched-health-hourly', $1, 'Pemeriksaan Kesehatan Server & Telemetri', 'Audit berkala latensi database, penggunaan memori server, dan ketersediaan agen.', '0 * * * *', 'HEALTH_CHECK', TRUE, 'IDLE'),
          ('sched-security-daily', $1, 'Audit Keamanan & Integritas Sandbox Harian', 'Pemeriksaan berkala kebocoran env, proteksi path sensitif, dan log akses aksi terblokir.', '0 2 * * *', 'SECURITY_AUDIT', TRUE, 'IDLE'),
          ('sched-vector-sync', $1, 'Sinkronisasi Indeks Memori Semantik RAG', 'Verifikasi status embedding chunk vektor pada pgvector HNSW.', '0 4 * * *', 'VECTOR_REINDEX', TRUE, 'IDLE'),
          ('sched-swarm-codebase', $1, 'Swarm Autonomous Codebase Audit', 'Misi dekomposisi multi-agent berkala untuk evaluasi integritas arsitektur kode.', '0 3 * * 1', 'SWARM_MISSION', TRUE, 'IDLE')
        ON CONFLICT (id) DO NOTHING;
      `, [config.defaultWorkspaceId]);
    }
  } finally {
    client.release();
  }
}
