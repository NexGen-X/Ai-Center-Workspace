import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { pool } from '../src/db/index.js';
import {
  generateDeterministicEmbedding,
  cosineSimilarity,
  EMBEDDING_DIM
} from '../src/services/embedding.js';
import { RagService } from '../src/services/ragService.js';
import { executeToolInSandbox } from '../src/services/sandbox.js';

describe('RAG & Semantic Vector Memory Engine (pgvector)', () => {
  const testDocId = 'doc-test-rag-unit-01';
  const testAgentId = 'agent-test-rag-01';
  const testProviderId = 'prov-test-rag-01';

  beforeAll(async () => {
    // Seed test provider and agent
    await pool.query(`
      INSERT INTO model_providers (id, workspace_id, name, provider_type, base_url, protocol, enabled, connection_status)
      VALUES ($1, 'ws-default-command-center', 'RAG Test Provider', 'custom_api', 'https://api.openai.com/v1', 'openai', true, 'CONNECTION_OK')
      ON CONFLICT (id) DO NOTHING;
    `, [testProviderId]);

    await pool.query(`
      INSERT INTO ai_agents (id, workspace_id, name, role, system_prompt, provider_id, model_id, capabilities)
      VALUES ($1, 'ws-default-command-center', 'RAG Sentinel Agent', 'ARCHITECT', 'You are a system architect.', $2, 'gpt-4o', '["tool_calling", "knowledge_base"]')
      ON CONFLICT (id) DO NOTHING;
    `, [testAgentId, testProviderId]);

    // Seed test document
    await pool.query(`
      INSERT INTO documents (id, workspace_id, title, content, category, tags)
      VALUES ($1, 'ws-default-command-center', 'SOP Deployment Kubernetes Production',
        'Langkah 1: Periksa konfigurasi kubeconfig dan namespace cluster.\nLangkah 2: Jalankan kubectl apply -f deployment.yaml untuk meluncurkan pods.\nLangkah 3: Pantau rolling update dengan kubectl rollout status deployment/api-server.\nLangkah 4: Lakukan validasi endpoint healthcheck pada ingress gateway.',
        'SOP', '["kubernetes", "deployment", "prod"]')
      ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content;
    `, [testDocId]);
  });

  afterAll(async () => {
    // Cleanup test data
    await pool.query(`DELETE FROM document_chunks WHERE document_id = $1`, [testDocId]);
    await pool.query(`DELETE FROM agent_memories WHERE agent_id = $1`, [testAgentId]);
    await pool.query(`DELETE FROM documents WHERE id = $1`, [testDocId]);
    await pool.query(`DELETE FROM ai_agents WHERE id = $1`, [testAgentId]);
    await pool.query(`DELETE FROM model_providers WHERE id = $1`, [testProviderId]);
  });

  describe('1. Semantic Vector Embedding Engine', () => {
    it('should generate a 768-dimensional normalized dense vector', () => {
      const vec = generateDeterministicEmbedding('Kubernetes deployment cluster configuration');
      expect(vec).toBeDefined();
      expect(vec.length).toBe(EMBEDDING_DIM);
      expect(vec.every(v => Number.isFinite(v))).toBe(true);

      // Verify L2 norm is approximately 1.0
      let sumSq = 0;
      for (const v of vec) sumSq += v * v;
      const norm = Math.sqrt(sumSq);
      expect(norm).toBeCloseTo(1.0, 2);
    });

    it('should compute high cosine similarity for semantically close phrases and low for unrelated', () => {
      const vecK8s1 = generateDeterministicEmbedding('Deployment aplikasi ke Kubernetes cluster menggunakan kubectl');
      const vecK8s2 = generateDeterministicEmbedding('Deploy kubectl pod ke cluster Kubernetes');
      const vecCooking = generateDeterministicEmbedding('Resep membuat kue cokelat manis dan lezat di oven');

      const simRelated = cosineSimilarity(vecK8s1, vecK8s2);
      const simUnrelated = cosineSimilarity(vecK8s1, vecCooking);

      expect(simRelated).toBeGreaterThan(0.40);
      expect(simUnrelated).toBeLessThan(0.20);
      expect(simRelated).toBeGreaterThan(simUnrelated * 2);
    });
  });

  describe('2. Text Chunking & Indexing Service', () => {
    it('should chunk text respecting paragraph and sentence boundaries', () => {
      const longText = `Paragraf pertama menjelaskan pendahuluan sistem.\n\nParagraf kedua membahas arsitektur mikroservis dan koneksi database relasional PostgreSQL.\n\nParagraf ketiga menguraikan mekanisme replikasi data dan penanganan failover otomatis.`;
      const chunks = RagService.chunkText(longText, 100, 20);

      expect(chunks.length).toBeGreaterThanOrEqual(2);
      expect(chunks.every(c => c.length > 0)).toBe(true);
    });

    it('should index document into pgvector document_chunks table', async () => {
      const res = await RagService.indexDocument(testDocId);
      expect(res.chunksIndexed).toBeGreaterThan(0);

      // Verify database record
      const dbRes = await pool.query(
        `SELECT id, chunk_index, char_count, (embedding IS NOT NULL) as has_embedding
         FROM document_chunks
         WHERE document_id = $1
         ORDER BY chunk_index ASC`,
        [testDocId]
      );
      expect(dbRes.rows.length).toBe(res.chunksIndexed);
      expect(dbRes.rows[0].has_embedding).toBe(true);
    });
  });

  describe('3. pgvector Cosine Similarity Search', () => {
    it('should find relevant chunks matching search query with high similarity', async () => {
      const results = await RagService.searchSimilarChunks(
        'ws-default-command-center',
        'bagaimana perintah kubectl rollout status deployment kubernetes?',
        { limit: 3, minSimilarity: 0.3 }
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].documentId).toBe(testDocId);
      expect(results[0].similarity).toBeGreaterThan(0.3);
      expect(results[0].content).toContain('kubectl');
    });
  });

  describe('4. Agent Long-Term Episodic Memory', () => {
    let savedMemoryId: string;

    it('should store episodic memory for an agent in pgvector', async () => {
      const mem = await RagService.storeAgentMemory({
        agentId: testAgentId,
        memoryType: 'FACTUAL',
        keyPoint: 'Service ingress memerlukan anotasi cert-manager untuk auto SSL renewal',
        context: 'Deploy cluster production',
        importanceScore: 0.85
      });

      expect(mem.id).toMatch(/^mem-/);
      expect(mem.agentId).toBe(testAgentId);
      expect(mem.memoryType).toBe('FACTUAL');
      expect(mem.importanceScore).toBe(0.85);
      savedMemoryId = mem.id;
    });

    it('should retrieve stored memory via semantic search', async () => {
      const memories = await RagService.searchAgentMemories(
        testAgentId,
        'sertifikat ssl ingress cert-manager renewal',
        { limit: 2, minSimilarity: 0.3 }
      );

      expect(memories.length).toBeGreaterThan(0);
      expect(memories[0].keyPoint).toContain('cert-manager');
      expect(memories[0].importanceScore).toBe(0.85);
    });

    it('should delete memory item successfully', async () => {
      if (savedMemoryId) {
        const deleted = await RagService.deleteAgentMemory(savedMemoryId);
        expect(deleted).toBe(true);
      }
    });
  });

  describe('5. RAG HTTP API Endpoints', () => {
    it('GET /api/rag/stats should return vector storage telemetry', async () => {
      const res = await request(app).get('/api/rag/stats');
      expect(res.status).toBe(200);
      expect(res.body.embeddingDimensions).toBe(768);
      expect(res.body.storageEngine).toContain('pgvector');
      expect(typeof res.body.totalChunks).toBe('number');
    });

    it('POST /api/rag/search should return matching chunks', async () => {
      const res = await request(app)
        .post('/api/rag/search')
        .send({
          query: 'kubectl apply deployment',
          limit: 3,
          minSimilarity: 0.3
        });

      expect(res.status).toBe(200);
      expect(res.body.matches).toBeDefined();
      expect(Array.isArray(res.body.matches)).toBe(true);
    });

    it('POST /api/rag/memories and GET /api/rag/memories should work via API', async () => {
      const postRes = await request(app)
        .post('/api/rag/memories')
        .send({
          agentId: testAgentId,
          memoryType: 'EPISODIC',
          keyPoint: 'Pengujian integrasi RAG berhasil 100% tanpa kendala',
          importanceScore: 0.9
        });

      expect(postRes.status).toBe(201);
      const memId = postRes.body.id;

      const getRes = await request(app).get(`/api/rag/memories?agentId=${testAgentId}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.some((m: any) => m.id === memId)).toBe(true);

      // Clean up via API
      await request(app).delete(`/api/rag/memories/${memId}`);
    });
  });

  describe('6. Sandbox Tool Calling: knowledge_search, memory_store, memory_search', () => {
    it('should execute knowledge_search tool in sandbox', async () => {
      const res = await executeToolInSandbox('knowledge_search', {
        query: 'kubectl apply deployment pods kubernetes'
      });

      expect(res.success).toBe(true);
      expect(res.output).toContain('referensi pengetahuan');
    });

    it('should execute memory_store and memory_search tools in sandbox', async () => {
      const storeRes = await executeToolInSandbox(
        'memory_store',
        {
          keyPoint: 'Database connection pool perlu graceful draining saat shutdown',
          memoryType: 'FACTUAL',
          importanceScore: 0.75
        },
        { agentId: testAgentId }
      );

      expect(storeRes.success).toBe(true);
      expect(storeRes.output).toContain('[MEMORI TERSIMPAN]');

      const searchRes = await executeToolInSandbox(
        'memory_search',
        { query: 'database connection pool draining' },
        { agentId: testAgentId }
      );

      expect(searchRes.success).toBe(true);
      expect(searchRes.output).toContain('memori masa lalu');
    });
  });
});
