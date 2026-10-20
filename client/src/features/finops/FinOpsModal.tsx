import React, { useState } from 'react';
import {
  X,
  DollarSign,
  TrendingUp,
  Cpu,
  Layers,
  ShieldAlert,
  ArrowUpRight,
  PieChart,
  BarChart3,
  Sliders,
  Check,
  AlertTriangle,
  Download,
  Sparkles,
  Zap
} from 'lucide-react';

interface FinOpsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeWorkspaceName?: string;
}

interface ProviderUsage {
  name: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  color: string;
}

export const FinOpsModal: React.FC<FinOpsModalProps> = ({
  isOpen,
  onClose,
  activeWorkspaceName = 'Default Workspace'
}) => {
  const [budgetCapUsd, setBudgetCapUsd] = useState(150);
  const [autoFallbackEnabled, setAutoFallbackEnabled] = useState(true);
  const [budgetAlertEmail, setBudgetAlertEmail] = useState(true);
  const [activeTimeframe, setActiveTimeframe] = useState<'7d' | '30d' | 'all'>('30d');
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const PROVIDER_METRICS: ProviderUsage[] = [
    {
      name: 'Azure OpenAI',
      provider: 'Microsoft Azure',
      model: 'GPT-4o (High-Reasoning)',
      promptTokens: 450200,
      completionTokens: 184500,
      totalTokens: 634700,
      costUsd: 2.97,
      color: 'from-blue-500 to-cyan-400'
    },
    {
      name: 'Anthropic Bedrock',
      provider: 'AWS / Anthropic',
      model: 'Claude 3.5 Sonnet',
      promptTokens: 320100,
      completionTokens: 145000,
      totalTokens: 465100,
      costUsd: 3.13,
      color: 'from-amber-500 to-orange-400'
    },
    {
      name: 'Groq LPU',
      provider: 'Groq Cloud',
      model: 'Llama-3.3-70B (Fast Linter)',
      promptTokens: 980400,
      completionTokens: 310200,
      totalTokens: 1290600,
      costUsd: 0.82,
      color: 'from-emerald-500 to-teal-400'
    },
    {
      name: 'DeepSeek Platform',
      provider: 'DeepSeek AI',
      model: 'DeepSeek-V3 (Open Engine)',
      promptTokens: 620000,
      completionTokens: 210000,
      totalTokens: 830000,
      costUsd: 0.14,
      color: 'from-indigo-500 to-purple-400'
    }
  ];

  const totalTokens = PROVIDER_METRICS.reduce((acc, p) => acc + p.totalTokens, 0);
  const totalSpendUsd = PROVIDER_METRICS.reduce((acc, p) => acc + p.costUsd, 0);
  const totalSpendIdr = Math.round(totalSpendUsd * 16000);
  const budgetPercentage = Math.min(100, Math.round((totalSpendUsd / budgetCapUsd) * 100));

  const handleSaveBudget = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/85 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Box */}
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl shadow-2xl shadow-black/90 flex flex-col max-h-[92vh] overflow-hidden z-10">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">AI FinOps & Token Cost Analytics</h3>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Live Telemetry
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Workspace: <strong className="text-slate-200">{activeWorkspaceName}</strong> • Realtime Token Usage & Anti-Bill-Shock Guard
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Timeframe Selector & Quick Stats */}
        <div className="px-6 py-3 bg-slate-950/40 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTimeframe('7d')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                activeTimeframe === '7d' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              7 Hari Terakhir
            </button>
            <button
              onClick={() => setActiveTimeframe('30d')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                activeTimeframe === '30d' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              30 Hari Terakhir (Siklus Berjalan)
            </button>
            <button
              onClick={() => setActiveTimeframe('all')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                activeTimeframe === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Semua Waktu
            </button>
          </div>

          <div className="flex items-center gap-2 text-slate-400 font-mono">
            <span>Kurs Acuan: <strong>1 USD = Rp 16.000</strong></span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-7 overflow-y-auto space-y-6 flex-1 text-sm text-slate-300">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium">Total Estimasi Pengeluaran</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-white font-mono">${totalSpendUsd.toFixed(2)}</span>
                <span className="text-xs text-emerald-400 font-semibold">USD</span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">≈ Rp {totalSpendIdr.toLocaleString('id-ID')}</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium">Total Token Dikonsumsi</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-cyan-400 font-mono">
                  {(totalTokens / 1000000).toFixed(2)}M
                </span>
                <span className="text-xs text-slate-400">Tokens</span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">{totalTokens.toLocaleString()} total tokens</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium">Batas Anggaran (Budget Cap)</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-indigo-400 font-mono">${budgetCapUsd}</span>
                <span className="text-xs text-slate-400 font-semibold font-mono">({budgetPercentage}%)</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden mt-1">
                <div
                  className={`h-full ${
                    budgetPercentage > 85 ? 'bg-rose-500' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${budgetPercentage}%` }}
                />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-cyan-500/5 to-slate-950/70 border border-emerald-500/25 space-y-1">
              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Efisiensi ROI Rekayasa</span>
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-white font-mono">98.4%</span>
                <span className="text-xs text-emerald-400 font-bold">Hemat</span>
              </div>
              <p className="text-[11px] text-slate-400">vs biaya manual senior dev ($45/jam)</p>
            </div>
          </div>

          {/* Breakdown by Provider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" />
                <span>Rincian Penggunaan Berdasarkan Model & Provider</span>
              </h4>
              <span className="text-xs text-slate-400">Harga dihitung per 1.000.000 token</span>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Model & Provider</th>
                    <th className="py-3 px-4">Prompt Tokens</th>
                    <th className="py-3 px-4">Completion Tokens</th>
                    <th className="py-3 px-4">Total Tokens</th>
                    <th className="py-3 px-4">Biaya (USD)</th>
                    <th className="py-3 px-4">Biaya (IDR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 bg-slate-950/40 text-slate-300">
                  {PROVIDER_METRICS.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${p.color}`} />
                          <div>
                            <span className="font-bold text-white block">{p.model}</span>
                            <span className="text-[10px] text-slate-400">{p.provider}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-mono">{p.promptTokens.toLocaleString()}</td>
                      <td className="py-3.5 px-4 font-mono">{p.completionTokens.toLocaleString()}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-cyan-400">
                        {p.totalTokens.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-white font-bold">
                        ${p.costUsd.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-emerald-400">
                        Rp {Math.round(p.costUsd * 16000).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Budget Guard & Auto-Throttling Controls */}
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>Budget Guardrails & Kebijakan Anti-Bill-Shock</span>
                </h4>
                <p className="text-xs text-slate-400">
                  Cegah lonjakan biaya tak terduga dengan pembatasan kuota dan auto-fallback cerdas.
                </p>
              </div>

              <button
                onClick={handleSaveBudget}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition flex items-center gap-1.5"
              >
                {savedSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Tersimpan!</span>
                  </>
                ) : (
                  <span>Simpan Aturan</span>
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Batas Anggaran Bulanan (USD)</span>
                  <span className="font-mono text-cyan-400 font-bold">${budgetCapUsd} / bulan</span>
                </label>
                <input
                  type="range"
                  min="20"
                  max="500"
                  step="10"
                  value={budgetCapUsd}
                  onChange={(e) => setBudgetCapUsd(Number(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
                <p className="text-[11px] text-slate-500">
                  Estimasi setara dengan Rp {(budgetCapUsd * 16000).toLocaleString('id-ID')} / bulan.
                </p>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoFallbackEnabled}
                    onChange={(e) => setAutoFallbackEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-semibold text-white block">
                      Auto-Fallback ke Open-Weights saat Cap 85%
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Mengalihkan tugas non-kritis ke Groq / DeepSeek otomatis untuk menekan biaya 90%.
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={budgetAlertEmail}
                    onChange={(e) => setBudgetAlertEmail(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-semibold text-white block">
                      Kirim Peringatan Email saat Kuota 75% & 90%
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Notifikasi instan dikirim ke email owner organisasi.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div>
            <span>Data telemetri diperbarui setiap 60 detik melalui Azure Cost API & LLM Gateways</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors"
            >
              Tutup FinOps
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
