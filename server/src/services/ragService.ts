/**
 * RAG & Semantic Vector Memory Service — AI Agent Command Center
 * Orchestrates document chunking, pgvector indexing, semantic similarity retrieval,
 * and long-term agent episodic & factual memory.
 */

import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/index.js';
import {
  DocumentChunk,
  RagSearchResult,
  RagIndexStats,
  AgentMemoryItem,
  StoreMemoryRequest,
  DocumentCategory,
  AgentMemoryType
} from '../../../shared/types.js';
import { generateEmbedding, vectorToSql, EMBEDDING_DIM } from './embedding.js';
import { realtimeHub } from './realtime.js';
import { systemLogger } from './logger.js';

export class RagService {
  /**
   * Intelligently chunks a document text respecting paragraphs and sentences.
   */
  static chunkText(text: string, maxChars: number = 600, overlap: number = 100): string[] {
    if (!text || text.trim().length === 0) return [];
    
    // Normalize newlines
    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (normalized.length <= maxChars) {
      return [normalized];
    }

    const chunks: string[] = [];
    const paragraphs = normalized.split(/\n\s*\n/);
    let currentChunk = '';

    for (const para of paragraphs) {
      const cleanPara = para.trim();
      if (!cleanPara) continue;

      if ((currentChunk.length + cleanPara.length + 2) <= maxChars) {
        currentChunk = currentChunk ? `${currentChunk}\n\n${cleanPara}` : cleanPara;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
          // Carry over overlap tail
          const tail = currentChunk.slice(-overlap);
          currentChunk = `${tail} ${cleanPara}`.trim();
        } else {
          // Paragraph itself is larger than maxChars, split on sentences
          const sentences = cleanPara.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [cleanPara];
          for (const s of sentences) {
            const cleanS = s.trim();
            if ((currentChunk.length + cleanS.length + 1) <= maxChars) {
              currentChunk = currentChunk ? `${currentChunk} ${cleanS}` : cleanS;
            } else {
              if (currentChunk) chunks.push(currentChunk);
              currentChunk = cleanS;
            }
          }
        }
      }
    }

    if (currentChunk && currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks.length > 0 ? chunks : [normalized.slice(0, maxChars)];
  }

  /**
   * Indexes a single document: chunks, generates 768-dim embeddings, and persists to pgvector.
   */
  static async indexDocument(documentId: string): Promise<{ chunksIndexed: number }> {
    const docRes = await pool.query(
      `SELECT id, workspace_id, title, content, category FROM documents WHERE id = $1`,
      [documentId]
    );

    if (docRes.rows.length === 0) {
      throw new Error(`Dokumen dengan ID "${documentId}" tidak ditemukan.`);
    }

    const doc = docRes.rows[0];
    const textChunks = this.chunkText(doc.content);

    // Remove existing chunks for this document
    await pool.query(`DELETE FROM document_chunks WHERE document_id = $1`, [documentId]);

    if (textChunks.length === 0) {
      return { chunksIndexed: 0 };
    }

    let inserted = 0;
    for (let i = 0; i < textChunks.length; i++) {
      const chunkContent = textChunks[i];
      const chunkId = `chk-${uuidv4().slice(0, 8)}`;
      const charCount = chunkContent.length;
      const tokenCount = Math.ceil(charCount / 4); // approx tokens

      // Generate 768-dim embedding
      const embedding = await generateEmbedding(`${doc.title}\n\n${chunkContent}`);
      const vecSql = vectorToSql(embedding);

      await pool.query(
        `INSERT INTO document_chunks (
          id, document_id, workspace_id, chunk_index, content, char_count, token_count, embedding
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector)`,
        [chunkId, documentId, doc.workspace_id, i, chunkContent, charCount, tokenCount, vecSql]
      );
      inserted++;
    }

    systemLogger.info('ORCHESTRATOR', `RAG: Dokumen "${doc.title}" diindeks ke dalam ${inserted} chunk vector.`);
    
    realtimeHub.broadcast('rag.document_indexed', {
      documentId,
      documentTitle: doc.title,
      chunksIndexed: inserted
    });

    return { chunksIndexed: inserted };
  }

