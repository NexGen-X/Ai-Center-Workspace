/**
 * Agent Mind Map & Cognitive Memory Graph Explorer Service — AI Agent Command Center
 * Generates interconnected cognitive network graphs with semantic vector similarity clustering,
 * cross-agent memory sharing, cognitive pruning, and memory consolidation.
 */

import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/index.js';
import {
  MemoryGraphNode,
  MemoryGraphEdge,
  MemoryGraphData,
  PruneMemoriesRequest,
  ShareMemoryRequest,
  ConsolidateMemoriesRequest,
  AgentMemoryType,
  AgentMemoryItem
} from '../../../shared/types.js';
import { generateEmbedding, vectorToSql } from './embedding.js';
import { systemLogger } from './logger.js';

export class MemoryGraphService {
  /**
   * Color palette for memory nodes & agents
   */
  private static readonly COLOR_PALETTE = {
    AGENT: '#06b6d4',      // Cyan
    EPISODIC: '#3b82f6',   // Blue
    FACTUAL: '#10b981',    // Emerald
    PREFERENCE: '#8b5cf6', // Purple
    GOAL: '#f59e0b',       // Amber
  };

  /**
   * Simple lexical token similarity (Jaccard) fallback
   */
  private static computeTokenSimilarity(textA: string, textB: string): number {
    const tokensA = new Set(textA.toLowerCase().split(/\W+/).filter(w => w.length > 2));
    const tokensB = new Set(textB.toLowerCase().split(/\W+/).filter(w => w.length > 2));
    if (tokensA.size === 0 || tokensB.size === 0) return 0;

    let intersection = 0;
    for (const t of tokensA) {
      if (tokensB.has(t)) intersection++;
    }
    const union = tokensA.size + tokensB.size - intersection;
    return union > 0 ? Math.round((intersection / union) * 100) / 100 : 0;
  }

