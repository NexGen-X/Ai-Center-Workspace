import React, { useState, useEffect } from 'react';
import {
  X,
  TrendingUp,
  Coins,
  Cpu,
  Clock,
  CheckCircle,
  AlertOctagon,
  RefreshCw,
  BarChart2,
  Users,
  Download,
  FileSpreadsheet
} from 'lucide-react';
import { api } from '../../services/api.js';
import { FinOpsReportsSummary } from '../../../../shared/types.js';
import { useFeedback } from '../../components/common/FeedbackContext.js';

interface ReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReportsModal: React.FC<ReportsModalProps> = ({ isOpen, onClose }) => {
  const { toast } = useFeedback();
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<FinOpsReportsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExportCSV = () => {
    if (!data) return;
    const rows = [
      ['Metric', 'Nilai'],
      ['Periode (Hari)', String(data.periodDays)],
      ['Total Eksekusi', String(data.totalRuns)],
      ['Sukses', String(data.successfulRuns)],
      ['Gagal', String(data.failedRuns)],
      ['Tingkat Sukses (%)', String(data.successRatePercent)],
      ['Total Tokens', String(data.totalTokens)],
      ['Prompt Tokens', String(data.totalPromptTokens)],
      ['Completion Tokens', String(data.totalCompletionTokens)],
      ['Estimasi Biaya (USD)', `$${data.estimatedTotalCostUsd.toFixed(4)}`],
      ['Rata-rata Latensi (ms)', String(data.averageLatencyMs)],
      [],
      ['Agent Name', 'Role', 'Total Runs', 'Success', 'Failure', 'Avg Latency (ms)', 'Total Tokens'],
      ...data.agentMetrics.map(a => [
        `"${a.agentName}"`,
        `"${a.role}"`,
        String(a.totalRuns),
        String(a.successCount),
        String(a.failureCount),
        String(a.avgDurationMs),
        String(a.totalTokens)
      ]),
      [],
      ['Model ID', 'Total Runs', 'Prompt Tokens', 'Completion Tokens', 'Total Tokens', 'Avg Latency (ms)', 'Est Cost (USD)'],
      ...data.modelMetrics.map(m => [
        `"${m.modelId}"`,
        String(m.totalRuns),
        String(m.totalPromptTokens),
        String(m.totalCompletionTokens),
        String(m.totalTokens),
        String(m.avgDurationMs),
        `$${m.estimatedCostUsd.toFixed(4)}`
      ])
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `finops-report-${data.periodDays}d-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Laporan FinOps berhasil diekspor ke format CSV.');
  };

  const handleExportJSON = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finops-telemetry-${data.periodDays}d-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Data analitik FinOps berhasil diekspor ke JSON.');
  };

  const fetchReports = async (period: number) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getReportsSummary(period);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat analitik FinOps');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchReports(days);
    }
  }, [isOpen, days]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[94vh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 sm:px-6 py-3 sm:py-4 border-b border-slate-800 bg-slate-800/40 flex-wrap gap-2.5">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shrink-0">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide truncate">
                FinOps & Telemetry Analytics
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 hidden sm:block truncate">
                Pemantauan konsumsi token, estimasi biaya inferensi LLM, dan efisiensi eksekusi AI Team
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Period Selector */}
            <div className="flex items-center bg-slate-800 p-1 rounded-lg border border-slate-700/60 text-xs">
              {[7, 14, 30, 90].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  className={`px-2 sm:px-2.5 py-1 rounded-md font-medium transition-all text-[11px] ${
                    days === d
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {d}h
                </button>
              ))}
            </div>

            {/* Export Actions */}
            {data && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/40 text-emerald-300 text-xs font-semibold transition"
                  title="Unduh Laporan FinOps (.csv)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition"
                  title="Unduh Telemetri (.json)"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">JSON</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => fetchReports(days)}
              disabled={loading}
              className="p-1.5 sm:p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Perbarui Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup laporan FinOps"
              className="p-1.5 sm:p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4 sm:space-y-6">
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Metric KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Tokens */}
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center gap-3">
              <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Total Token</p>
                <h3 className="text-xl font-bold text-white">
                  {data ? (data.totalTokens).toLocaleString() : '0'}
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Prompt: {data?.totalPromptTokens.toLocaleString() || 0} | Output: {data?.totalCompletionTokens.toLocaleString() || 0}
                </p>
              </div>
            </div>