  /**
   * Indexes all documents in a workspace
   */
  static async indexAllDocuments(workspaceId: string = 'ws-default-command-center'): Promise<{ totalIndexed: number; documentsCount: number }> {
    const docsRes = await pool.query(
      `SELECT id, title FROM documents WHERE workspace_id = $1`,
      [workspaceId]
    );

    let totalChunks = 0;
    for (const doc of docsRes.rows) {
      const res = await this.indexDocument(doc.id);
      totalChunks += res.chunksIndexed;
    }

    return { totalIndexed: totalChunks, documentsCount: docsRes.rows.length };
  }

  /**
   * Semantic Vector Similarity Search using pgvector cosine distance (<=>)
   */
  static async searchSimilarChunks(
    workspaceId: string = 'ws-default-command-center',
    query: string,
    options: {
      limit?: number;
      minSimilarity?: number;
      category?: DocumentCategory;
      projectId?: string;
    } = {}
  ): Promise<RagSearchResult[]> {
    const limit = Math.max(1, Math.min(20, options.limit || 5));
    const minSim = options.minSimilarity !== undefined ? options.minSimilarity : 0.35;

    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query);
    const vecSql = vectorToSql(queryEmbedding);

    let sql = `
      SELECT 
        dc.id as chunk_id,
        dc.document_id,
        d.title as document_title,
        d.category,
        dc.chunk_index,
        dc.content,
        1 - (dc.embedding <=> $1::vector) as similarity,
        (dc.embedding <=> $1::vector) as distance
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      WHERE dc.workspace_id = $2
    `;

    const params: any[] = [vecSql, workspaceId];

    if (options.category) {
      params.push(options.category);
      sql += ` AND d.category = $${params.length}`;
    }

    if (options.projectId) {
      params.push(options.projectId);
      sql += ` AND d.project_id = $${params.length}`;
    }

    params.push(minSim);
    sql += ` AND (1 - (dc.embedding <=> $1::vector)) >= $${params.length}`;

    params.push(limit);
    sql += ` ORDER BY dc.embedding <=> $1::vector ASC LIMIT $${params.length}`;

    const res = await pool.query(sql, params);