  /**
   * Retrieves complete Cognitive Memory Graph (Nodes, Edges, Metrics)
   */
  static async getMemoryGraph(
    workspaceId: string = 'ws-default-command-center',
    options: {
      agentId?: string;
      minSimilarity?: number;
      memoryType?: string;
      searchQuery?: string;
    } = {}
  ): Promise<MemoryGraphData> {
    const { agentId, minSimilarity = 0.30, memoryType, searchQuery } = options;

    // 1. Auto-seed sample memories if table is currently empty for this workspace
    await this.seedSampleMemoriesIfEmpty(workspaceId);

    // 2. Fetch AI Agents
    const agentsRes = await pool.query(
      `SELECT id, name, role, status FROM ai_agents WHERE workspace_id = $1 ORDER BY name ASC`,
      [workspaceId]
    );
    const agentMap = new Map<string, { id: string; name: string; role: string }>();
    agentsRes.rows.forEach(a => agentMap.set(a.id, a));

    // 3. Fetch Memories
    let memSql = `
      SELECT 
        m.id,
        m.agent_id,
        a.name as agent_name,
        m.workspace_id,
        m.task_id,
        t.title as task_title,
        m.memory_type,
        m.key_point,
        m.context,
        m.importance_score,
        m.created_at
      FROM agent_memories m
      LEFT JOIN ai_agents a ON m.agent_id = a.id
      LEFT JOIN tasks t ON m.task_id = t.id
      WHERE m.workspace_id = $1
    `;
    const memParams: any[] = [workspaceId];

    if (agentId && agentId !== 'ALL') {
      memParams.push(agentId);
      memSql += ` AND m.agent_id = $${memParams.length}`;
    }

    if (memoryType && memoryType !== 'ALL') {
      memParams.push(memoryType);
      memSql += ` AND m.memory_type = $${memParams.length}`;
    }

    if (searchQuery && searchQuery.trim().length > 0) {
      memParams.push(`%${searchQuery.trim().toLowerCase()}%`);
      memSql += ` AND (LOWER(m.key_point) LIKE $${memParams.length} OR LOWER(COALESCE(m.context, '')) LIKE $${memParams.length})`;
    }

    memSql += ` ORDER BY m.importance_score DESC, m.created_at DESC LIMIT 150`;

    const memRes = await pool.query(memSql, memParams);
    const memories = memRes.rows;

    // 4. Construct Nodes
    const nodes: MemoryGraphNode[] = [];
    const nodeIds = new Set<string>();

    // Determine relevant agents
    const relevantAgentIds = new Set<string>();
    memories.forEach(m => relevantAgentIds.add(m.agent_id));
    if (agentId && agentId !== 'ALL') {
      relevantAgentIds.add(agentId);
    } else {
      // Add all agents if showing entire team mind map
      agentsRes.rows.forEach(a => relevantAgentIds.add(a.id));
    }

    // Add Agent Nodes
    const agentNodesArray: { id: string; name: string; role: string }[] = [];
    for (const aId of relevantAgentIds) {
      const aInfo = agentMap.get(aId) || { id: aId, name: 'Agent', role: 'Worker' };
      agentNodesArray.push(aInfo);
      nodes.push({
        id: aInfo.id,
        type: 'AGENT',
        label: aInfo.name,
        subLabel: aInfo.role,
        clusterGroup: `agent-${aInfo.id}`,
        radius: 28,
        color: this.COLOR_PALETTE.AGENT,
        importanceScore: 1.0,
      });
      nodeIds.add(aInfo.id);
    }

    // Add Memory Nodes
    let episodicCount = 0;
    let factualCount = 0;
    let preferenceCount = 0;
    let goalCount = 0;
    let totalImportance = 0;

    for (const m of memories) {
      const mType = (m.memory_type || 'EPISODIC').toUpperCase() as AgentMemoryType;
      if (mType === 'EPISODIC') episodicCount++;
      else if (mType === 'FACTUAL') factualCount++;
      else if (mType === 'PREFERENCE') preferenceCount++;
      else if (mType === 'GOAL') goalCount++;

      const importance = Number(m.importance_score) || 0.5;
      totalImportance += importance;

      const nodeRadius = 14 + Math.round(importance * 12); // 15px to 26px based on importance
      const nodeColor = this.COLOR_PALETTE[mType] || this.COLOR_PALETTE.EPISODIC;

      nodes.push({
        id: m.id,
        type: 'MEMORY',
        label: m.key_point,
        subLabel: mType,
        memoryType: mType,
        agentId: m.agent_id,
        agentName: m.agent_name || 'Agent',
        importanceScore: Math.round(importance * 100) / 100,
        context: m.context || undefined,
        taskId: m.task_id || undefined,
        taskTitle: m.task_title || undefined,
        createdAt: m.created_at,
        clusterGroup: mType,
        radius: nodeRadius,
        color: nodeColor,
      });
      nodeIds.add(m.id);
    }

    // 5. Construct Edges
    const edges: MemoryGraphEdge[] = [];
    const edgeKeySet = new Set<string>();

    // 5a. Agent-to-Memory Edges (Ownership link)
    for (const m of memories) {
      if (nodeIds.has(m.agent_id)) {
        const edgeId = `edge-agent-${m.agent_id}-${m.id}`;
        edges.push({
          id: edgeId,
          source: m.agent_id,
          target: m.id,
          edgeType: 'AGENT_MEMORY',
          weight: 0.8,
          label: 'Cognition'
        });
        edgeKeySet.add(`${m.agent_id}->${m.id}`);
      }
    }

    // 5b. Semantic Similarity Edges between Memories
    // Query pgvector pairwise cosine similarity
    try {
      const simSql = `
        SELECT 
          m1.id as source_id,
          m2.id as target_id,
          1 - (m1.embedding <=> m2.embedding) as similarity
        FROM agent_memories m1
        JOIN agent_memories m2 ON m1.id < m2.id AND m1.workspace_id = m2.workspace_id
        WHERE m1.workspace_id = $1
          AND m1.embedding IS NOT NULL AND m2.embedding IS NOT NULL
          AND (1 - (m1.embedding <=> m2.embedding)) >= $2
        ORDER BY similarity DESC
        LIMIT 100
      `;
      const simRes = await pool.query(simSql, [workspaceId, minSimilarity]);

      for (const row of simRes.rows) {
        if (nodeIds.has(row.source_id) && nodeIds.has(row.target_id)) {
          const simVal = Math.round(Number(row.similarity) * 100) / 100;
          const edgeId = `sim-${row.source_id}-${row.target_id}`;
          edges.push({
            id: edgeId,
            source: row.source_id,
            target: row.target_id,
            edgeType: 'SEMANTIC_SIMILARITY',
            similarity: simVal,
            weight: simVal,
            label: `${Math.round(simVal * 100)}% Sim`
          });
          edgeKeySet.add(`${row.source_id}->${row.target_id}`);
        }
      }
    } catch (simErr) {
      systemLogger.warn('SYSTEM', `Semantic vector similarity query fallback: ${(simErr as Error).message}`);
    }

    // Fallback: If few or zero semantic edges were found, compute lexical token Jaccard similarity
    if (edges.filter(e => e.edgeType === 'SEMANTIC_SIMILARITY').length < 3 && memories.length > 1) {
      for (let i = 0; i < memories.length; i++) {
        for (let j = i + 1; j < memories.length; j++) {
          const m1 = memories[i];
          const m2 = memories[j];
          const score = this.computeTokenSimilarity(m1.key_point, m2.key_point);
          if (score >= 0.22 && !edgeKeySet.has(`${m1.id}->${m2.id}`) && !edgeKeySet.has(`${m2.id}->${m1.id}`)) {
            edges.push({
              id: `lex-${m1.id}-${m2.id}`,
              source: m1.id,
              target: m2.id,
              edgeType: 'SEMANTIC_SIMILARITY',
              similarity: score,
              weight: score,
              label: `${Math.round(score * 100)}% Match`
            });
            edgeKeySet.add(`${m1.id}->${m2.id}`);
            if (edges.filter(e => e.edgeType === 'SEMANTIC_SIMILARITY').length >= 40) break;
          }
        }
      }
    }

    // 5c. Shared Task Co-occurrence Edges
    const taskGroups: Record<string, string[]> = {};
    for (const m of memories) {
      if (m.task_id) {
        if (!taskGroups[m.task_id]) taskGroups[m.task_id] = [];
        taskGroups[m.task_id].push(m.id);
      }
    }
    for (const [taskId, mIds] of Object.entries(taskGroups)) {
      if (mIds.length > 1) {
        for (let i = 0; i < mIds.length - 1; i++) {
          const s = mIds[i];
          const t = mIds[i + 1];
          if (!edgeKeySet.has(`${s}->${t}`) && !edgeKeySet.has(`${t}->${s}`)) {
            edges.push({
              id: `task-${taskId}-${s}-${t}`,
              source: s,
              target: t,
              edgeType: 'TASK_COOCCURRENCE',
              weight: 0.5,
              label: 'Same Task'
            });
            edgeKeySet.add(`${s}->${t}`);
          }
        }
      }
    }

    // 6. Compute 2D Initial Coordinates (Radial Spring-Wheel layout)
    const centerX = 500;
    const centerY = 360;
    const agentRadius = Math.max(160, Math.min(260, agentNodesArray.length * 45));

    // Distribute Agent nodes evenly on an inner ring
    agentNodesArray.forEach((a, idx) => {
      const angle = (idx / Math.max(1, agentNodesArray.length)) * 2 * Math.PI - Math.PI / 2;
      const aNode = nodes.find(n => n.id === a.id);
      if (aNode) {
        aNode.x = Math.round(centerX + Math.cos(angle) * agentRadius);
        aNode.y = Math.round(centerY + Math.sin(angle) * agentRadius);
      }
    });

    // Distribute Memory nodes around their respective agent
    const agentMemCounts: Record<string, number> = {};
    const agentMemIndex: Record<string, number> = {};
    memories.forEach(m => {
      agentMemCounts[m.agent_id] = (agentMemCounts[m.agent_id] || 0) + 1;
    });

    nodes.forEach(n => {
      if (n.type === 'MEMORY' && n.agentId) {
        const parentNode = nodes.find(p => p.id === n.agentId);
        const pX = parentNode?.x ?? centerX;
        const pY = parentNode?.y ?? centerY;

        const count = agentMemCounts[n.agentId] || 1;
        const currentIdx = agentMemIndex[n.agentId] || 0;
        agentMemIndex[n.agentId] = currentIdx + 1;

        // Angle around parent agent
        const memAngle = (currentIdx / count) * 2 * Math.PI + (parseInt(n.id.slice(-2), 16) || 0) * 0.1;
        const orbitDistance = 75 + ((currentIdx % 3) * 35);

        n.x = Math.round(pX + Math.cos(memAngle) * orbitDistance);
        n.y = Math.round(pY + Math.sin(memAngle) * orbitDistance);
      }
    });

    const averageImportance = memories.length > 0
      ? Math.round((totalImportance / memories.length) * 100) / 100
      : 0;

    return {
      nodes,
      edges,
      stats: {
        totalMemories: memories.length,
        totalAgents: agentNodesArray.length,
        totalEdges: edges.length,
        averageImportance,
        clustersCount: 4, // EPISODIC, FACTUAL, PREFERENCE, GOAL
        episodicCount,
        factualCount,
        preferenceCount,
        goalCount
      }
    };
  }

