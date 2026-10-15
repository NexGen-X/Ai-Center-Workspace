import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { pool } from '../src/db/index.js';
import { executeToolInSandbox } from '../src/services/sandbox.js';

describe('Autonomous Web Research & Live Browser Engine API', () => {
  let createdDocId = '';

  afterAll(async () => {
    if (createdDocId) {
      await pool.query('DELETE FROM document_chunks WHERE document_id = $1', [createdDocId]);
      await pool.query('DELETE FROM documents WHERE id = $1', [createdDocId]);
    }
  });

  it('POST /api/web-research/search should reject empty query with 400', async () => {
    const res = await request(app).post('/api/web-research/search').send({ query: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('POST /api/web-research/search should return structured search results', async () => {
    const res = await request(app).post('/api/web-research/search').send({
      query: 'PostgreSQL pgvector',
      limit: 3
    });

    expect(res.status).toBe(200);
    expect(res.body.query).toBe('PostgreSQL pgvector');
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.results.length).toBeGreaterThan(0);
    expect(res.body.results[0].title).toBeDefined();
    expect(res.body.results[0].url).toBeDefined();
    expect(res.body.results[0].snippet).toBeDefined();
  });

  it('POST /api/web-research/browse should block SSRF and cloud metadata addresses', async () => {
    const res = await request(app).post('/api/web-research/browse').send({
      url: 'http://169.254.169.254/latest/meta-data/'
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Akses ke cloud metadata service');
  });

  it('POST /api/web-research/browse should sanitize HTML and extract clean Markdown content', async () => {
    const res = await request(app).post('/api/web-research/browse').send({
      url: 'https://en.wikipedia.org/wiki/Vector_database',
      maxLength: 2000
    });

    expect(res.status).toBe(200);
    expect(res.body.url).toContain('wikipedia.org');
    expect(res.body.title).toBeDefined();
    expect(res.body.markdownContent).toBeDefined();
    expect(res.body.markdownContent.length).toBeGreaterThan(20);
    // Should not contain raw script tags
    expect(res.body.markdownContent).not.toContain('<script');
  });

  it('POST /api/web-research/ingest should autonomously research and index findings into pgvector RAG memory', async () => {
    const res = await request(app).post('/api/web-research/ingest').send({
      query: 'Distributed Consensus Raft Algorithm',
      documentTitle: 'Spesifikasi & Riset: Distributed Consensus Raft',
      tags: ['consensus', 'distributed-systems']
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.documentId).toBeDefined();
    expect(res.body.title).toContain('Distributed Consensus Raft');
    expect(res.body.category).toBe('RESEARCH');
    expect(res.body.chunksIndexed).toBeGreaterThan(0);
    expect(Array.isArray(res.body.sources)).toBe(true);
    expect(res.body.sources.length).toBeGreaterThan(0);

    createdDocId = res.body.documentId;
  });

  it('executeToolInSandbox should support web_search for autonomous agents', async () => {
    const result = await executeToolInSandbox('web_search', {
      query: 'Zero-Downtime Deployment Best Practices',
      limit: 2
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('Hasil pencarian web');
    expect(result.output).toContain('Zero-Downtime Deployment');
  });

  it('executeToolInSandbox should support web_browse for autonomous agents', async () => {
    const result = await executeToolInSandbox('web_browse', {
      url: 'https://en.wikipedia.org/wiki/Site_reliability_engineering',
      maxLength: 1000
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain('KONTEN WEB');
  });
});