    return res.rows.map((row: any) => ({
      chunkId: row.chunk_id,
      documentId: row.document_id,
      documentTitle: row.document_title,
      category: row.category,
      chunkIndex: row.chunk_index,
      content: row.content,
      similarity: Math.round(Number(row.similarity) * 1000) / 1000,
      distance: Math.round(Number(row.distance) * 1000) / 1000
    }));
  }

  /**
   * Store episodic or factual memory for an AI Agent
   */
  static async storeAgentMemory(req: {
    agentId: string;
    workspaceId?: string;
    taskId?: string;
    memoryType?: AgentMemoryType;
    keyPoint: string;
    context?: string;
    importanceScore?: number;
  }): Promise<AgentMemoryItem> {
    const memoryId = `mem-${uuidv4().slice(0, 8)}`;
    const workspaceId = req.workspaceId || 'ws-default-command-center';
    const memoryType = req.memoryType || 'EPISODIC';
    const importance = Math.max(0.1, Math.min(1.0, req.importanceScore ?? 0.5));

    // Generate memory embedding
    const embText = `${req.keyPoint} ${req.context || ''}`.trim();
    const embedding = await generateEmbedding(embText);
    const vecSql = vectorToSql(embedding);

    const insertRes = await pool.query(
      `INSERT INTO agent_memories (
        id, agent_id, workspace_id, task_id, memory_type, key_point, context, importance_score, embedding
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::vector)
      RETURNING *`,
      [memoryId, req.agentId, workspaceId, req.taskId || null, memoryType, req.keyPoint, req.context || null, importance, vecSql]
    );

    const row = insertRes.rows[0];

    // Fetch agent name for joined record
    const agentRes = await pool.query(`SELECT name FROM ai_agents WHERE id = $1`, [req.agentId]);
    const agentName = agentRes.rows[0]?.name;

    const item: AgentMemoryItem = {
      id: row.id,
      agentId: row.agent_id,
      agentName,
      workspaceId: row.workspace_id,
      taskId: row.task_id || undefined,
      memoryType: row.memory_type,
      keyPoint: row.key_point,
      context: row.context || undefined,
      importanceScore: row.importance_score,
      createdAt: row.created_at
    };

    realtimeHub.broadcast('rag.memory_stored', item);
    systemLogger.info('ORCHESTRATOR', `Memori agen disimpan [${agentName || req.agentId}]: "${req.keyPoint}"`);

    return item;
  }

  /**
   * Semantic search over an agent's memory vault
   */
  static async searchAgentMemories(
    agentId: string,
    query: string,
    options: { limit?: number; minSimilarity?: number } = {}
  ): Promise<AgentMemoryItem[]> {
    const limit = Math.max(1, Math.min(20, options.limit || 5));
    const minSim = options.minSimilarity !== undefined ? options.minSimilarity : 0.35;

    const queryEmbedding = await generateEmbedding(query);
    const vecSql = vectorToSql(queryEmbedding);

    const sql = `
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
        1 - (m.embedding <=> $1::vector) as similarity,
        m.created_at
      FROM agent_memories m
      LEFT JOIN ai_agents a ON m.agent_id = a.id
      LEFT JOIN tasks t ON m.task_id = t.id
      WHERE m.agent_id = $2
        AND (1 - (m.embedding <=> $1::vector)) >= $3
      ORDER BY (1 - (m.embedding <=> $1::vector)) * (0.8 + 0.2 * m.importance_score) DESC
      LIMIT $4
    `;

    const res = await pool.query(sql, [vecSql, agentId, minSim, limit]);

    return res.rows.map((row: any) => ({
      id: row.id,
      agentId: row.agent_id,
      agentName: row.agent_name,
      workspaceId: row.workspace_id,
      taskId: row.task_id || undefined,
      taskTitle: row.task_title || undefined,
      memoryType: row.memory_type,
      keyPoint: row.key_point,
      context: row.context || undefined,
      importanceScore: row.importance_score,
      similarity: Math.round(Number(row.similarity) * 1000) / 1000,
      createdAt: row.created_at
    }));
  }

  /**
   * Retrieve all memories for an agent or workspace
   */
  static async getAgentMemories(agentId?: string, limit: number = 50): Promise<AgentMemoryItem[]> {
    let sql = `
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
    `;
    const params: any[] = [];
    if (agentId) {
      params.push(agentId);
      sql += ` WHERE m.agent_id = $1`;
    }
    sql += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const res = await pool.query(sql, params);

    return res.rows.map((row: any) => ({
      id: row.id,
      agentId: row.agent_id,
      agentName: row.agent_name,
      workspaceId: row.workspace_id,
      taskId: row.task_id || undefined,
      taskTitle: row.task_title || undefined,
      memoryType: row.memory_type,
      keyPoint: row.key_point,
      context: row.context || undefined,
      importanceScore: row.importance_score,
      createdAt: row.created_at
    }));
  }

  /**
   * Delete an agent memory item
   */
  static async deleteAgentMemory(memoryId: string): Promise<boolean> {
    const res = await pool.query(`DELETE FROM agent_memories WHERE id = $1 RETURNING id`, [memoryId]);
    return res.rows.length > 0;
  }

  /**
   * Overall RAG & Vector Memory telemetry statistics
   */
  static async getRagStats(workspaceId: string = 'ws-default-command-center'): Promise<RagIndexStats> {
    const docsRes = await pool.query(
      `SELECT COUNT(*)::int as total_docs FROM documents WHERE workspace_id = $1`,
      [workspaceId]
    );
    const indexedRes = await pool.query(
      `SELECT COUNT(DISTINCT document_id)::int as indexed_docs FROM document_chunks WHERE workspace_id = $1`,
      [workspaceId]
    );
    const chunksRes = await pool.query(
      `SELECT COUNT(*)::int as total_chunks FROM document_chunks WHERE workspace_id = $1`,
      [workspaceId]
    );
    const memRes = await pool.query(
      `SELECT COUNT(*)::int as total_memories FROM agent_memories WHERE workspace_id = $1`,
      [workspaceId]
    );

    return {
      totalDocuments: docsRes.rows[0]?.total_docs || 0,
      indexedDocuments: indexedRes.rows[0]?.indexed_docs || 0,
      totalChunks: chunksRes.rows[0]?.total_chunks || 0,
      totalMemories: memRes.rows[0]?.total_memories || 0,
      embeddingDimensions: EMBEDDING_DIM,
      storageEngine: 'PostgreSQL + pgvector (HNSW Index)'
    };
  }
}