  /**
   * Automatically seeds realistic cognitive memories if agent_memories table is empty
   */
  static async seedSampleMemoriesIfEmpty(workspaceId: string = 'ws-default-command-center'): Promise<void> {
    const countRes = await pool.query(
      `SELECT COUNT(*)::int as count FROM agent_memories WHERE workspace_id = $1`,
      [workspaceId]
    );

    if (countRes.rows[0]?.count > 0) {
      return; // Already populated
    }

    const agentsRes = await pool.query(
      `SELECT id, name, role FROM ai_agents WHERE workspace_id = $1`,
      [workspaceId]
    );

    if (agentsRes.rows.length === 0) return;

    const sampleTemplates: Array<{
      agentRole: string;
      memoryType: AgentMemoryType;
      keyPoint: string;
      context: string;
      importanceScore: number;
    }> = [
      // Planner / Orchestrator
      {
        agentRole: 'Planner',
        memoryType: 'GOAL',
        keyPoint: 'Maintain 99.5% sprint milestone completion rate and optimize task execution DAGs',
        context: 'Directs overall multi-agent autonomous task orchestration with parallel pipeline branches.',
        importanceScore: 0.95
      },
      {
        agentRole: 'Planner',
        memoryType: 'PREFERENCE',
        keyPoint: 'Decompose complex user requests into maximum 5 discrete, decoupled steps',
        context: 'Prevents agent context window saturation and reduces multi-step hallucination risk.',
        importanceScore: 0.85
      },
      {
        agentRole: 'Planner',
        memoryType: 'FACTUAL',
        keyPoint: 'Database migrations must execute and complete cleanly before service worker restart',
        context: 'Enforces architectural sequence during zero-downtime rolling upgrades.',
        importanceScore: 0.90
      },
      // Orchestrator
      {
        agentRole: 'Orchestrator',
        memoryType: 'GOAL',
        keyPoint: 'Autonomous multi-agent consensus reached in under 15 seconds per incident',
        context: 'Optimizes War Room incident coordination and prevents deadlock in voting meshes.',
        importanceScore: 0.90
      },
      {
        agentRole: 'Orchestrator',
        memoryType: 'FACTUAL',
        keyPoint: 'Circuit breaker pattern prevents cascade failures across downstream microservices',
        context: 'Triggered when remote REST endpoints return 5xx errors for 3 consecutive attempts.',
        importanceScore: 0.85
      },
      {
        agentRole: 'Orchestrator',
        memoryType: 'EPISODIC',
        keyPoint: 'Coordinated War Room resolution during simulated PostgreSQL connection pool exhaustion',
        context: 'Resolved within 4 minutes by throttling worker concurrency and scaling pool size.',
        importanceScore: 0.80
      },
      // Executor
      {
        agentRole: 'Executor',
        memoryType: 'PREFERENCE',
        keyPoint: 'Always enforce TypeScript strict null checks and zero-warning build compilation',
        context: 'Ensures robust typesafety across shared workspace models and client hooks.',
        importanceScore: 0.85
      },
      {
        agentRole: 'Executor',
        memoryType: 'EPISODIC',
        keyPoint: 'Mitigated SSRF risk by validating outgoing REST webhooks against metadata IP 169.254.169.254',
        context: 'Implemented RFC 1918 and loopback IP blocking in Dynamic Tool Studio dispatcher.',
        importanceScore: 0.95
      },
      {
        agentRole: 'Executor',
        memoryType: 'FACTUAL',
        keyPoint: 'Zero-dependency SVG force graph provides 60fps rendering without external bundle bloat',
        context: 'Uses Verlet velocity integration and repulsive Coulomb simulation.',
        importanceScore: 0.80
      },
      // QA / Reviewer
      {
        agentRole: 'QA / Reviewer',
        memoryType: 'GOAL',
        keyPoint: 'Zero regressions across all test suites before production deployment',
        context: 'Guarantees 100% test pass rate across 25+ integration and unit test specifications.',
        importanceScore: 0.92
      },
      {
        agentRole: 'QA / Reviewer',
        memoryType: 'PREFERENCE',
        keyPoint: 'All interactive modals must implement Escape key listener, backdrop dismiss, and ARIA roles',
        context: 'Standardizes user experience across War Room, SRE, Data Analyst, and Skill Studio.',
        importanceScore: 0.85
      },
      {
        agentRole: 'QA / Reviewer',
        memoryType: 'FACTUAL',
        keyPoint: 'Mocking external sockets and timers prevents flaky test suite timeouts',
        context: 'Used in playground and streaming unit tests for deterministic verification.',
        importanceScore: 0.78
      },
      // DevOps
      {
        agentRole: 'DevOps',
        memoryType: 'FACTUAL',
        keyPoint: 'PostgreSQL pgvector HNSW index delivers 10x retrieval speedup over IVFFlat index',
        context: 'Uses cosine distance metric with m=16 and ef_construction=64 for sub-millisecond retrieval.',
        importanceScore: 0.90
      },
      {
        agentRole: 'DevOps',
        memoryType: 'EPISODIC',
        keyPoint: 'Auto-scaled system worker threads when CPU utilization sustained 85% for 60 seconds',
        context: 'Demonstrated autonomous capacity scaling without operator intervention.',
        importanceScore: 0.82
      }
    ];

    for (const tpl of sampleTemplates) {
      // Find matching agent or fallback to first available agent
      const matchedAgent = agentsRes.rows.find(a => 
        a.role?.toLowerCase().includes(tpl.agentRole.toLowerCase()) ||
        a.name?.toLowerCase().includes(tpl.agentRole.toLowerCase())
      ) || agentsRes.rows[0];

      if (!matchedAgent) continue;

      const memId = `mem-${uuidv4().slice(0, 8)}`;
      const embedding = await generateEmbedding(`${tpl.keyPoint} ${tpl.context}`);
      const vecSql = vectorToSql(embedding);

      await pool.query(
        `INSERT INTO agent_memories (
          id, agent_id, workspace_id, memory_type, key_point, context, importance_score, embedding, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector, NOW() - (random() * interval '7 days'))
        ON CONFLICT (id) DO NOTHING`,
        [memId, matchedAgent.id, workspaceId, tpl.memoryType, tpl.keyPoint, tpl.context, tpl.importanceScore, vecSql]
      );
    }

    systemLogger.info('SYSTEM', `[CognitiveMemoryGraph] Auto-seeded initial cognitive memories for workspace ${workspaceId}.`);
  }

