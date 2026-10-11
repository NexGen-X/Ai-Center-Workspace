import React from 'react';
import { AIAgent } from '../../../../shared/types.js';
import { Monitor, Bot, ArrowRight, Eye, Shield, Cpu } from 'lucide-react';

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
    <div className="bg-[#111827]/90 border border-slate-800 rounded-2xl p-6 shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Monitor className="w-4 h-4 text-cyan-400" />
            <span>Ruang Kerja Stasiun AI (Tampilan Aksesibilitas 2D)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Tampilan matriks workstation 2D hemat daya untuk perangkat mobile dan pengguna preferensi reduksi gerak.
          </p>
        </div>

        <button
          onClick={onSwitchTo3D}
          className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg shadow-blue-600/20"
        >
          Beralih ke Tampilan 3D
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {agents.map((agent) => (
          <div
            key={agent.id}
            onClick={() => onSelectAgent(agent)}
            className={`p-4 rounded-xl bg-slate-950/80 border ${ROLE_BORDER_COLORS[agent.role] || 'border-slate-800'} cursor-pointer transition group`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
                Stasiun #{agent.id.slice(-4)}
              </span>
              <span className={`w-2 h-2 rounded-full ${
                agent.status === 'READY' ? 'bg-emerald-400' : agent.status === 'BUSY' ? 'bg-amber-400' : 'bg-red-400'
              }`} />
            </div>

            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-blue-400 group-hover:scale-110 transition">
                <Bot className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-xs text-white truncate group-hover:text-blue-400 transition">
                  {agent.name}
                </h4>
                <p className="text-[10px] text-slate-400">{agent.role}</p>
              </div>
            </div>

            <div className="text-[11px] font-mono text-slate-400 bg-slate-900/50 p-2 rounded border border-slate-800/80 truncate mb-2">
              Model: {agent.modelId}
            </div>

            <div className="flex items-center justify-between text-[11px] text-blue-400 font-semibold group-hover:translate-x-0.5 transition">
              <span>Buka Instruksi</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
