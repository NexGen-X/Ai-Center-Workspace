/**
 * Base Connection Adapter Interface — AI Agent Command Center
 */

import { ConnectionStatus, RunStatus } from '../../../shared/types.js';

export interface AdapterTestResult {
  success: boolean;
  status: ConnectionStatus;
  message: string;
  discoveredModels?: string[];
  latencyMs?: number;
}

export interface AdapterExecutionResult {
  success: boolean;
  status: RunStatus;
  outputResult?: string;
  errorCode?: string;
  errorMessage?: string;
  durationMs: number;
  tokensUsed?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AdapterConfig {
  baseUrl: string;
  apiKey?: string;
  protocol?: string;
  timeoutMs?: number;
}

export interface BaseConnectionAdapter {
  testConnection(config: AdapterConfig): Promise<AdapterTestResult>;
  discoverModels(config: AdapterConfig): Promise<string[]>;
  execute(config: AdapterConfig, modelId: string, systemPrompt: string, userPrompt: string, params?: Record<string, any>): Promise<AdapterExecutionResult>;
}
