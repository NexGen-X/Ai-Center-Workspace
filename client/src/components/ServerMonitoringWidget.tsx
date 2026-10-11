import React from 'react';
import { ServerMetrics } from '../../../shared/types.js';
import { Cpu, HardDrive, Server, Clock, ShieldCheck, AlertTriangle } from 'lucide-react';

interface ServerMonitoringWidgetProps {
  metrics: ServerMetrics | null;
}

export const ServerMonitoringWidget: React.FC<ServerMonitoringWidgetProps> = ({ metrics }) => {
  if (!metrics) {
    return (
      <div className="bg-[#111827]/90 border border-slate-800 rounded-xl p-4 h-48 animate-pulse" />
    );
  }

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}h ${hours % 24}j`;
    return `${hours} jam`;
  };

  return (
    <div className="bg-[#111827]/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-bold text-white">Pemantauan Server Host</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${metrics.status === 'NORMAL' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          <span className="text-[10px] font-mono uppercase text-slate-400">{metrics.status}</span>
        </div>
      </div>

      {/* Progress Gauges */}
      <div className="space-y-3">
        {/* CPU Usage */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-blue-400" />
              <span>CPU ({metrics.cpuCores} Cores)</span>
            </span>
            <span className="font-mono font-bold text-white">{metrics.cpuUsagePercent}%</span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                metrics.cpuUsagePercent > 80 ? 'bg-red-500' : metrics.cpuUsagePercent > 50 ? 'bg-amber-400' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(100, metrics.cpuUsagePercent)}%` }}
            />
          </div>
        </div>

        {/* RAM Usage */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-purple-400" />
              <span>Memori RAM ({formatBytes(metrics.memoryUsedBytes)} / {formatBytes(metrics.memoryTotalBytes)})</span>
            </span>
            <span className="font-mono font-bold text-white">{metrics.memoryUsagePercent}%</span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                metrics.memoryUsagePercent > 80 ? 'bg-red-500' : 'bg-purple-500'
              }`}
              style={{ width: `${Math.min(100, metrics.memoryUsagePercent)}%` }}
            />
          </div>
        </div>

        {/* Disk Space */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
              <span>Penyimpanan Disk ({metrics.diskUsagePercent}%)</span>
            </span>
            <span className="font-mono text-slate-300 text-[11px]">{formatBytes(metrics.diskUsedBytes)} terpakai</span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full rounded-full bg-cyan-500 transition-all duration-500"
              style={{ width: `${Math.min(100, metrics.diskUsagePercent)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Meta stats */}
      <div className="pt-3 mt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
        <div>Load: {metrics.loadAvg.join(', ')}</div>
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3 text-slate-500" />
          <span>Uptime: {formatUptime(metrics.uptimeSeconds)}</span>
        </div>
      </div>
    </div>
  );
};
