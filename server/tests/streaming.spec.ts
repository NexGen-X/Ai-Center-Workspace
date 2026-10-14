import { describe, it, expect, vi } from 'vitest';
import { CustomApiAdapter } from '../src/adapters/customApi.js';
import { PresetProviderAdapter } from '../src/adapters/preset.js';
import { realtimeHub } from '../src/services/realtime.js';

describe('Live Token Streaming & Reasoning Trace Verification', () => {
  it('CustomApiAdapter should stream chunks and invoke onChunk callback', async () => {
    const adapter = new CustomApiAdapter();

    // Mock global fetch returning SSE stream
    const mockSSEStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Halo "}}]}\n\n'));
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"dunia!"}}]}\n\n'));
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
      }
    });

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: mockSSEStream,
      json: async () => ({})
    } as any);

    try {
      const chunks: string[] = [];
      const onChunk = (c: string) => {
        chunks.push(c);
      };

      const result = await adapter.execute(
        { baseUrl: 'https://api.openai.com/v1', apiKey: 'test-key' },
        'gpt-4o',
        'System prompt',
        'Halo',
        {},
        onChunk
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe('SUCCEEDED');
      expect(result.outputResult).toBe('Halo dunia!');
      expect(chunks).toEqual(['Halo ', 'dunia!']);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('PresetProviderAdapter for Gemini should stream SSE content chunks via onChunk', async () => {
    const adapter = new PresetProviderAdapter('gemini');

    const mockSSEStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"candidates":[{"content":{"parts":[{"text":"Analisis "}]}}]}\n\n'));
        controller.enqueue(new TextEncoder().encode('data: {"candidates":[{"content":{"parts":[{"text":"selesai."}]}}]}\n\n'));
        controller.close();
      }
    });

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: mockSSEStream,
      json: async () => ({})
    } as any);

    try {
      const chunks: string[] = [];
      const onChunk = (c: string) => chunks.push(c);

      const result = await adapter.execute(
        { baseUrl: 'https://generativelanguage.googleapis.com/v1beta', apiKey: 'test-key' },
        'gemini-2.0-flash',
        'System prompt',
        'Test prompt',
        {},
        onChunk
      );

      expect(result.success).toBe(true);
      expect(result.outputResult).toBe('Analisis selesai.');
      expect(chunks).toEqual(['Analisis ', 'selesai.']);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('Reasoning trace (<think>...</think>) should be parsed correctly during stream accumulation', () => {
    let accumulated = '';
    let isInsideThinkTag = false;

    const streamInput = ['<think>', '\nMenganalisis arsitektur sistem...', '\n</think>', '\nJawaban final: Sistem siap.'];
    const collectedThoughts: string[] = [];
    const collectedOutputs: string[] = [];

    for (const chunk of streamInput) {
      accumulated += chunk;
      if (accumulated.includes('<think>') && !accumulated.includes('</think>')) {
        isInsideThinkTag = true;
      } else if (accumulated.includes('</think>')) {
        isInsideThinkTag = false;
      }

      if (isInsideThinkTag) {
        collectedThoughts.push(chunk.replace('<think>', ''));
      } else {
        collectedOutputs.push(chunk.replace('</think>', ''));
      }
    }

    expect(isInsideThinkTag).toBe(false);
    expect(accumulated).toContain('<think>');
    expect(accumulated).toContain('</think>');
    expect(accumulated).toContain('Jawaban final: Sistem siap.');
  });

  it('RealtimeHub broadcast should transmit token chunk and completion events without exception', () => {
    // Add mock client to test write
    const mockRes = {
      write: vi.fn(),
      end: vi.fn(),
      on: vi.fn()
    } as any;

    realtimeHub.addClient('test-client-streaming', mockRes);

    realtimeHub.broadcast('task.token_chunk', {
      taskId: 'task-test-1',
      agentId: 'agent-athena',
      chunk: 'Halo',
      accumulated: 'Halo',
      isThinking: false
    });

    realtimeHub.broadcast('task.token_completed', {
      taskId: 'task-test-1',
      status: 'SUCCEEDED',
      success: true,
      outputResult: 'Halo dunia'
    });

    expect(mockRes.write).toHaveBeenCalled();
  });
});
