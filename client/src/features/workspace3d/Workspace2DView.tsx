import React from 'react';
import { AIAgent } from '../../../../shared/types.js';
import { Monitor, Bot, ArrowRight, Eye, Shield, Cpu, Sparkles, Box } from 'lucide-react';

interface Workspace2DViewProps {
  agents: AIAgent[];
  onSelectAgent: (agent: AIAgent) => void;
  onSwitchTo3D: () => void;
}

const ROLE_BORDER_COLORS: Record<string, string> = {
  Orchestrator: 'border-blue-500/40 hover:border-blue-500',
  Planner: 'border-purple-500/40 hover:border-purple-500',
  Executor: 'border-emerald-500/40 hover:border-emerald-500',
  'QA / Reviewer': 'border-amber-500/40 hover:border-amber-500',
  DevOps: 'border-pink-500/40 hover:border-pink-500',
  'Domain Specialist': 'border-cyan-500/40 hover:border-cyan-500'
};

export const Workspace2DView: React.FC<Workspace2DViewProps> = ({ agents, onSelectAgent, onSwitchTo3D }) => {
  return (
    <div className="bg-white/90 dark:bg-[#000000]/90 border border-neutral-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-2xl backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-neutral-100 dark:border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-neutral-900 dark:text-white">
              Ruang Kerja Stasiun AI (Tampilan Adaptif 2D)
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
              Mobile Touch Mode
            </span>
          </div>
          <p className="text-xs text-neutral-500 dark:text-zinc-400 mt-0.5">
            Tampilan workstation 2D hemat baterai dan responsif sentuhan, otomatis diaktifkan untuk perangkat mobile.
          </p>
        </div>

        <button
          onClick={onSwitchTo3D}
          className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-blue-600/20 flex items-center gap-1.5 cursor-pointer active:scale-95"
        >
          <Box className="w-3.5 h-3.5" />
          <span>Buka 3D Cockpit</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {agents.map((agent) => (
          <div
            key={agent.id}
            onClick={() => onSelectAgent(agent)}
            className={`p-4 rounded-xl bg-neutral-50/80 dark:bg-zinc-950/80 border ${ROLE_BORDER_COLORS[agent.role] || 'border-neutral-200 dark:border-zinc-800'} cursor-pointer transition hover:scale-[1.01] active:scale-[0.99] group shadow-sm`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-200 dark:bg-zinc-900 border border-neutral-300 dark:border-zinc-800 text-neutral-600 dark:text-zinc-400">
                Stasiun #{agent.id.slice(-4)}
              </span>
              <span className={`w-2 h-2 rounded-full ${
                agent.status === 'READY' ? 'bg-emerald-400' : agent.status === 'BUSY' ? 'bg-amber-400' : 'bg-red-400'
              }`} />
            </div>

            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-lg bg-neutral-200 dark:bg-zinc-900 flex items-center justify-center text-blue-400 group-hover:scale-110 transition">
                <Bot className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-xs text-neutral-900 dark:text-white truncate group-hover:text-blue-400 transition">
                  {agent.name}
                </h4>
                <p className="text-[10px] text-neutral-500 dark:text-zinc-400">{agent.role}</p>
              </div>
            </div>

            <div className="text-[11px] font-mono text-neutral-600 dark:text-zinc-400 bg-neutral-100 dark:bg-zinc-900/60 p-2 rounded border border-neutral-200 dark:border-zinc-800/80 truncate mb-2">
              Model: {agent.modelId}
            </div>

            <div className="flex items-center justify-between text-[11px] text-blue-500 dark:text-blue-400 font-semibold group-hover:translate-x-0.5 transition">
              <span>Buka Instruksi</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
