import React, { useState } from 'react';
import { Activity as ActivityType } from '../../../shared/types.js';
import { Activity, Bot, User, Cpu, Clock, Download, Loader2 } from 'lucide-react';
import { api } from '../services/api.js';

interface ActivityFeedProps {
  activities: ActivityType[];
}

const ACTOR_ICONS: Record<string, React.ReactNode> = {
  AGENT: <Bot className="w-3.5 h-3.5 text-blue-400" />,
  USER: <User className="w-3.5 h-3.5 text-emerald-400" />,
  SYSTEM: <Cpu className="w-3.5 h-3.5 text-purple-400" />
};

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ activities }) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await api.exportAuditTrail('csv');
    } catch (err) {
      console.error('Failed to export audit trail:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-[#111827]/90 border border-slate-800 rounded-xl p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span>Aktivitas & Riwayat Peristiwa</span>
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition disabled:opacity-50"
            title="Download Log Audit Kepatuhan (CSV)"
          >
            {isExporting ? (
              <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
            ) : (
              <Download className="w-3 h-3 text-cyan-400" />
            )}
            <span className="hidden sm:inline">Audit CSV</span>
          </button>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 text-slate-400 border border-slate-800">
            Real-time
          </span>
        </div>
      </div>

      {activities.length === 0 ? (
        <p className="text-xs text-slate-500 italic text-center py-6">Belum ada aktivitas tercatat.</p>
      ) : (
        <div className="space-y-2.5 overflow-y-auto flex-1 pr-1 max-h-[350px]">
          {activities.map((act) => (
            <div
              key={act.id}
              className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/60 text-xs space-y-1 hover:border-slate-700 transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                  {ACTOR_ICONS[act.actorType] || ACTOR_ICONS.SYSTEM}
                  <span className="text-[11px]">{act.actorName}</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  {new Date(act.createdAt).toLocaleTimeString('id-ID')}
                </span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed pl-5">{act.summary}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
