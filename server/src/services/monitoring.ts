/**
 * Host Server Monitoring Collector — AI Agent Command Center
 * Safely gathers system metrics (CPU, RAM, Disk, Load, Uptime) via native OS APIs.
 */

import os from 'os';
import fs from 'fs';
import { ServerMetrics } from '../../../shared/types.js';

let lastCpuInfo: { idle: number; total: number } | null = null;

function getCpuSnapshot(): { idle: number; total: number } {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      total += (cpu.times as any)[type];
    }
    idle += cpu.times.idle;
  }
  return { idle, total };
}

export function collectServerMetrics(): ServerMetrics {
  // 1. Calculate CPU usage
  const currentSnapshot = getCpuSnapshot();
  let cpuUsagePercent = 0;
  if (lastCpuInfo) {
    const idleDiff = currentSnapshot.idle - lastCpuInfo.idle;
    const totalDiff = currentSnapshot.total - lastCpuInfo.total;
    if (totalDiff > 0) {
      cpuUsagePercent = Math.max(0, Math.min(100, Math.round(((totalDiff - idleDiff) / totalDiff) * 100)));
    }
  } else {
    // First sample estimate from loadavg
    const load1m = os.loadavg()[0];
    const cores = os.cpus().length || 1;
    cpuUsagePercent = Math.min(100, Math.round((load1m / cores) * 100));
  }
  lastCpuInfo = currentSnapshot;

  // 2. Memory metrics
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memoryUsagePercent = Math.round((usedMem / totalMem) * 100);

  // 3. Disk space (using fs.statfsSync if available in Node 19+)
  let diskTotalBytes = 100 * 1024 * 1024 * 1024; // default 100 GB
  let diskUsedBytes = 20 * 1024 * 1024 * 1024;
  let diskUsagePercent = 20;

  try {
    if (typeof fs.statfsSync === 'function') {
      const stats = fs.statfsSync('/');
      const total = stats.bsize * stats.blocks;
      const free = stats.bsize * stats.bfree;
      const used = total - free;
      if (total > 0) {
        diskTotalBytes = total;
        diskUsedBytes = used;
        diskUsagePercent = Math.round((used / total) * 100);
      }
    }
  } catch {
    // fallback to estimate
  }

  // 4. Status evaluation
  let status: 'NORMAL' | 'WARNING' | 'CRITICAL' = 'NORMAL';
  if (cpuUsagePercent > 90 || memoryUsagePercent > 90 || diskUsagePercent > 90) {
    status = 'CRITICAL';
  } else if (cpuUsagePercent > 75 || memoryUsagePercent > 80 || diskUsagePercent > 80) {
    status = 'WARNING';
  }

  return {
    cpuUsagePercent,
    cpuCores: os.cpus().length,
    memoryTotalBytes: totalMem,
    memoryUsedBytes: usedMem,
    memoryFreeBytes: freeMem,
    memoryUsagePercent,
    diskTotalBytes,
    diskUsedBytes,
    diskUsagePercent,
    loadAvg: [
      parseFloat(os.loadavg()[0].toFixed(2)),
      parseFloat(os.loadavg()[1].toFixed(2)),
      parseFloat(os.loadavg()[2].toFixed(2))
    ],
    uptimeSeconds: Math.floor(os.uptime()),
    observedAt: new Date().toISOString(),
    status
  };
}
