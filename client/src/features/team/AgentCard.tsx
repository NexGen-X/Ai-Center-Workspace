import React, { useState } from 'react';
import { Bot, Play, Sparkles, AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { AIAgent, AgentStatus } from '../../../../shared/types.js';

interface AgentCardProps {
  agent: AIAgent;
  onQuickRun: (agent: AIAgent) => void;
  onSelect: (agent: AIAgent) => void;
}

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Orchestrator: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  Planner: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  Executor: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  'QA / Reviewer': { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  DevOps: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/30' },
  'Domain Specialist': { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' }
};

const STATUS_CONFIG: Record<AgentStatus, { label: string; dot: string; text: string }> = {
  READY: { label: 'Ready', dot: 'bg-emerald-400', text: 'text-emerald-400' },
  IDLE: { label: 'Idle', dot: 'bg-blue-400', text: 'text-blue-400' },
  BUSY: { label: 'Busy / Executing', dot: 'bg-amber-400 animate-ping', text: 'text-amber-400' },
  UNAVAILABLE: { label: 'Runtime Offline', dot: 'bg-red-400', text: 'text-red-400' },
  DISABLED: { label: 'Disabled', dot: 'bg-slate-500', text: 'text-slate-500' }
};

export const AgentCard: React.FC<AgentCardProps> = ({ agent, onQuickRun, onSelect }) => {
  const [showPrompt, setShowPrompt] = useState(false);
  const roleStyle = ROLE_COLORS[agent.role] || ROLE_COLORS.Orchestrator;
  const statusStyle = STATUS_CONFIG[agent.status] || STATUS_CONFIG.READY;

  return (
    <div className={`bg-[#111827]/90 border ${agent.enabled ? 'border-slate-800' : 'border-slate-800/40 opacity-75'} rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 hover:shadow-xl hover:shadow-blue-950/20 transition group`}>
      <div>
        {/* Header: Status, Role & Provider */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
            <span className={`text-[11px] font-bold ${statusStyle.text}`}>{statusStyle.label}</span>
          </div>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}>
            {agent.role}
          </span>
        </div>

        {/* Agent Name & Model Info */}
        <div className="flex items-start gap-3 mb-2.5">
          <div
            className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-slate-300 group-hover:text-blue-400 transition cursor-pointer"
            onClick={() => onSelect(agent)}
          >
            <Bot className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-white truncate cursor-pointer hover:text-blue-400 transition" onClick={() => onSelect(agent)}>
              {agent.name}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 truncate max-w-[140px]">
                {agent.modelId}
              </span>
              <span className="text-[10px] text-slate-500">
                via {agent.providerName || agent.providerType || 'Custom'}
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-slate-400 line-clamp-2 mb-3 leading-relaxed">
          {agent.description || 'Tidak ada deskripsi spesifik.'}
        </p>

        {/* Expandable System Prompt snippet */}
        <div className="mb-3">
          <button
            onClick={() => setShowPrompt(!showPrompt)}
            className="text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition"
          >
            <span>Instruksi Sistem</span>
            {showPrompt ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showPrompt && (
            <div className="mt-1.5 p-2 rounded bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-300 max-h-24 overflow-y-auto leading-relaxed">
              {agent.systemPrompt}
            </div>
          )}
        </div>
      </div>

      {/* Footer: Capabilities, Tasks Count & Quick Action */}
      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center gap-1">
            {agent.capabilities?.slice(0, 2).map((cap, i) => (
              <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800/70 text-slate-400 font-mono">
                {cap.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
          {agent.totalTasks !== undefined && agent.totalTasks > 0 && (
            <span className="text-[9px] text-slate-400 font-mono px-1 py-0.5 rounded bg-slate-900 border border-slate-800">
              {agent.completedTasks || 0}/{agent.totalTasks}
            </span>
          )}
        </div>

        <button
          onClick={() => onQuickRun(agent)}
          disabled={agent.status === 'UNAVAILABLE' || agent.status === 'BUSY'}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 border border-blue-500/30 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <Play className="w-3 h-3" />
          <span>Jalankan</span>
        </button>
      </div>
    </div>
  );
};
