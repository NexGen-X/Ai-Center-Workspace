/**
 * Providers API Routes — AI Agent Command Center
 * End-to-end management of Model Providers with AES-256-GCM encryption,
 * SSRF guard, real-time sync, and agent dependency protection.
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';
import { config } from '../config/index.js';
import { ConnectionRouter } from '../adapters/router.js';
import { encryptSecret, decryptSecret, maskApiKey } from '../utils/crypto.js';
import { validateOutgoingUrl } from '../utils/ssrf.js';
import { realtimeHub } from '../services/realtime.js';
import { requireAuth } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';
import {
  TestConnectionRequest,
  TestConnectionResponse,
  CreateProviderRequest,
  UpdateProviderRequest,
  ProtocolType
} from '../../../shared/types.js';

const router = Router();

// Helper to format provider row for API responses
function formatProviderRow(row: any) {
  let apiKeyMasked: string | undefined = undefined;
  if (row.api_key_encrypted) {
    const decrypted = decryptSecret(row.api_key_encrypted);
    apiKeyMasked = maskApiKey(decrypted);
  }
  return {
    id: row.id,
    name: row.name,
    providerType: row.provider_type,
    baseUrl: row.base_url,
    protocol: row.protocol,
    apiKeyMasked,
    enabled: row.enabled,
    connectionStatus: row.connection_status,
    lastCheckedAt: row.last_checked_at,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    agentCount: row.agent_count ? parseInt(row.agent_count, 10) : 0
  };
}

// GET /api/providers — List all configured providers (with masked keys & agent counts)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.id, p.workspace_id, p.name, p.provider_type, p.base_url, p.protocol, 
        p.api_key_encrypted, p.enabled, p.connection_status, p.last_checked_at, 
        p.error_message, p.created_at, p.updated_at,
        COUNT(a.id)::int AS agent_count
      FROM model_providers p
      LEFT JOIN ai_agents a ON a.provider_id = p.id
      GROUP BY p.id
      ORDER BY p.created_at ASC;
    `);

    const providers = result.rows.map(formatProviderRow);
    res.json(providers);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// GET /api/providers/:id — Get details of a single provider
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT 
        p.id, p.workspace_id, p.name, p.provider_type, p.base_url, p.protocol, 
        p.api_key_encrypted, p.enabled, p.connection_status, p.last_checked_at, 
        p.error_message, p.created_at, p.updated_at,
        COUNT(a.id)::int AS agent_count
      FROM model_providers p
      LEFT JOIN ai_agents a ON a.provider_id = p.id
      WHERE p.id = $1
      GROUP BY p.id;
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Provider tidak ditemukan.' } });
    }

    res.json(formatProviderRow(result.rows[0]));
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/providers — Create a new model provider
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const body: CreateProviderRequest = req.body;

    if (!body.name || !body.name.trim()) {
      return res.status(400).json({ error: { message: 'Nama provider wajib diisi.' } });
    }
    if (!body.providerType) {
      return res.status(400).json({ error: { message: 'Tipe provider wajib dipilih.' } });
    }
    if (!body.baseUrl || !body.baseUrl.trim()) {
      return res.status(400).json({ error: { message: 'Base URL provider wajib diisi.' } });
    }

    // SSRF Check
    const urlValidation = validateOutgoingUrl(body.baseUrl);
    if (!urlValidation.isValid) {
      return res.status(400).json({ error: { message: urlValidation.error || 'Base URL tidak diizinkan.' } });
    }

    // Determine protocol default if not specified
    let protocol: ProtocolType = body.protocol || 'openai';
    if (!body.protocol) {
      if (body.providerType === 'gemini') protocol = 'gemini';
      else if (body.providerType === 'anthropic') protocol = 'anthropic';
      else if (body.providerType === 'ollama') protocol = 'ollama';
      else if (body.providerType === 'hermes') protocol = 'hermes_runtime';
    }

    const providerId = `prov-${uuidv4().slice(0, 8)}`;
    const encryptedKey = body.apiKey && body.apiKey.trim() ? encryptSecret(body.apiKey.trim()) : null;
    const enabled = body.enabled !== false;

    // Optional quick connection probe
    let connectionStatus = 'NOT_CONFIGURED';
    let errorMessage: string | null = null;

    try {
      const adapter = ConnectionRouter.getAdapter(body.providerType);
      const testResult = await adapter.testConnection({
        baseUrl: body.baseUrl.trim(),
        apiKey: body.apiKey?.trim(),
        protocol,
        timeoutMs: 4000
      });
      connectionStatus = testResult.status;
      if (!testResult.success) {
        errorMessage = testResult.message;
      }
    } catch {
      // Keep NOT_CONFIGURED if probe times out or fails during creation
    }

    const insertResult = await pool.query(`
      INSERT INTO model_providers (
        id, workspace_id, name, provider_type, base_url, protocol,
        api_key_encrypted, enabled, connection_status, last_checked_at, error_message
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, $10
      ) RETURNING *, 0 as agent_count;
    `, [
      providerId,
      config.defaultWorkspaceId,
      body.name.trim(),
      body.providerType,
      body.baseUrl.trim(),
      protocol,
      encryptedKey,
      enabled,
      connectionStatus,
      errorMessage
    ]);

    const createdProvider = formatProviderRow(insertResult.rows[0]);

    // Broadcast SSE
    realtimeHub.broadcast('provider.created', createdProvider);

    res.status(201).json(createdProvider);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// PUT /api/providers/:id — Update provider configuration & optionally replace API key
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body: UpdateProviderRequest = req.body;

    const existingRes = await pool.query('SELECT * FROM model_providers WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Provider tidak ditemukan.' } });
    }
    const existing = existingRes.rows[0];

    const newName = body.name !== undefined ? body.name.trim() : existing.name;
    const newProviderType = body.providerType || existing.provider_type;
    const newBaseUrl = body.baseUrl !== undefined ? body.baseUrl.trim() : existing.base_url;
    const newProtocol = body.protocol || existing.protocol;
    const newEnabled = body.enabled !== undefined ? body.enabled : existing.enabled;

    // Validate URL if changed
    if (body.baseUrl !== undefined) {
      const urlValidation = validateOutgoingUrl(newBaseUrl);
      if (!urlValidation.isValid) {
        return res.status(400).json({ error: { message: urlValidation.error || 'Base URL tidak diizinkan.' } });
      }
    }

    let newEncryptedKey = existing.api_key_encrypted;
    if (body.apiKey !== undefined) {
      if (body.apiKey.trim()) {
        newEncryptedKey = encryptSecret(body.apiKey.trim());
      } else {
        newEncryptedKey = null;
      }
    }

    await pool.query(`
      UPDATE model_providers
      SET 
        name = $1,
        provider_type = $2,
        base_url = $3,
        protocol = $4,
        api_key_encrypted = $5,
        enabled = $6,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7;
    `, [newName, newProviderType, newBaseUrl, newProtocol, newEncryptedKey, newEnabled, id]);

    // Fetch updated row with agent count
    const updatedRes = await pool.query(`
      SELECT 
        p.id, p.workspace_id, p.name, p.provider_type, p.base_url, p.protocol, 
        p.api_key_encrypted, p.enabled, p.connection_status, p.last_checked_at, 
        p.error_message, p.created_at, p.updated_at,
        COUNT(a.id)::int AS agent_count
      FROM model_providers p
      LEFT JOIN ai_agents a ON a.provider_id = p.id
      WHERE p.id = $1
      GROUP BY p.id;
    `, [id]);

    const updatedProvider = formatProviderRow(updatedRes.rows[0]);

    // Broadcast SSE
    realtimeHub.broadcast('provider.updated', updatedProvider);

    res.json(updatedProvider);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// DELETE /api/providers/:id — Delete provider with agent dependency protection
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existingRes = await pool.query('SELECT * FROM model_providers WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: { message: 'Provider tidak ditemukan.' } });
    }

    // Check if any agents depend on this provider
    const agentCheck = await pool.query(`
      SELECT COUNT(*)::int AS count, ARRAY_AGG(name) AS agent_names
      FROM ai_agents
      WHERE provider_id = $1;
    `, [id]);

    const count = agentCheck.rows[0].count;
    if (count > 0) {
      const namesList = (agentCheck.rows[0].agent_names || []).slice(0, 3).join(', ');
      const moreSuffix = count > 3 ? ` dan ${count - 3} lainnya` : '';
      return res.status(400).json({
        error: {
          message: `Provider tidak dapat dihapus karena masih digunakan oleh ${count} agen AI (${namesList}${moreSuffix}). Alihkan provider agen terlebih dahulu di menu Tim.`
        }
      });
    }

    await pool.query('DELETE FROM model_providers WHERE id = $1', [id]);

    // Broadcast SSE
    realtimeHub.broadcast('provider.deleted', { id });

    res.json({ success: true, message: 'Provider berhasil dihapus.' });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/providers/:id/test-connection — Test connection of a specific saved provider by ID
router.post('/:id/test-connection', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rowRes = await pool.query('SELECT * FROM model_providers WHERE id = $1', [id]);
    if (rowRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        status: 'CONNECTION_FAILED',
        message: 'Provider tidak ditemukan.'
      });
    }

    const row = rowRes.rows[0];
    let apiKey: string | undefined = undefined;
    if (row.api_key_encrypted) {
      apiKey = decryptSecret(row.api_key_encrypted);
    }

    // SSRF Check
    const urlValidation = validateOutgoingUrl(row.base_url);
    if (!urlValidation.isValid) {
      return res.status(400).json({
        success: false,
        status: 'CONNECTION_FAILED',
        message: urlValidation.error || 'Base URL tidak diizinkan.'
      });
    }

    const adapter = ConnectionRouter.getAdapter(row.provider_type);
    const testResult = await adapter.testConnection({
      baseUrl: row.base_url,
      apiKey,
      protocol: row.protocol,
      timeoutMs: 10000
    });

    await pool.query(`
      UPDATE model_providers
      SET connection_status = $1, last_checked_at = CURRENT_TIMESTAMP, error_message = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3;
    `, [testResult.status, testResult.success ? null : testResult.message, id]);

    // Broadcast updated status via SSE
    realtimeHub.broadcast('provider.updated', {
      id,
      connectionStatus: testResult.status,
      lastCheckedAt: new Date().toISOString(),
      errorMessage: testResult.success ? null : testResult.message
    });

    const response: TestConnectionResponse = {
      success: testResult.success,
      status: testResult.status,
      message: testResult.message,
      discoveredModels: testResult.discoveredModels,
      latencyMs: testResult.latencyMs
    };

    res.json(response);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      status: 'CONNECTION_FAILED',
      message: `Error saat menguji koneksi: ${err.message}`
    });
  }
});

// POST /api/providers/test-connection — Test connection live (ad-hoc or existing)
router.post('/test-connection', requireAuth, async (req: Request, res: Response) => {
  try {
    const body: TestConnectionRequest = req.body;
    let apiKey = body.apiKey;

    // If testing an existing saved provider without providing a new key:
    if (body.existingProviderId && !apiKey) {
      const row = await pool.query('SELECT api_key_encrypted FROM model_providers WHERE id = $1', [body.existingProviderId]);
      if (row.rows.length > 0 && row.rows[0].api_key_encrypted) {
        apiKey = decryptSecret(row.rows[0].api_key_encrypted);
      }
    }

    // SSRF Check
    const urlValidation = validateOutgoingUrl(body.baseUrl);
    if (!urlValidation.isValid) {
      const response: TestConnectionResponse = {
        success: false,
        status: 'CONNECTION_FAILED',
        message: urlValidation.error || 'Base URL tidak diizinkan.'
      };
      return res.status(400).json(response);
    }

    const adapter = ConnectionRouter.getAdapter(body.providerType);
    const testResult = await adapter.testConnection({
      baseUrl: body.baseUrl,
      apiKey,
      protocol: body.protocol,
      timeoutMs: 10000
    });

    // If an existing provider was tested, update its status in DB
    if (body.existingProviderId) {
      await pool.query(`
        UPDATE model_providers
        SET connection_status = $1, last_checked_at = CURRENT_TIMESTAMP, error_message = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3;
      `, [testResult.status, testResult.success ? null : testResult.message, body.existingProviderId]);
    }

    const response: TestConnectionResponse = {
      success: testResult.success,
      status: testResult.status,
      message: testResult.message,
      discoveredModels: testResult.discoveredModels,
      latencyMs: testResult.latencyMs
    };

    res.json(response);
  } catch (err: any) {
    res.status(500).json({
      success: false,
      status: 'CONNECTION_FAILED',
      message: `Error saat menguji koneksi: ${err.message}`
    });
  }
});

// POST /api/providers/discover-models — Query upstream models
router.post('/discover-models', requireAuth, async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey, providerType, existingProviderId } = req.body;
    let effectiveApiKey = apiKey;

    if (existingProviderId && !effectiveApiKey) {
      const row = await pool.query('SELECT api_key_encrypted FROM model_providers WHERE id = $1', [existingProviderId]);
      if (row.rows.length > 0 && row.rows[0].api_key_encrypted) {
        effectiveApiKey = decryptSecret(row.rows[0].api_key_encrypted);
      }
    }

    const urlValidation = validateOutgoingUrl(baseUrl);
    if (!urlValidation.isValid) {
      return res.status(400).json({ error: { message: urlValidation.error } });
    }

    const adapter = ConnectionRouter.getAdapter(providerType || 'custom_api');
    const models = await adapter.discoverModels({
      baseUrl,
      apiKey: effectiveApiKey,
      timeoutMs: 10000
    });

    res.json({ models });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

export default router;
