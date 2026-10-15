/**
 * Unit & Integration Test Suite — Multi-Modal Rich Document Ingestion & Parser
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { pool } from '../src/db/index.js';
import { DocumentParserService } from '../src/services/documentParserService.js';

describe('Rich Document Ingestion & Parser Verification', () => {
  const uploadedDocIds: string[] = [];

  afterAll(async () => {
    if (uploadedDocIds.length > 0) {
      await pool.query('DELETE FROM documents WHERE id = ANY($1)', [uploadedDocIds]);
    }
  });

  describe('1. DocumentParserService Parser Logic', () => {
    it('should parse CSV content into structured markdown table and row summaries', () => {
      const csvData = 'id,name,role,status\n1,Nexus Prime,Orchestrator,ACTIVE\n2,Athena,Planner,READY\n3,Vulcan,Executor,ACTIVE';
      const base64 = Buffer.from(csvData).toString('base64');

      const parsed = DocumentParserService.parseUploadedDocument({
        fileName: 'agents_inventory.csv',
        fileType: 'text/csv',
        fileContentBase64: base64
      });

      expect(parsed.parsedTitle).toBe('Agents Inventory');
      expect(parsed.metadata.parsedFormat).toBe('CSV_TABLE');
      expect(parsed.metadata.rowCount).toBe(3);
      expect(parsed.parsedContent).toContain('| id | name | role | status |');
      expect(parsed.parsedContent).toContain('[Entri #1] id: 1 | name: Nexus Prime');
    });

    it('should parse JSON arrays and format schema summary', () => {
      const jsonData = JSON.stringify([
        { service: 'auth-service', port: 4000, secure: true },
        { service: 'gateway', port: 8080, secure: false }
      ], null, 2);
      const base64 = Buffer.from(jsonData).toString('base64');

      const parsed = DocumentParserService.parseUploadedDocument({
        fileName: 'services-config.json',
        fileType: 'application/json',
        fileContentBase64: base64
      });

      expect(parsed.parsedTitle).toBe('Services Config');
      expect(parsed.metadata.parsedFormat).toBe('JSON_STRUCTURED');
      expect(parsed.parsedContent).toContain('**Tipe Koleksi**: Array (2 item)');
      expect(parsed.parsedContent).toContain('"service": "auth-service"');
    });

    it('should extract text from PDF buffer streams', () => {
      // Simulate minimal PDF structure with BT (Text) ET text block
      const pdfData = '%PDF-1.4\n1 0 obj\n<< /Length 40 >>\nstream\nBT\n/F1 12 Tf\n(Standard Operating Procedure: Disaster Recovery) Tj\nET\nendstream\nendobj\nxref\ntrailer\n<< /Root 1 0 R >>\n%%EOF';
      const base64 = Buffer.from(pdfData, 'latin1').toString('base64');

      const parsed = DocumentParserService.parseUploadedDocument({
        fileName: 'disaster-recovery-sop.pdf',
        fileType: 'application/pdf',
        fileContentBase64: base64
      });

      expect(parsed.parsedTitle).toBe('Disaster Recovery Sop');
      expect(parsed.metadata.parsedFormat).toBe('PDF_EXTRACTED_TEXT');
      expect(parsed.parsedContent).toContain('Standard Operating Procedure: Disaster Recovery');
    });
  });

  describe('2. REST API /api/documents/upload Lifecycle', () => {
    it('POST /api/documents/upload should reject missing payload with 400', async () => {
      const res = await request(app).post('/api/documents/upload').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('POST /api/documents/upload should ingest CSV file and auto-index into RAG', async () => {
      const csvData = 'metric,value,unit\ncpu_idle,84.5,percent\nmemory_free,16384,MB';
      const base64 = Buffer.from(csvData).toString('base64');

      const res = await request(app)
        .post('/api/documents/upload')
        .send({
          fileName: 'system_telemetry.csv',
          fileType: 'text/csv',
          fileContentBase64: base64,
          category: 'SPEC',
          tags: ['telemetry', 'csv', 'benchmark']
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.title).toBe('System Telemetry');
      expect(res.body.category).toBe('SPEC');
      expect(res.body.fileMetadata).toBeDefined();
      expect(res.body.fileMetadata.parsedFormat).toBe('CSV_TABLE');
      expect(res.body.fileMetadata.rowCount).toBe(2);
      expect(res.body.chunkCount).toBeGreaterThanOrEqual(1);
      expect(res.body.isIndexed).toBe(true);

      uploadedDocIds.push(res.body.id);
    });

    it('GET /api/documents should return uploaded documents with fileMetadata', async () => {
      const res = await request(app).get('/api/documents');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);

      const uploaded = res.body.find((d: any) => uploadedDocIds.includes(d.id));
      expect(uploaded).toBeDefined();
      expect(uploaded.fileMetadata).toBeDefined();
      expect(uploaded.fileMetadata.originalFileName).toBe('system_telemetry.csv');
    });
  });
});
