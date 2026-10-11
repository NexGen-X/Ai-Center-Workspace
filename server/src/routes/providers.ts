/**
 * Providers API Routes — AI Agent Command Center
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';
import { ConnectionRouter } from '../adapters/router.js';
import { encryptSecret, decryptSecret, maskApiKey } from '../utils/crypto.js';
import { validateOutgoingUrl } from '../utils/ssrf.js';
import { v4 as uuidv4 } from 'uuid';
import { TestConnectionRequest, TestConnectionResponse } from '../../../shared/types.js';

const router = Router();

// GET /api/providers — List all configured providers (with masked keys)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, workspace_id, name, provider_type, base_url, protocol, 
        api_key_encrypted, enabled, connection_status, last_checked_at, 
        error_message, created_at, updated_at
      FROM model_providers
      ORDER BY created_at ASC;
    `);

    const providers = result.rows.map(row => {
      let apiKeyMasked = undefined;
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
        updatedAt: row.updated_at
      };
    });

    res.json(providers);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/providers/test-connection — Test connection live
router.post('/test-connection', async (req: Request, res: Response) => {
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
router.post('/discover-models', async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey, providerType } = req.body;
    const urlValidation = validateOutgoingUrl(baseUrl);
    if (!urlValidation.isValid) {
      return res.status(400).json({ error: { message: urlValidation.error } });
    }

    const adapter = ConnectionRouter.getAdapter(providerType || 'custom_api');
    const models = await adapter.discoverModels({
      baseUrl,
      apiKey,
      timeoutMs: 10000
    });

    res.json({ models });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

export default router;
