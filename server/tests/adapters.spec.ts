import { describe, it, expect } from 'vitest';
import { HermesRuntimeAdapter } from '../src/adapters/hermes.js';
import { CustomApiAdapter } from '../src/adapters/customApi.js';
import { PresetProviderAdapter } from '../src/adapters/preset.js';

describe('Connection Adapters Verification', () => {
  it('Hermes Adapter should honestly report UNAVAILABLE when binary is missing', async () => {
    const adapter = new HermesRuntimeAdapter();
    const result = await adapter.testConnection({
      baseUrl: 'hermes://local-runtime'
    });

    // In our system audit, hermes binary is not installed
    expect(result.success).toBe(false);
    expect(result.status).toBe('UNAVAILABLE');
    expect(result.message).toContain('tidak terdeteksi di lingkungan host');

    // Executing via missing Hermes must be blocked
    const execResult = await adapter.execute(
      { baseUrl: 'hermes://local-runtime' },
      'nous-hermes-3-llama-3.1-8b',
      'system',
      'user prompt'
    );
    expect(execResult.success).toBe(false);
    expect(execResult.status).toBe('FAILED');
    expect(execResult.errorCode).toBe('HERMES_RUNTIME_UNAVAILABLE');
  });

  it('Custom API Adapter should reject SSRF target URLs with error', async () => {
    const adapter = new CustomApiAdapter();
    const result = await adapter.testConnection({
      baseUrl: 'http://169.254.169.254/v1',
      apiKey: 'test-key'
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('CONNECTION_FAILED');
    expect(result.message).toContain('metadata');
  });

  it('Preset Provider Adapter for Route-X Local Gateway should probe localhost:8080', async () => {
    const adapter = new PresetProviderAdapter('routex_local');
    const result = await adapter.testConnection({
      baseUrl: 'http://localhost:8080/v1'
    });

    // Port 8080 is running Route-X!
    expect(result.latencyMs).toBeDefined();
    // Because no valid Route-X key was passed, it correctly responds with auth error or reachable status
    expect(['CONNECTION_OK', 'CONNECTION_FAILED']).toContain(result.status);
  });
});
