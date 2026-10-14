/**
 * Custom API Connection Adapter — AI Agent Command Center
 * Supports OpenAI-compatible and Anthropic-compatible custom endpoints with SSRF protection.
 */

import { BaseConnectionAdapter, AdapterConfig, AdapterTestResult, AdapterExecutionResult, OnTokenChunk } from './base.js';
import { validateOutgoingUrl } from '../utils/ssrf.js';

export class CustomApiAdapter implements BaseConnectionAdapter {
  async testConnection(config: AdapterConfig): Promise<AdapterTestResult> {
    const startTime = Date.now();
    const urlValidation = validateOutgoingUrl(config.baseUrl);
    if (!urlValidation.isValid) {
      return {
        success: false,
        status: 'CONNECTION_FAILED',
        message: urlValidation.error || 'Base URL tidak valid.'
      };
    }

    try {
      // 1. Try model discovery if supported (OpenAI standard GET /models or /v1/models)
      const models = await this.discoverModels(config);
      const latencyMs = Date.now() - startTime;
      return {
        success: true,
        status: models.length > 0 ? 'MODEL_VERIFIED' : 'CONNECTION_OK',
        message: models.length > 0 
          ? `Koneksi berhasil. Ditemukan ${models.length} model dari provider.`
          : 'Koneksi ke endpoint berhasil terverifikasi.',
        discoveredModels: models,
        latencyMs
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      
      // Fallback: If GET /models fails (some endpoints only support completions), attempt a minimal completion probe
      try {
        const probeResult = await this.probeChatCompletion(config);
        if (probeResult.success) {
          return {
            success: true,
            status: 'CONNECTION_OK',
            message: 'Endpoint chat completions merespons dengan baik (model discovery tidak tersedia).',
            latencyMs: Date.now() - startTime
          };
        }
      } catch {
        // ignore probe failure and return original error
      }

      return {
        success: false,
        status: 'CONNECTION_FAILED',
        message: `Gagal terhubung ke endpoint: ${err.message}`,
        latencyMs
      };
    }
  }

  async discoverModels(config: AdapterConfig): Promise<string[]> {
    const urlValidation = validateOutgoingUrl(config.baseUrl);
    if (!urlValidation.isValid) return [];

    let targetUrl = config.baseUrl.replace(/\/+$/, '');
    if (!targetUrl.endsWith('/models')) {
      targetUrl = targetUrl.endsWith('/v1') ? `${targetUrl}/models` : `${targetUrl}/v1/models`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs || 8000);

    try {
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers,
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 200)}`);
      }

      const data = await response.json() as any;
      if (Array.isArray(data.data)) {
        return data.data.map((m: any) => m.id || m.name).filter(Boolean);
      }
      return [];
    } finally {
      clearTimeout(timeout);
    }
  }

  private async probeChatCompletion(config: AdapterConfig): Promise<{ success: boolean }> {
    let targetUrl = config.baseUrl.replace(/\/+$/, '');
    if (!targetUrl.endsWith('/chat/completions')) {
      targetUrl = targetUrl.endsWith('/v1') ? `${targetUrl}/chat/completions` : `${targetUrl}/v1/chat/completions`;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: 'test',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1
        }),
        signal: controller.signal
      });

      // Even a 400 with "model not found" proves network connection and auth were processed
      if (response.status === 200 || response.status === 400 || response.status === 404) {
        return { success: true };
      }
      return { success: false };
    } finally {
      clearTimeout(timeout);
    }
  }

  async execute(
    config: AdapterConfig,
    modelId: string,
    systemPrompt: string,
    userPrompt: string,
    params?: Record<string, any>,
    onChunk?: OnTokenChunk
  ): Promise<AdapterExecutionResult> {
    const startTime = Date.now();
    const urlValidation = validateOutgoingUrl(config.baseUrl);
    if (!urlValidation.isValid) {
      return {
        success: false,
        status: 'FAILED',
        errorCode: 'INVALID_URL',
        errorMessage: urlValidation.error,
        durationMs: 0
      };
    }

    const isAnthropic = config.protocol === 'anthropic';
    let targetUrl = config.baseUrl.replace(/\/+$/, '');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs || 45000);

    try {
      if (isAnthropic) {
        // Anthropic Messages API format
        if (!targetUrl.endsWith('/messages')) {
          targetUrl = `${targetUrl}/v1/messages`;
        }
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        };
        if (config.apiKey) headers['x-api-key'] = config.apiKey;

        const response = await fetch(targetUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: modelId,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
            max_tokens: params?.maxTokens || 2048,
            temperature: params?.temperature ?? 0.7,
            stream: Boolean(onChunk)
          }),
          signal: controller.signal
        });

        const durationMs = Date.now() - startTime;
        if (!response.ok) {
          const errText = await response.text();
          return {
            success: false,
            status: 'FAILED',
            errorCode: `HTTP_${response.status}`,
            errorMessage: errText.slice(0, 300),
            durationMs
          };
        }

        if (onChunk && response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let textOutput = '';
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith(':')) continue;
              if (trimmed === 'data: [DONE]') continue;
              if (trimmed.startsWith('data: ')) {
                try {
                  const json = JSON.parse(trimmed.slice(6));
                  if (json.type === 'content_block_delta' && json.delta?.text) {
                    textOutput += json.delta.text;
                    onChunk(json.delta.text);
                  }
                } catch {
                  // ignore partial JSON chunk
                }
              }
            }
          }

          const estimatedTokens = Math.ceil(textOutput.length / 4);
          return {
            success: true,
            status: 'SUCCEEDED',
            outputResult: textOutput,
            durationMs,
            tokensUsed: {
              promptTokens: Math.ceil(userPrompt.length / 4),
              completionTokens: estimatedTokens,
              totalTokens: Math.ceil((userPrompt.length + textOutput.length) / 4)
            }
          };
        }

        const data = await response.json() as any;
        const textOutput = data.content?.[0]?.text || '';
        if (onChunk && textOutput) {
          onChunk(textOutput);
        }
        return {
          success: true,
          status: 'SUCCEEDED',
          outputResult: textOutput,
          durationMs,
          tokensUsed: {
            promptTokens: data.usage?.input_tokens || 0,
            completionTokens: data.usage?.output_tokens || 0,
            totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)
          }
        };
      } else {
        // OpenAI Chat Completions API format
        if (!targetUrl.endsWith('/chat/completions')) {
          targetUrl = targetUrl.endsWith('/v1') ? `${targetUrl}/chat/completions` : `${targetUrl}/v1/chat/completions`;
        }
        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;

        const response = await fetch(targetUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: modelId,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            temperature: params?.temperature ?? 0.7,
            max_tokens: params?.maxTokens || 2048,
            stream: Boolean(onChunk)
          }),
          signal: controller.signal
        });

        const durationMs = Date.now() - startTime;
        if (!response.ok) {
          const errText = await response.text();
          return {
            success: false,
            status: 'FAILED',
            errorCode: `HTTP_${response.status}`,
            errorMessage: errText.slice(0, 300),
            durationMs
          };
        }

        if (onChunk && response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let textOutput = '';
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith(':')) continue;
              if (trimmed === 'data: [DONE]') continue;
              if (trimmed.startsWith('data: ')) {
                try {
                  const json = JSON.parse(trimmed.slice(6));
                  const delta = json.choices?.[0]?.delta?.content;
                  if (delta) {
                    textOutput += delta;
                    onChunk(delta);
                  }
                } catch {
                  // ignore partial JSON chunk
                }
              }
            }
          }

          const estimatedTokens = Math.ceil(textOutput.length / 4);
          return {
            success: true,
            status: 'SUCCEEDED',
            outputResult: textOutput,
            durationMs,
            tokensUsed: {
              promptTokens: Math.ceil(userPrompt.length / 4),
              completionTokens: estimatedTokens,
              totalTokens: Math.ceil((userPrompt.length + textOutput.length) / 4)
            }
          };
        }

        const data = await response.json() as any;
        const textOutput = data.choices?.[0]?.message?.content || '';
        if (onChunk && textOutput) {
          onChunk(textOutput);
        }
        return {
          success: true,
          status: 'SUCCEEDED',
          outputResult: textOutput,
          durationMs,
          tokensUsed: {
            promptTokens: data.usage?.prompt_tokens || 0,
            completionTokens: data.usage?.completion_tokens || 0,
            totalTokens: data.usage?.total_tokens || 0
          }
        };
      }
    } catch (err: any) {
      return {
        success: false,
        status: 'FAILED',
        errorCode: err.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR',
        errorMessage: err.message,
        durationMs: Date.now() - startTime
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
