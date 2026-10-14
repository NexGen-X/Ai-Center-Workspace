/**
 * Preset Provider Adapter — AI Agent Command Center
 * Pre-configured adapters for verified providers (Route-X Local, OpenAI, Anthropic, Gemini, Groq, Ollama).
 */

import { BaseConnectionAdapter, AdapterConfig, AdapterTestResult, AdapterExecutionResult, OnTokenChunk } from './base.js';
import { CustomApiAdapter } from './customApi.js';
import { ProviderType } from '../../../shared/types.js';

export class PresetProviderAdapter implements BaseConnectionAdapter {
  private customAdapter = new CustomApiAdapter();

  constructor(private providerType: ProviderType) {}

  async testConnection(config: AdapterConfig): Promise<AdapterTestResult> {
    const startTime = Date.now();

    // Special handling for local Route-X Gateway
    if (this.providerType === 'routex_local') {
      try {
        const res = await fetch('http://localhost:8080/v1/models', {
          method: 'GET',
          headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}
        });

        const latencyMs = Date.now() - startTime;
        if (res.status === 401 || res.status === 403) {
          return {
            success: false,
            status: 'CONNECTION_FAILED',
            message: 'Route-X Gateway lokal merespons, namun API key/token tidak sah.',
            latencyMs
          };
        }

        if (res.ok) {
          const body = await res.json() as any;
          const models = Array.isArray(body.data) ? body.data.map((m: any) => m.id) : [];
          return {
            success: true,
            status: 'MODEL_VERIFIED',
            message: `Route-X AI Gateway aktif (latensi: ${latencyMs}ms). Ditemukan ${models.length} model.`,
            discoveredModels: models,
            latencyMs
          };
        }

        // Even with non-200, if service is reachable:
        return {
          success: true,
          status: 'CONNECTION_OK',
          message: `Route-X AI Gateway lokal aktif dan merespons (HTTP ${res.status}).`,
          latencyMs
        };
      } catch (err: any) {
        return {
          success: false,
          status: 'CONNECTION_FAILED',
          message: `Tidak dapat menghubungi Route-X Gateway di localhost:8080: ${err.message}`,
          latencyMs: Date.now() - startTime
        };
      }
    }

    // Google Gemini API specific probe
    if (this.providerType === 'gemini') {
      try {
        const url = `${config.baseUrl.replace(/\/+$/, '')}/models?key=${config.apiKey || ''}`;
        const res = await fetch(url);
        const latencyMs = Date.now() - startTime;
        if (res.ok) {
          const body = await res.json() as any;
          const models = Array.isArray(body.models) ? body.models.map((m: any) => m.name.replace('models/', '')) : [];
          return {
            success: true,
            status: 'MODEL_VERIFIED',
            message: `Koneksi Google Gemini berhasil. Ditemukan ${models.length} model.`,
            discoveredModels: models,
            latencyMs
          };
        }
        const errText = await res.text();
        return {
          success: false,
          status: 'CONNECTION_FAILED',
          message: `Gagal verifikasi Gemini API (HTTP ${res.status}): ${errText.slice(0, 150)}`,
          latencyMs
        };
      } catch (err: any) {
        return {
          success: false,
          status: 'CONNECTION_FAILED',
          message: `Error Gemini API: ${err.message}`,
          latencyMs: Date.now() - startTime
        };
      }
    }

    // Default delegation to CustomApiAdapter (handles OpenAI, Anthropic, Groq, Ollama)
    return this.customAdapter.testConnection(config);
  }

  async discoverModels(config: AdapterConfig): Promise<string[]> {
    if (this.providerType === 'gemini') {
      try {
        const url = `${config.baseUrl.replace(/\/+$/, '')}/models?key=${config.apiKey || ''}`;
        const res = await fetch(url);
        if (res.ok) {
          const body = await res.json() as any;
          return Array.isArray(body.models) ? body.models.map((m: any) => m.name.replace('models/', '')) : [];
        }
      } catch {
        return [];
      }
    }
    return this.customAdapter.discoverModels(config);
  }

  async execute(
    config: AdapterConfig,
    modelId: string,
    systemPrompt: string,
    userPrompt: string,
    params?: Record<string, any>,
    onChunk?: OnTokenChunk
  ): Promise<AdapterExecutionResult> {
    if (this.providerType === 'gemini') {
      const startTime = Date.now();
      try {
        const cleanModel = modelId.startsWith('models/') ? modelId : `models/${modelId}`;
        const isStreaming = Boolean(onChunk);
        const endpointAction = isStreaming ? 'streamGenerateContent?alt=sse&key=' : 'generateContent?key=';
        const url = `${config.baseUrl.replace(/\/+$/, '')}/${cleanModel}:${endpointAction}${config.apiKey || ''}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
            generationConfig: {
              temperature: params?.temperature ?? 0.7,
              maxOutputTokens: params?.maxTokens || 2048
            }
          })
        });

        const durationMs = Date.now() - startTime;
        if (!res.ok) {
          const errText = await res.text();
          return {
            success: false,
            status: 'FAILED',
            errorCode: `HTTP_${res.status}`,
            errorMessage: errText.slice(0, 300),
            durationMs
          };
        }

        if (isStreaming && res.body && onChunk) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let textOutput = '';
          let buffer = '';
          let promptTokens = 0;
          let candidateTokens = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith(':')) continue;
              if (trimmed.startsWith('data: ')) {
                try {
                  const json = JSON.parse(trimmed.slice(6));
                  const delta = json.candidates?.[0]?.content?.parts?.[0]?.text;
                  if (delta) {
                    textOutput += delta;
                    onChunk(delta);
                  }
                  if (json.usageMetadata) {
                    promptTokens = json.usageMetadata.promptTokenCount || promptTokens;
                    candidateTokens = json.usageMetadata.candidatesTokenCount || candidateTokens;
                  }
                } catch {
                  // ignore incomplete JSON chunk
                }
              }
            }
          }

          const completionTokens = candidateTokens || Math.ceil(textOutput.length / 4);
          const pTokens = promptTokens || Math.ceil((systemPrompt.length + userPrompt.length) / 4);
          return {
            success: true,
            status: 'SUCCEEDED',
            outputResult: textOutput,
            durationMs: Date.now() - startTime,
            tokensUsed: {
              promptTokens: pTokens,
              completionTokens,
              totalTokens: pTokens + completionTokens
            }
          };
        }

        const data = await res.json() as any;
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (onChunk && text) {
          onChunk(text);
        }
        return {
          success: true,
          status: 'SUCCEEDED',
          outputResult: text,
          durationMs,
          tokensUsed: {
            promptTokens: data.usageMetadata?.promptTokenCount || 0,
            completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
            totalTokens: data.usageMetadata?.totalTokenCount || 0
          }
        };
      } catch (err: any) {
        return {
          success: false,
          status: 'FAILED',
          errorCode: 'GEMINI_CALL_ERROR',
          errorMessage: err.message,
          durationMs: Date.now() - startTime
        };
      }
    }

    return this.customAdapter.execute(config, modelId, systemPrompt, userPrompt, params, onChunk);
  }
}