  /**
   * Prunes low-importance or decayed memories
   */
  static async pruneMemories(req: PruneMemoriesRequest): Promise<{ prunedCount: number; message: string }> {
    const {
      thresholdScore = 0.4,
      agentId,
      olderThanDays,
      workspaceId = 'ws-default-command-center'
    } = req;

    let sql = `DELETE FROM agent_memories WHERE workspace_id = $1 AND importance_score <= $2`;
    const params: any[] = [workspaceId, thresholdScore];

    if (agentId && agentId !== 'ALL') {
      params.push(agentId);
      sql += ` AND agent_id = $${params.length}`;
    }

    if (olderThanDays && olderThanDays > 0) {
      params.push(olderThanDays);
      sql += ` AND created_at < NOW() - ($${params.length} || ' days')::interval`;
    }

    sql += ` RETURNING id`;

    const res = await pool.query(sql, params);
    const count = res.rows.length;

    return {
      prunedCount: count,
      message: `Berhasil memangkas ${count} memori yang terdegradasi (skor <= ${thresholdScore}).`
    };
  }

  /**
   * Cross-agent memory sharing (replicates memory to other agent(s))
   */
  static async shareMemory(req: ShareMemoryRequest): Promise<{ sharedCount: number; newMemoryIds: string[] }> {
    const { memoryId, targetAgentIds } = req;
    if (!memoryId || !Array.isArray(targetAgentIds) || targetAgentIds.length === 0) {
      throw new Error('Parameter memoryId dan targetAgentIds wajib diisi.');
    }

    // Fetch source memory
    const srcRes = await pool.query(
      `SELECT * FROM agent_memories WHERE id = $1`,
      [memoryId]
    );

    if (srcRes.rows.length === 0) {
      throw new Error(`Memori dengan ID "${memoryId}" tidak ditemukan.`);
    }

    const src = srcRes.rows[0];
    const newIds: string[] = [];

    for (const targetId of targetAgentIds) {
      if (targetId === src.agent_id) continue; // Skip self

      const newId = `mem-${uuidv4().slice(0, 8)}`;
      await pool.query(
        `INSERT INTO agent_memories (
          id, agent_id, workspace_id, task_id, memory_type, key_point, context, importance_score, embedding, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
        [
          newId,
          targetId,
          src.workspace_id,
          src.task_id,
          src.memory_type,
          src.key_point,
          `[Shared from Agent ${src.agent_id}] ${src.context || ''}`.trim(),
          src.importance_score,
          src.embedding
        ]
      );
      newIds.push(newId);
    }

    return {
      sharedCount: newIds.length,
      newMemoryIds: newIds
    };
  }

  /**
   * Consolidate multiple related memories into a synthesized single memory
   */
  static async consolidateMemories(req: ConsolidateMemoriesRequest): Promise<AgentMemoryItem> {
    const {
      memoryIds,
      targetMemoryType = 'FACTUAL',
      newKeyPoint,
      newContext,
      targetAgentId,
      workspaceId = 'ws-default-command-center'
    } = req;

    if (!Array.isArray(memoryIds) || memoryIds.length < 2) {
      throw new Error('Minimal 2 memori diperlukan untuk melakukan konsolidasi.');
    }

    if (!newKeyPoint || newKeyPoint.trim().length === 0) {
      throw new Error('Parameter newKeyPoint wajib diisi.');
    }

    // Determine target agent ID from first memory if not provided
    const memsRes = await pool.query(
      `SELECT id, agent_id, key_point FROM agent_memories WHERE id = ANY($1::varchar[])`,
      [memoryIds]
    );

    if (memsRes.rows.length === 0) {
      throw new Error('Memori sumber tidak ditemukan.');
    }

    const finalAgentId = targetAgentId || memsRes.rows[0].agent_id;
    const consolidatedContext = newContext || 
      `Konsolidasi dari ${memsRes.rows.length} memori: ${memsRes.rows.map(r => r.key_point).join(' | ')}`;

    const newId = `mem-${uuidv4().slice(0, 8)}`;
    const embedding = await generateEmbedding(`${newKeyPoint} ${consolidatedContext}`);
    const vecSql = vectorToSql(embedding);

    // Insert synthesized memory
    await pool.query(
      `INSERT INTO agent_memories (
        id, agent_id, workspace_id, memory_type, key_point, context, importance_score, embedding, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector, NOW())`,
      [newId, finalAgentId, workspaceId, targetMemoryType, newKeyPoint.trim(), consolidatedContext, 0.95, vecSql]
    );

    // Delete or retire source memories
    await pool.query(
      `DELETE FROM agent_memories WHERE id = ANY($1::varchar[])`,
      [memoryIds]
    );

    return {
      id: newId,
      agentId: finalAgentId,
      workspaceId,
      memoryType: targetMemoryType,
      keyPoint: newKeyPoint.trim(),
      context: consolidatedContext,
      importanceScore: 0.95,
      createdAt: new Date().toISOString()
    };
  }
}
