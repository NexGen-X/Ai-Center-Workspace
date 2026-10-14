/**
 * AI Playground & Multi-Model Benchmark API — AI Agent Command Center
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';
import { ConnectionRouter } from '../adapters/router.js';
import { decryptSecret } from '../utils/crypto.js';
import { systemLogger } from '../services/logger.js';
import { realtimeHub } from '../services/realtime.js';

const router = Router();

interface BenchmarkTarget {
  slotId: 'A' | 'B';
  providerId: string;
  modelId: string;
  customSystemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

// POST /api/playground/execute — Execute prompt comparison across selected models
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { prompt, globalSystemPrompt, targets } = req.body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: { message: 'Prompt pengujian wajib diisi.' } });
    }

    if (!Array.isArray(targets) || targets.length === 0) {
      return res.status(400).json({ error: { message: 'Minimal satu model target harus dipilih untuk pengujian.' } });
    }

    const results = await Promise.all(
      targets.slice(0, 2).map(async (target: BenchmarkTarget) => {
        const startTime = Date.now();
        try {
          const provRes = await pool.query(
            'SELECT id, name, provider_type, base_url, protocol, api_key_encrypted, enabled FROM model_providers WHERE id = $1',
            [target.providerId]
          );

          if (provRes.rows.length === 0) {
            throw new Error(`Provider dengan ID ${target.providerId} tidak ditemukan.`);
          }

          const prov = provRes.rows[0];
          const apiKey = prov.api_key_encrypted ? decryptSecret(prov.api_key_encrypted) : undefined;
          const adapter = ConnectionRouter.getAdapter(prov.provider_type);

          const systemPrompt = target.customSystemPrompt || globalSystemPrompt || 'You are an advanced AI assistant.';
          const params = {
            temperature: typeof target.temperature === 'number' ? target.temperature : 0.7,
            maxTokens: typeof target.maxTokens === 'number' ? target.maxTokens : 2048
          };

          systemLogger.info('INFERENCE', `[Playground Slot ${target.slotId}] Mengirim prompt ke ${target.modelId} (${prov.name})`);

          let accumulated = '';
          const onChunk = (chunk: string) => {
            accumulated += chunk;
            realtimeHub.broadcast('playground.token_chunk', {
              slotId: target.slotId,
              providerId: prov.id,
              modelId: target.modelId,
              chunk,
              text: accumulated
            });
          };

          const execRes = await adapter.execute(
            {
              baseUrl: prov.base_url,
              apiKey,
              protocol: prov.protocol,
              timeoutMs: 40000
            },
            target.modelId,
            systemPrompt,
            prompt,
            params,
            onChunk
          );

          return {
            slotId: target.slotId,
            providerId: prov.id,
            providerName: prov.name,
            modelId: target.modelId,
            success: execRes.success,
            status: execRes.status,
            outputResult: execRes.outputResult,
            durationMs: execRes.durationMs || (Date.now() - startTime),
            tokensUsed: execRes.tokensUsed || {
              promptTokens: Math.round(prompt.length / 4),
              completionTokens: Math.round((execRes.outputResult || '').length / 4),
              totalTokens: Math.round((prompt.length + (execRes.outputResult || '').length) / 4)
            },
            errorMessage: execRes.errorMessage
          };
        } catch (err: any) {
          return {
            slotId: target.slotId,
            providerId: target.providerId,
            providerName: 'Unknown',
            modelId: target.modelId,
            success: false,
            status: 'FAILED',
            outputResult: undefined,
            durationMs: Date.now() - startTime,
            errorMessage: err.message || 'Eksekusi gagal'
          };
        }
      })
    );

    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

export default router;
