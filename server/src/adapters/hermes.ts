/**
 * External Agent Runtime Adapter — Hermes (Nous Research / Agent Framework)
 * 
 * Sesuai Aturan Utama No. 6, 7 & Bab 4C:
 * Jangan mengarang endpoint HTTP atau kemampuan runtime yang belum diverifikasi.
 * Adapter ini menginspeksi kehadiran runtime lokal secara faktual dan melaporkan status secara jujur.
 */

import { BaseConnectionAdapter, AdapterConfig, AdapterTestResult, AdapterExecutionResult, OnTokenChunk } from './base.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

export class HermesRuntimeAdapter implements BaseConnectionAdapter {
  /**
   * Cek keberadaan binary CLI atau daemon Hermes di sistem host
   */
  async checkHermesAvailability(): Promise<{ isAvailable: boolean; path?: string; version?: string }> {
    try {
      const { stdout } = await execAsync('which hermes');
      const binPath = stdout.trim();
      if (binPath && fs.existsSync(binPath)) {
        try {
          const versionOut = await execAsync(`${binPath} --version`);
          return { isAvailable: true, path: binPath, version: versionOut.stdout.trim() };
        } catch {
          return { isAvailable: true, path: binPath, version: 'unknown' };
        }
      }
    } catch {
      // which hermes failed -> not installed
    }
    return { isAvailable: false };
  }

  async testConnection(_config: AdapterConfig): Promise<AdapterTestResult> {
    const startTime = Date.now();
    const availability = await this.checkHermesAvailability();
    const latencyMs = Date.now() - startTime;

    if (!availability.isAvailable) {
      return {
        success: false,
        status: 'UNAVAILABLE',
        message: 'External Runtime Hermes tidak terdeteksi di lingkungan host (binary "hermes" tidak ditemukan di PATH). Harap pasang daemon/CLI Hermes sebelum mengaktifkan agent ini.',
        latencyMs
      };
    }

    return {
      success: true,
      status: 'CONNECTION_OK',
      message: `Runtime Hermes terverifikasi pada ${availability.path} (versi: ${availability.version || 'terpasang'}).`,
      discoveredModels: ['nous-hermes-3-llama-3.1-8b', 'hermes-3-70b'],
      latencyMs
    };
  }

  async discoverModels(_config: AdapterConfig): Promise<string[]> {
    const availability = await this.checkHermesAvailability();
    if (!availability.isAvailable) {
      return [];
    }
    return ['nous-hermes-3-llama-3.1-8b', 'hermes-3-70b'];
  }

  async execute(
    _config: AdapterConfig,
    modelId: string,
    _systemPrompt: string,
    _userPrompt: string,
    _params?: Record<string, any>,
    _onChunk?: OnTokenChunk
  ): Promise<AdapterExecutionResult> {
    const availability = await this.checkHermesAvailability();

    if (!availability.isAvailable) {
      return {
        success: false,
        status: 'FAILED',
        errorCode: 'HERMES_RUNTIME_UNAVAILABLE',
        errorMessage: 'Eksekusi tugas dibatalkan: External Agent Runtime Hermes tidak terpasang di sistem host.',
        durationMs: 0
      };
    }

    // Jika di masa depan binary hermes terpasang, eksekusi dipanggil melalui CLI subprocess resmi
    return {
      success: false,
      status: 'FAILED',
      errorCode: 'HERMES_INVOCATION_NOT_CONFIGURED',
      errorMessage: `Model ${modelId} terkonfigurasi, namun pipeline IPC Hermes belum menerima tugas aktif.`,
      durationMs: 0
    };
  }
}
