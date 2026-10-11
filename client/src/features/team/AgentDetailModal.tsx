import React, { useState, useEffect } from 'react';
import { X, Bot, Play, Clock, CheckCircle2, AlertCircle, RefreshCw, Layers } from 'lucide-react';
import { AIAgent, AgentRun } from '../../../../shared/types.js';
import { api } from '../../services/api.js';

interface AgentDetailModalProps {
  agent: AIAgent | null;
  onClose: () => void;
  onRunFinished: () => void;
}

export const AgentDetailModal: React.FC<AgentDetailModalProps> = ({ agent, onClose, onRunFinished }) => {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<AgentRun | null>(null);
  const [execError, setExecError] = useState<string | null>(null);

  useEffect(() => {
    if (agent) {
      loadRuns(agent.id);
      setPrompt('');
      setExecutionResult(null);
      setExecError(null);
    }
  }, [agent]);

  const loadRuns = async (agentId: string) => {
    setLoadingRuns(true);
    try {
      const data = await api.getAgentRuns(agentId);
      setRuns(data);
    } catch {
      // ignore
    } finally {
      setLoadingRuns(false);
    }
  };

  if (!agent) return null;

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsExecuting(true);
    setExecError(null);
    setExecutionResult(null);

    try {
      // Execute task via task execute endpoint or direct prompt
      const result = await api.executeTask('task-direct-run', agent.id, prompt.trim());
      setExecutionResult(result);
      loadRuns(agent.id);
      onRunFinished();
    } catch (err: any) {
      setExecError(err.message || 'Eksekusi gagal dijalankan.');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0B0F17]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>{agent.name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-normal">
                  {agent.role}
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Model: {agent.modelId} • Provider: {agent.providerName || agent.providerType}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 space-y-5 flex-1">
          {/* System Prompt & Details */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Instruksi Sistem (System Prompt)</h3>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 leading-relaxed max-h-28 overflow-y-auto">
              {agent.systemPrompt}
            </div>
          </div>

          {/* Quick Execution Form */}
          <div className="p-4 rounded-xl bg-[#0B0F17] border border-blue-500/20">
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-2 flex items-center gap-1.5">
              <Play className="w-3.5 h-3.5" />
              <span>Jalankan Instruksi / Task ke Agen</span>
            </h3>

            <form onSubmit={handleExecute} className="space-y-3">
              <textarea
                rows={2}
                placeholder="Masukkan prompt atau tugas yang ingin didelegasikan kepada agent ini..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              />

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">
                  Agen akan mengeksekusi instruksi sesuai batasan kapabilitas dan parameter model.
                </span>
                <button
                  type="submit"
                  disabled={isExecuting || !prompt.trim() || agent.status === 'UNAVAILABLE'}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Play className={`w-3 h-3 ${isExecuting ? 'animate-spin' : ''}`} />
                  <span>{isExecuting ? 'Mengeksekusi...' : 'Kirim Eksekusi'}</span>
                </button>
              </div>
            </form>

            {/* Error Result */}
            {execError && (
              <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{execError}</span>
              </div>
            )}

            {/* Success Result */}
            {executionResult && (
              <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs space-y-2">
                <div className="flex items-center justify-between font-bold text-emerald-400">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Hasil Eksekusi ({executionResult.status})</span>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400">
                    Durasi: {executionResult.durationMs}ms
                  </span>
                </div>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-slate-200 font-mono text-[11px] whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {executionResult.outputResult || '(Tidak ada keluaran teks)'}
                </div>
              </div>
            )}
          </div>

          {/* Recent Runs History */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Riwayat Eksekusi Terakhir ({runs.length})
              </h3>
              <button
                type="button"
                onClick={() => loadRuns(agent.id)}
                className="text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${loadingRuns ? 'animate-spin' : ''}`} />
                <span>Segarkan</span>
              </button>
            </div>

            {runs.length === 0 ? (
              <p className="text-xs text-slate-500 italic p-3 text-center border border-slate-800/80 rounded-lg">
                Belum ada riwayat eksekusi untuk anggota ini.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {runs.map((run) => (
                  <div key={run.id} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`font-bold font-mono text-[10px] px-1.5 py-0.5 rounded ${
                        run.status === 'SUCCEEDED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                      }`}>
                        {run.status}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {run.startedAt ? new Date(run.startedAt).toLocaleTimeString('id-ID') : '-'} • {run.durationMs || 0}ms
                      </span>
                    </div>
                    <p className="text-slate-400 text-[11px] truncate font-mono">Prompt: {run.inputPrompt}</p>
                    {run.outputResult && (
                      <p className="text-slate-300 text-[11px] line-clamp-2 bg-slate-900/60 p-1.5 rounded font-mono">
                        {run.outputResult}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-[#0B0F17]/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
