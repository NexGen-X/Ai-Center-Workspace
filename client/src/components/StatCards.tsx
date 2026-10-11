import React from 'react';
import { PlayCircle, CheckCircle2, Users, Layers, Cpu, HardDrive } from 'lucide-react';
import { DashboardSummary } from '../../../shared/types.js';

interface StatCardsProps {
  summary: DashboardSummary | null;
  loading: boolean;
  onOpenProjects?: () => void;
  onOpenTasks?: () => void;
}

export const StatCards: React.FC<StatCardsProps> = ({
  summary,
  loading,
  onOpenProjects,
  onOpenTasks
}) => {
  if (loading || !summary) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-24 bg-slate-900/50 border border-slate-800/80 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const { runningTasksCount, completedTasksCount, onlineAgentsCount, totalAgentsCount, activeProjectsCount, serverMetrics } = summary;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
      {/* 1. Running Tasks */}
      <div
        onClick={onOpenTasks}
        className="bg-[#111827]/80 border border-blue-500/20 rounded-xl p-3.5 relative overflow-hidden group hover:border-blue-500/50 cursor-pointer transition"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-400 group-hover:text-blue-300 transition">Tugas Berjalan</span>
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
            <PlayCircle className="w-4 h-4 animate-spin text-blue-400" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-white font-mono">{runningTasksCount}</span>
          <span className="text-[11px] text-blue-400 font-medium">aktif sekarang</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-transparent" />
      </div>

      {/* 2. Completed Tasks */}
      <div
        onClick={onOpenTasks}
        className="bg-[#111827]/80 border border-emerald-500/20 rounded-xl p-3.5 relative overflow-hidden group hover:border-emerald-500/50 cursor-pointer transition"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-400 group-hover:text-emerald-300 transition">Tugas Selesai</span>
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-white font-mono">{completedTasksCount}</span>
          <span className="text-[11px] text-emerald-400 font-medium">terverifikasi QA</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-transparent" />
      </div>

      {/* 3. AI Team Online */}
      <div className="bg-[#111827]/80 border border-purple-500/20 rounded-xl p-3.5 relative overflow-hidden group hover:border-purple-500/40 transition">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-400">AI Team Online</span>
          <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-black text-white font-mono">{onlineAgentsCount}</span>
          <span className="text-xs text-slate-500 font-mono">/ {totalAgentsCount}</span>
          <span className="text-[11px] text-purple-400 font-medium ml-1">agent aktif</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-transparent" />
      </div>

      {/* 4. Active Projects */}
      <div
        onClick={onOpenProjects}
        className="bg-[#111827]/80 border border-amber-500/20 rounded-xl p-3.5 relative overflow-hidden group hover:border-amber-500/50 cursor-pointer transition"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-400 group-hover:text-amber-300 transition">Proyek Aktif</span>
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
            <Layers className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-white font-mono">{activeProjectsCount}</span>
          <span className="text-[11px] text-amber-400 font-medium">pipeline</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500 to-transparent" />
      </div>

      {/* 5. Server Health Quick Badge */}
      <div className="col-span-2 md:col-span-4 lg:col-span-1 bg-[#111827]/80 border border-cyan-500/20 rounded-xl p-3.5 relative overflow-hidden group hover:border-cyan-500/40 transition">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-400">Beban Server Host</span>
          <div className="w-7 h-7 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
            <Cpu className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-2xl font-black text-white font-mono">{serverMetrics.cpuUsagePercent}%</span>
            <span className="text-[10px] text-slate-400 block font-mono">RAM: {serverMetrics.memoryUsagePercent}%</span>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase ${
            serverMetrics.status === 'NORMAL' 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
          }`}>
            {serverMetrics.status}
          </span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-500 to-transparent" />
      </div>
    </div>
  );
};
