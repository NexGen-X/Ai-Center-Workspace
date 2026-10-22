import React from 'react';
import { Sparkles, Bot, Layers, ArrowUpRight, Zap, CheckCircle2 } from 'lucide-react';

interface WorkspaceUsageWidgetProps {
  runningTasksCount?: number;
  completedTasksCount?: number;
  totalAgentsCount?: number;
  onlineAgentsCount?: number;
  activeProjectsCount?: number;
  onOpenPricing?: () => void;
  onOpenTeam?: () => void;
}

export const WorkspaceUsageWidget: React.FC<WorkspaceUsageWidgetProps> = ({
  runningTasksCount = 0,
  completedTasksCount = 0,
  totalAgentsCount = 8,
  onlineAgentsCount = 8,
  activeProjectsCount = 3,
  onOpenPricing,
  onOpenTeam
}) => {
  const taskQuotaLimit = 500;
  const totalTasksThisMonth = runningTasksCount + completedTasksCount;
  const taskPercent = Math.min(100, Math.round((totalTasksThisMonth / taskQuotaLimit) * 100));

  const agentLimit = 10;
  const agentPercent = Math.min(100, Math.round((onlineAgentsCount / agentLimit) * 100));

  return (
    <div className="bg-[#111827]/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-bold text-white">Kuota &amp; Kapasitas Workspace</h2>
        </div>
        <div className="flex items-center gap-2">
          {onOpenPricing && (
            <button
              type="button"
              onClick={onOpenPricing}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 text-cyan-300 border border-cyan-500/40 text-[11px] font-bold transition shadow-sm"
              title="Tingkatkan kuota komputasi dan agen AI"
            >
              <span>Upgrade Paket</span>
              <ArrowUpRight className="w-3 h-3 text-cyan-400" />
            </button>
          )}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-mono uppercase text-emerald-400 font-semibold">Pro B2B</span>
          </div>
        </div>
      </div>

      {/* Progress Gauges */}
      <div className="space-y-3">
        {/* Task Quota Usage */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span>Eksekusi Tugas AI ({totalTasksThisMonth} / {taskQuotaLimit})</span>
            </span>
            <span className="font-mono font-bold text-white">{taskPercent}%</span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
            <div
              className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-cyan-500 to-blue-500"
              style={{ width: `${Math.max(4, taskPercent)}%` }}
            />
          </div>
        </div>

        {/* AI Agents Workforce Capacity */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-purple-400" />
              <span>Kapasitas Agen Aktif ({onlineAgentsCount} / {agentLimit})</span>
            </span>
            <span className="font-mono font-bold text-white">{agentPercent}%</span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
            <div
              className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-purple-500 to-indigo-500"
              style={{ width: `${Math.max(6, agentPercent)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Footer Metrics */}
      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-[11px]">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-400">Proyek Aktif:</span>
          <span className="font-mono font-bold text-white">{activeProjectsCount}</span>
        </div>
        <div className="flex items-center justify-end gap-1.5 text-emerald-400 font-mono font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Agen Siap</span>
        </div>
      </div>
    </div>
  );
};
