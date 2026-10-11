/**
 * Live System Telemetry & Event Logger — AI Agent Command Center
 */

import { v4 as uuidv4 } from 'uuid';
import { SystemLogEntry } from '../../../shared/types.js';
import { realtimeHub } from './realtime.js';

class SystemLogger {
  private buffer: SystemLogEntry[] = [];
  private readonly maxBufferSize = 500;

  constructor() {
    this.log('INFO', 'SYSTEM', 'AI Center Telemetry Logger aktif.');
  }

  log(
    level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG',
    category: 'ORCHESTRATOR' | 'INFERENCE' | 'API' | 'SYSTEM' | 'SECURITY',
    message: string,
    meta?: any
  ): SystemLogEntry {
    const entry: SystemLogEntry = {
      id: `log-${uuidv4().slice(0, 8)}`,
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      meta
    };

    this.buffer.push(entry);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }

    // Broadcast in real-time to SSE connected clients
    try {
      realtimeHub.broadcast('system.log', entry);
    } catch {
      // Ignore broadcast errors
    }

    return entry;
  }

  info(category: SystemLogEntry['category'], message: string, meta?: any) {
    return this.log('INFO', category, message, meta);
  }

  warn(category: SystemLogEntry['category'], message: string, meta?: any) {
    return this.log('WARN', category, message, meta);
  }

  error(category: SystemLogEntry['category'], message: string, meta?: any) {
    return this.log('ERROR', category, message, meta);
  }

  debug(category: SystemLogEntry['category'], message: string, meta?: any) {
    return this.log('DEBUG', category, message, meta);
  }

  getRecentLogs(limit = 100, category?: string, level?: string): SystemLogEntry[] {
    let filtered = this.buffer;
    if (category && category !== 'ALL') {
      filtered = filtered.filter(l => l.category === category);
    }
    if (level && level !== 'ALL') {
      filtered = filtered.filter(l => l.level === level);
    }
    return filtered.slice(-limit);
  }

  clearLogs(): void {
    this.buffer = [];
    this.log('INFO', 'SYSTEM', 'Buffer log konsol dibersihkan.');
  }
}

export const systemLogger = new SystemLogger();
