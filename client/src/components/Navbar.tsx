import React, { useState, useEffect } from 'react';
import { Bot, Activity, Plus, ShieldCheck, Clock, Radio } from 'lucide-react';

interface NavbarProps {
  onOpenAddAgent: () => void;
  onOpenCreateTask: () => void;
  isRealtimeConnected: boolean;
  systemStatus: 'OPERATIONAL' | 'DEGRADED' | 'MAINTENANCE';
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenAddAgent,
  onOpenCreateTask,
  isRealtimeConnected,
  systemStatus
}) => {
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(now.toLocaleTimeString('id-ID', { hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0B0F17]/90 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand & Workspace Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 p-0.5 shadow-lg shadow-blue-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-[#0B0F17] rounded-[10px] flex items-center justify-center">
              <Bot className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                AI COMMAND CENTER
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full">
                Antigravity v2.0
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <span>Center AI 3D Workspace via Web UI</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-300">Headquarters</span>
            </p>
          </div>
        </div>

        {/* Center / Right: Status badges & action buttons */}
        <div className="flex items-center gap-3">
          {/* Live Clock */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs font-mono text-slate-300">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{timeStr || '00:00:00'}</span>
          </div>

          {/* Real-time SSE indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
            <Radio className={`w-3.5 h-3.5 ${isRealtimeConnected ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
            <span className="text-slate-400 hidden sm:inline">SSE:</span>
            <span className={isRealtimeConnected ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
              {isRealtimeConnected ? 'Live' : 'Polling'}
            </span>
          </div>

          {/* System Status */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-300 font-medium">{systemStatus}</span>
          </div>

          {/* Quick Action: Buat Tugas */}
          <button
            onClick={onOpenCreateTask}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tugas Baru</span>
          </button>

          {/* Main Core Action: Tambah Anggota AI Team */}
          <button
            onClick={onOpenAddAgent}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold shadow-md shadow-blue-600/25 transition active:scale-95"
          >
            <Bot className="w-4 h-4" />
            <span>+ Tambah Anggota</span>
          </button>
        </div>
      </div>
    </header>
  );
};
