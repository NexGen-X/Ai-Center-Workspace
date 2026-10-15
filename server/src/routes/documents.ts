import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { realtimeHub } from '../services/realtime.js';
import { DocumentItem } from '../../../shared/types.js';
import { RagService } from '../services/ragService.js';

const router = Router();

// GET /api/documents
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, projectId } = req.query;
    let query = `
      SELECT d.id, d.workspace_id, d.project_id, d.title, d.content, d.category, d.tags, d.file_metadata, d.created_at, d.updated_at,
             COUNT(dc.id)::int as chunk_count
      FROM documents d
      LEFT JOIN document_chunks dc ON d.id = dc.document_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (category) {
      params.push(category);
      query += ` AND d.category = $${params.length}`;
    }
    if (projectId) {
      params.push(projectId);
      query += ` AND d.project_id = $${params.length}`;
    }

    query += ` GROUP BY d.id ORDER BY d.updated_at DESC`;

    const result = await pool.query(query, params);
    const documents: DocumentItem[] = result.rows.map((row: any) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      projectId: row.project_id || undefined,
      title: row.title,
      content: row.content,
      category: row.category,
      tags: Array.isArray(row.tags) ? row.tags : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      chunkCount: row.chunk_count || 0,
      isIndexed: (row.chunk_count || 0) > 0,
      fileMetadata: typeof row.file_metadata === 'string' ? JSON.parse(row.file_metadata) : (row.file_metadata || undefined)
    }));

    res.json(documents);
  } catch (err) {
    next(err);
  }
});

// GET /api/documents/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT d.id, d.workspace_id, d.project_id, d.title, d.content, d.category, d.tags, d.file_metadata, d.created_at, d.updated_at,
              COUNT(dc.id)::int as chunk_count
       FROM documents d
       LEFT JOIN document_chunks dc ON d.id = dc.document_id
       WHERE d.id = $1
       GROUP BY d.id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Dokumen tidak ditemukan.' } });
    }

    const row = result.rows[0];
    const doc: DocumentItem = {
      id: row.id,
      workspaceId: row.workspace_id,
      projectId: row.project_id || undefined,
      title: row.title,
      content: row.content,
      category: row.category,
      tags: Array.isArray(row.tags) ? row.tags : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      chunkCount: row.chunk_count || 0,
      isIndexed: (row.chunk_count || 0) > 0,
      fileMetadata: typeof row.file_metadata === 'string' ? JSON.parse(row.file_metadata) : (row.file_metadata || undefined)
    };

    res.json(doc);
  } catch (err) {
    next(err);
  }
});

// POST /api/documents
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, content, category = 'SOP', tags = [], projectId } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: { message: 'Judul dan isi dokumen wajib diisi.' } });
    }

    const id = `doc-${uuidv4().slice(0, 8)}`;
    const workspaceId = 'ws-default-command-center';

    const insertRes = await pool.query(
      `INSERT INTO documents (id, workspace_id, project_id, title, content, category, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, workspaceId, projectId || null, title, content, category, JSON.stringify(tags)]
    );

    const row = insertRes.rows[0];
    const newDoc: DocumentItem = {
      id: row.id,
      workspaceId: row.workspace_id,
      projectId: row.project_id || undefined,
      title: row.title,
      content: row.content,
      category: row.category,
      tags: Array.isArray(row.tags) ? row.tags : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      chunkCount: 0,
      isIndexed: false,
    };

    // Auto-trigger RAG vector indexing in background
    RagService.indexDocument(id).catch(err => {
      console.error(`[RAG Auto-Index Error] Failed to index document ${id}:`, err.message);
    });

    // Log Activity
    await pool.query(
      `INSERT INTO activities (id, workspace_id, actor_type, actor_name, event_type, summary, target_type, target_id)
       VALUES ($1, $2, 'USER', 'Operator', 'DOCUMENT_CREATED', $3, 'DOCUMENT', $4)`,
      [`act-${uuidv4().slice(0, 8)}`, workspaceId, `Dokumen baru dibuat: "${title}" (${category})`, id]
    );

    realtimeHub.broadcast('activity', { summary: `Dokumen baru: ${title}`, category });

    res.status(201).json(newDoc);
  } catch (err) {
    next(err);
  }
});

