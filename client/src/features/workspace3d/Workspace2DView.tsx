import React from 'react';
import { AIAgent } from '../../../../shared/types.js';
import { Monitor, Bot, ArrowRight, Box } from 'lucide-react';

interface Workspace2DViewProps {
  agents: AIAgent[];
  onSelectAgent: (agent: AIAgent) => void;
  onSwitchTo3D: () => void;
}

const ROLE_BORDER_COLORS: Record<string, string> = {
  Orchestrator: 'border-blue-500/40 hover:border-blue-500 shadow-blue-950/20',
  Planner: 'border-purple-500/40 hover:border-purple-500 shadow-purple-950/20',
  Executor: 'border-emerald-500/40 hover:border-emerald-500 shadow-emerald-950/20',
  'QA / Reviewer': 'border-amber-500/40 hover:border-amber-500 shadow-amber-950/20',
  DevOps: 'border-pink-500/40 hover:border-pink-500 shadow-pink-950/20',
  'Domain Specialist': 'border-cyan-500/40 hover:border-cyan-500 shadow-cyan-950/20'
};

export const Workspace2DView: React.FC<Workspace2DViewProps> = ({ agents, onSelectAgent, onSwitchTo3D }) => {
  return (
    <div className="w-full max-w-full overflow-hidden bg-neutral-900/90 dark:bg-[#0c0c0e]/95 border border-zinc-800/80 rounded-2xl p-3.5 sm:p-5 lg:p-6 shadow-2xl backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-zinc-800/80">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Monitor className="w-4 h-4 text-cyan-400 shrink-0" />
            <h2 className="text-sm font-bold text-white tracking-tight">
              Ruang Kerja Stasiun AI (Tampilan Adaptif 2D)
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold shrink-0">
              Mobile Touch Mode
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            Tampilan workstation 2D hemat baterai dan responsif sentuhan, otomatis diaktifkan untuk perangkat mobile.
          </p>
        </div>

        <button
          onClick={onSwitchTo3D}
          className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-blue-600/20 flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
        >
          <Box className="w-3.5 h-3.5" />
          <span>Buka 3D Cockpit</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 w-full min-w-0">
        {agents.map((agent) => (
          <div
            key={agent.id}
            onClick={() => onSelectAgent(agent)}
            className={`w-full min-w-0 p-3.5 sm:p-4 rounded-xl bg-neutral-950/90 dark:bg-[#09090b] border ${ROLE_BORDER_COLORS[agent.role] || 'border-zinc-800'} cursor-pointer transition hover:scale-[1.01] active:scale-[0.99] group shadow-sm flex flex-col justify-between`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 shrink-0">
                  Stasiun #{agent.id.slice(-4)}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase">{agent.status}</span>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    agent.status === 'READY' ? 'bg-emerald-400' : agent.status === 'BUSY' ? 'bg-amber-400 animate-pulse' : 'bg-red-400'
                  }`} />
                </div>
              </div>

              <div className="flex items-center gap-2.5 mb-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-blue-400 group-hover:scale-105 transition shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-xs sm:text-sm text-white truncate group-hover:text-blue-400 transition">
                    {agent.name}
                  </h4>
                  <p className="text-[10px] text-zinc-400 truncate">{agent.role}</p>
                </div>
              </div>

              <div className="text-[11px] font-mono text-zinc-300 bg-neutral-900/90 dark:bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800/80 truncate mb-3 w-full min-w-0" title={`Model: ${agent.modelId}`}>
                <span className="text-zinc-500 text-[10px] block truncate">Model ID</span>
                <span className="font-semibold text-zinc-200 truncate block">{agent.modelId}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectAgent(agent);
              }}
              className="w-full mt-auto py-2 px-3 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-blue-400 hover:text-blue-300 font-semibold text-xs border border-zinc-800 hover:border-blue-500/40 flex items-center justify-between transition cursor-pointer group-hover:bg-blue-600/10"
            >
              <span>Buka Instruksi</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