            {/* Estimated Cost */}
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center gap-3">
              <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Estimasi Biaya</p>
                <h3 className="text-xl font-bold text-emerald-400">
                  ${data ? data.estimatedTotalCostUsd.toFixed(4) : '0.0000'}
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Blended LLM inference cost
                </p>
              </div>
            </div>

            {/* Success Rate */}
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center gap-3">
              <div className="p-3 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Tingkat Keberhasilan</p>
                <h3 className="text-xl font-bold text-white">
                  {data ? `${data.successRatePercent}%` : '100%'}
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {data?.successfulRuns || 0} sukses / {data?.totalRuns || 0} eksekusi
                </p>
              </div>
            </div>

            {/* Average Latency */}
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center gap-3">
              <div className="p-3 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Rata-rata Latensi</p>
                <h3 className="text-xl font-bold text-white">
                  {data ? `${data.averageLatencyMs} ms` : '0 ms'}
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Durasi rata-rata per panggilan LLM
                </p>
              </div>
            </div>
          </div>

          {/* Model Metrics Table */}
          <div className="rounded-xl bg-slate-800/30 border border-slate-700/60 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-700/60 flex items-center justify-between bg-slate-800/50">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Distribusi Pemakaian Berdasarkan Model LLM
                </h4>
              </div>
              <span className="text-xs text-slate-400">
                {data?.modelMetrics.length || 0} Model Aktif
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-900/40 text-slate-400 border-b border-slate-800">
                    <th className="py-2.5 px-4 font-semibold">Model ID</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Runs</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Prompt Tokens</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Output Tokens</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Total Tokens</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Rata-rata Latensi</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Estimasi Biaya</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data?.modelMetrics.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-500">
                        Belum ada riwayat inferensi model tercatat pada periode ini.
                      </td>
                    </tr>
                  ) : (
                    data?.modelMetrics.map((m) => (
                      <tr key={m.modelId} className="hover:bg-slate-800/30 text-slate-300">
                        <td className="py-2.5 px-4 font-mono font-medium text-cyan-300">
                          {m.modelId}
                        </td>
                        <td className="py-2.5 px-4 text-right font-medium">{m.totalRuns}</td>
                        <td className="py-2.5 px-4 text-right text-slate-400">
                          {m.totalPromptTokens.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-right text-slate-400">
                          {m.totalCompletionTokens.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-right font-semibold text-white">
                          {m.totalTokens.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-right text-slate-300">
                          {m.avgDurationMs} ms
                        </td>
                        <td className="py-2.5 px-4 text-right text-emerald-400 font-medium">
                          ${m.estimatedCostUsd.toFixed(4)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* AI Agents Operational Metrics Table */}
          <div className="rounded-xl bg-slate-800/30 border border-slate-700/60 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-700/60 flex items-center justify-between bg-slate-800/50">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Performa Anggota AI Team
                </h4>
              </div>
              <span className="text-xs text-slate-400">
                {data?.agentMetrics.length || 0} Anggota Terdaftar
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-900/40 text-slate-400 border-b border-slate-800">
                    <th className="py-2.5 px-4 font-semibold">Nama Agent</th>
                    <th className="py-2.5 px-4 font-semibold">Peran</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Total Runs</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Sukses</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Gagal</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Rata-rata Latensi</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Konsumsi Token</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data?.agentMetrics.map((a) => (
                    <tr key={a.agentId} className="hover:bg-slate-800/30 text-slate-300">
                      <td className="py-2.5 px-4 font-semibold text-white">{a.agentName}</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[10px] text-slate-300 font-mono">
                          {a.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-medium">{a.totalRuns}</td>
                      <td className="py-2.5 px-4 text-right text-emerald-400 font-medium">
                        {a.successCount}
                      </td>
                      <td className="py-2.5 px-4 text-right text-rose-400 font-medium">
                        {a.failureCount}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-300">
                        {a.avgDurationMs} ms
                      </td>
                      <td className="py-2.5 px-4 text-right font-semibold text-indigo-300">
                        {a.totalTokens.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-500">
          <span>Periode analitik: {days} hari terakhir</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