// POST /api/documents/upload — Ingest rich files (PDF, CSV, JSON, MD, TXT)
router.post('/upload', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fileName, fileType, fileContentBase64, category = 'SOP', tags = [], projectId } = req.body;

    if (!fileContentBase64 || !fileName) {
      return res.status(400).json({ error: { message: 'Nama file dan konten base64 wajib disertakan.' } });
    }

    const { DocumentParserService } = await import('../services/documentParserService.js');
    const parsed = DocumentParserService.parseUploadedDocument({
      fileName,
      fileType: fileType || 'text/plain',
      fileContentBase64
    });

    const id = `doc-${uuidv4().slice(0, 8)}`;
    const workspaceId = 'ws-default-command-center';

    const insertRes = await pool.query(
      `INSERT INTO documents (id, workspace_id, project_id, title, content, category, tags, file_metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        id,
        workspaceId,
        projectId || null,
        parsed.parsedTitle,
        parsed.parsedContent,
        category,
        JSON.stringify(tags),
        JSON.stringify(parsed.metadata)
      ]
    );

    const row = insertRes.rows[0];

    // Trigger immediate RAG indexing
    let chunkCount = 0;
    try {
      const indexResult = await RagService.indexDocument(id);
      chunkCount = indexResult.chunksIndexed;
    } catch (indexErr: any) {
      console.error(`[RAG Auto-Index Error] Failed to index uploaded doc ${id}:`, indexErr.message);
    }

    const newDoc: DocumentItem = {
      id: row.id,
      workspaceId: row.workspace_id,
      projectId: row.project_id || undefined,
      title: row.title,
      content: row.content,
      category: row.category,
      tags: Array.isArray(row.tags) ? row.tags : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      chunkCount,
      isIndexed: chunkCount > 0,
      fileMetadata: parsed.metadata
    };

    // Log Activity
    await pool.query(
      `INSERT INTO activities (id, workspace_id, actor_type, actor_name, event_type, summary, target_type, target_id)
       VALUES ($1, $2, 'USER', 'Operator', 'DOCUMENT_UPLOADED', $3, 'DOCUMENT', $4)`,
      [`act-${uuidv4().slice(0, 8)}`, workspaceId, `File diunggah & diindeks: "${parsed.parsedTitle}" (${parsed.metadata.parsedFormat})`, id]
    );

    realtimeHub.broadcast('activity', { summary: `File diunggah: ${parsed.parsedTitle}`, category });
    realtimeHub.broadcast('document.uploaded', newDoc);

    res.status(201).json(newDoc);
  } catch (err) {
    next(err);
  }
});

// PUT /api/documents/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { title, content, category, tags, projectId } = req.body;

    const existingRes = await pool.query(`SELECT * FROM documents WHERE id = $1`, [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Dokumen tidak ditemukan.' } });
    }

    const existing = existingRes.rows[0];
    const updatedTitle = title !== undefined ? title : existing.title;
    const updatedContent = content !== undefined ? content : existing.content;
    const updatedCategory = category !== undefined ? category : existing.category;
    const updatedTags = JSON.stringify(tags !== undefined ? tags : (existing.tags || []));
    const updatedProjectId = projectId !== undefined ? projectId : existing.project_id;

    const updateRes = await pool.query(
      `UPDATE documents 
       SET title = $1, content = $2, category = $3, tags = $4, project_id = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [updatedTitle, updatedContent, updatedCategory, updatedTags, updatedProjectId || null, id]
    );

    const row = updateRes.rows[0];

    // Re-index document in background
    RagService.indexDocument(id).catch(err => {
      console.error(`[RAG Auto-Index Error] Failed to re-index document ${id}:`, err.message);
    });

    const updatedDoc: DocumentItem = {
      id: row.id,
      workspaceId: row.workspace_id,
      projectId: row.project_id || undefined,
      title: row.title,
      content: row.content,
      category: row.category,
      tags: Array.isArray(row.tags) ? row.tags : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      chunkCount: 1, // Will be updated asynchronously
      isIndexed: true,
    };

    res.json(updatedDoc);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/documents/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`DELETE FROM documents WHERE id = $1 RETURNING title`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Dokumen tidak ditemukan.' } });
    }

    res.json({ success: true, message: `Dokumen "${result.rows[0].title}" berhasil dihapus.` });
  } catch (err) {
    next(err);
  }
});

export default router;
