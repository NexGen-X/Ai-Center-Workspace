/**
 * Connection Router — AI Agent Command Center
 * Routes connection requests to the appropriate specialized adapter.
 */

import { BaseConnectionAdapter } from './base.js';
import { CustomApiAdapter } from './customApi.js';
import { PresetProviderAdapter } from './preset.js';
import { HermesRuntimeAdapter } from './hermes.js';
import { ProviderType } from '../../../shared/types.js';

export class ConnectionRouter {
  private static customAdapter = new CustomApiAdapter();
  private static hermesAdapter = new HermesRuntimeAdapter();
  private static presetAdapters: Map<ProviderType, PresetProviderAdapter> = new Map();

  static getAdapter(providerType: ProviderType): BaseConnectionAdapter {
    switch (providerType) {
      case 'custom_api':
        return this.customAdapter;
      case 'hermes':
        return this.hermesAdapter;
      case 'routex_local':
      case 'openai':
      case 'anthropic':
      case 'gemini':
      case 'groq':
      case 'ollama':
        if (!this.presetAdapters.has(providerType)) {
          this.presetAdapters.set(providerType, new PresetProviderAdapter(providerType));
        }
        return this.presetAdapters.get(providerType)!;
      default:
        return this.customAdapter;
    }
  }
}
