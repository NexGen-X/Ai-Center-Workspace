/**
 * Shared Constants & Presets — AI Agent Command Center
 */

import { ProviderType, ProtocolType, AgentRole } from './types.js';

export interface ProviderPresetDefinition {
  type: ProviderType;
  label: string;
  defaultBaseUrl: string;
  protocol: ProtocolType;
  requiresApiKey: boolean;
  apiKeyPlaceholder: string;
  suggestedModels: string[];
  description: string;
  isAvailableOnSystem?: boolean;
}

export const PROVIDER_PRESETS: ProviderPresetDefinition[] = [
  {
    type: 'routex_local',
    label: 'Route-X Local Gateway',
    defaultBaseUrl: 'http://localhost:8080/v1',
    protocol: 'openai',
    requiresApiKey: true,
    apiKeyPlaceholder: 'Masukkan Route-X Gateway Token / Key',
    suggestedModels: [
      'coding-fast',
      'claude-3-7-sonnet',
      'combo:qwen2.5-coder->claude-3-7-sonnet'
    ],
    description: 'AI Gateway performa tinggi lokal yang berjalan pada port 8080.',
    isAvailableOnSystem: true
  },
  {
    type: 'openai',
    label: 'OpenAI Direct API',
    defaultBaseUrl: 'https://api.openai.com/v1',
    protocol: 'openai',
    requiresApiKey: true,
    apiKeyPlaceholder: 'sk-...',
    suggestedModels: ['gpt-4o', 'gpt-4o-mini', 'o1-preview', 'o3-mini'],
    description: 'Koneksi langsung ke OpenAI REST API.'
  },
  {
    type: 'anthropic',
    label: 'Anthropic Claude API',
    defaultBaseUrl: 'https://api.anthropic.com',
    protocol: 'anthropic',
    requiresApiKey: true,
    apiKeyPlaceholder: 'sk-ant-...',
    suggestedModels: ['claude-3-7-sonnet-20250219', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
    description: 'Koneksi langsung ke Anthropic Messages API.'
  },
  {
    type: 'gemini',
    label: 'Google Gemini API',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    protocol: 'gemini',
    requiresApiKey: true,
    apiKeyPlaceholder: 'AIzaSy...',
    suggestedModels: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    description: 'Google Gemini Developer API.'
  },
  {
    type: 'groq',
    label: 'Groq Cloud (Ultra-Fast LPU)',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    protocol: 'openai',
    requiresApiKey: true,
    apiKeyPlaceholder: 'gsk_...',
    suggestedModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    description: 'Inference ultra-cepat bertenaga Groq LPU.'
  },
  {
    type: 'ollama',
    label: 'Ollama (Local Self-Hosted)',
    defaultBaseUrl: 'http://localhost:11434/v1',
    protocol: 'ollama',
    requiresApiKey: false,
    apiKeyPlaceholder: 'Tidak memerlukan API Key (opsional)',
    suggestedModels: ['llama3.2', 'qwen2.5-coder', 'deepseek-r1', 'mistral'],
    description: 'Model lokal gratis yang dihosting dengan Ollama.'
  },
  {
    type: 'hermes',
    label: 'Hermes Agent Runtime',
    defaultBaseUrl: 'hermes://local-runtime',
    protocol: 'hermes_runtime',
    requiresApiKey: false,
    apiKeyPlaceholder: 'Menggunakan konfigurasi runtime lokal',
    suggestedModels: ['nous-hermes-3-llama-3.1-8b', 'hermes-3-70b'],
    description: 'External autonomous agent execution runtime (Nous Research).',
    isAvailableOnSystem: false // Diidentifikasi BLOCKED pada audit
  }
];

export const AGENT_ROLES: { role: AgentRole; description: string; defaultColor: string }[] = [
  {
    role: 'Orchestrator',
    description: 'Mengatur alur kerja, mendekomposisi task, dan memantau status anggota tim.',
    defaultColor: '#3B82F6' // Blue
  },
  {
    role: 'Planner',
    description: 'Menganalisis prasyarat, menyusun rencana kerja, dan mendefinisikan acceptance criteria.',
    defaultColor: '#8B5CF6' // Purple
  },
  {
    role: 'Executor',
    description: 'Mengeksekusi langkah-langkah implementasi teknis dan pemanggilan tools.',
    defaultColor: '#10B981' // Emerald
  },
  {
    role: 'QA / Reviewer',
    description: 'Mengaudit hasil kerja, memverifikasi bukti empiris, dan memastikan kualitas.',
    defaultColor: '#F59E0B' // Amber
  },
  {
    role: 'DevOps',
    description: 'Memantau performa server, kehandalan pipeline, dan stabilitas operasional.',
    defaultColor: '#EC4899' // Pink
  },
  {
    role: 'Domain Specialist',
    description: 'Agen ahli domain spesifik seperti UI/UX, database, atau keamanan.',
    defaultColor: '#06B6D4' // Cyan
  }
];
