import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart2,
  LineChart,
  PieChart,
  TrendingUp,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Download,
  Trash2,
  X,
  Play,
  RefreshCw,
  Clock,
  Hash,
  Database
} from 'lucide-react';
import { api } from '../../services/api.js';
import {
  DataAnalysisSession,
  ChartConfig,
  QuickDataQueryType
} from '../../../../shared/types.js';

interface DataAnalystModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_SAMPLE_CSV = `Bulan,Penjualan,Biaya_Server
Januari,4200,1200
Februari,5100,1450
Maret,6800,1600
April,7900,1850
Mei,9200,2100
Juni,11400,2400`;

export const DataAnalystModal: React.FC<DataAnalystModalProps> = ({ isOpen, onClose }) => {
  const [sessions, setSessions] = useState<DataAnalysisSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<DataAnalysisSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form State
  const [sourceType, setSourceType] = useState<'CSV' | 'JSON'>('CSV');
  const [datasetName, setDatasetName] = useState('Data Kinerja Finansial');
  const [queryPrompt, setQueryPrompt] = useState('Analisis tren penjualan dan rasio efisiensi biaya server');
  const [rawData, setRawData] = useState(DEFAULT_SAMPLE_CSV);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getDataAnalysisSessions();
      setSessions(data);
      if (data.length > 0 && !selectedSession) {
        setSelectedSession(data[0]);
      }
    } catch (err: any) {
      console.error('Failed to load analysis sessions:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedSession]);

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen, fetchSessions]);

  // Escape key handler contract
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleAnalyze = async () => {
    if (!rawData.trim()) {
      setMessage({ text: 'Data mentah tidak boleh kosong.', type: 'error' });
      return;
    }
    if (!queryPrompt.trim()) {
      setMessage({ text: 'Tujuan atau pertanyaan analisis wajib diisi.', type: 'error' });
      return;
    }

    try {
      setAnalyzing(true);
      setMessage(null);
      const session = await api.analyzeData({
        datasetName: datasetName.trim() || 'Dataset Analisis',
        sourceType,
        rawData: rawData.trim(),
        queryPrompt: queryPrompt.trim()
      });
      setSelectedSession(session);
      await fetchSessions();
      setMessage({ text: `Analisis berhasil disintesis: ${session.title}`, type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal memproses analisis data.', type: 'error' });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleQuickQuery = async (type: QuickDataQueryType) => {
    try {
      setAnalyzing(true);
      setMessage(null);
      const session = await api.runQuickDataQuery(type);
      setSelectedSession(session);
      await fetchSessions();
      setMessage({ text: `Preset analitik "${session.title}" berhasil dimuat!`, type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal menjalankan query cepat.', type: 'error' });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDeleteSession = async (id: string) => {
    try {
      await api.deleteDataAnalysisSession(id);
      if (selectedSession?.id === id) {
        setSelectedSession(null);
      }
      await fetchSessions();
      setMessage({ text: 'Sesi analisis berhasil dihapus.', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal menghapus sesi.', type: 'error' });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-[#0f172a] border border-slate-700/80 rounded-2xl w-full max-w-7xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Autonomous Data Analyst & Interactive Visualizer
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  AI STUDIO
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Pemrosesan dataset cerdas, kalkulasi statistik, visualisasi grafik interaktif, dan sintesis wawasan eksekutif
              </p>
            </div>
          </div>

          {/* Quick Presets */}
          <div className="hidden md:flex items-center gap-2">
            <span className="text-xs text-slate-400 mr-1">Preset:</span>
            <button
              type="button"
              onClick={() => handleQuickQuery('TASK_SUCCESS_RATES')}
              disabled={analyzing}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
            >
              Rasio Tugas
            </button>
            <button
              type="button"
              onClick={() => handleQuickQuery('AGENT_COST_DISTRIBUTION')}
              disabled={analyzing}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
            >
              Biaya Agen
            </button>
            <button
              type="button"
              onClick={() => handleQuickQuery('TASK_PRIORITY_DISTRIBUTION')}
              disabled={analyzing}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
            >
              Prioritas Tugas
            </button>
            <button
              type="button"
              onClick={() => handleQuickQuery('HOURLY_ACTIVITY_PEAKS')}
              disabled={analyzing}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
            >
              Jam Sibuk
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notifications Banner */}
        {message && (
          <div
            className={`px-6 py-2.5 text-xs flex items-center justify-between border-b ${
              message.type === 'success'
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
                : 'bg-rose-950/40 text-rose-300 border-rose-800/40'
            }`}
          >
            <span>{message.text}</span>
            <button
              type="button"
              onClick={() => setMessage(null)}
              className="text-slate-400 hover:text-white ml-2 text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Content Layout: Ingestion & History (Left) vs Interactive Chart & Insights (Right) */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
          {/* Left Column: Form & History */}
          <div className="lg:col-span-4 p-4 flex flex-col h-full overflow-y-auto space-y-4">
            {/* Form */}
            <div className="space-y-3 p-4 rounded-xl bg-slate-900/50 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  <span>Input Dataset</span>
                </span>
                <div className="flex items-center gap-1">
                  {(['CSV', 'JSON'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setSourceType(t);
                        if (t === 'JSON' && rawData === DEFAULT_SAMPLE_CSV) {
                          setRawData(
                            JSON.stringify([
                              { Produk: 'Aplikasi Web', Penjualan: 85, Pengguna: 450 },
                              { Produk: 'Mobile App', Penjualan: 120, Pengguna: 780 },
                              { Produk: 'API Gateway', Penjualan: 60, Pengguna: 210 }
                            ], null, 2)
                          );
                        } else if (t === 'CSV' && !rawData.includes(',')) {
                          setRawData(DEFAULT_SAMPLE_CSV);
                        }
                      }}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono transition ${
                        sourceType === t
                          ? 'bg-blue-600 text-white font-bold'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Nama Dataset:</label>
                <input
                  type="text"
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                  placeholder="Mis. Penjualan Q3"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Pertanyaan / Fokus Analisis:</label>
                <input
                  type="text"
                  value={queryPrompt}
                  onChange={(e) => setQueryPrompt(e.target.value)}
                  placeholder="Mis. Tren pertumbuhan dan perbandingan rasio"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  Konten Data ({sourceType}):
                </label>
                <textarea
                  value={rawData}
                  onChange={(e) => setRawData(e.target.value)}
                  rows={6}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-[11px] font-mono text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <button
                type="button"
                onClick={handleAnalyze}
                disabled={analyzing}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md disabled:opacity-50"
              >
                <Play className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
                <span>{analyzing ? 'Memproses Analisis...' : 'Jalankan Analisis Cerdas'}</span>
              </button>
            </div>

            {/* Riwayat Sesi Analisis */}
            <div className="flex-1 space-y-2">
              <h4 className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Riwayat Sesi Analisis</span>
                <span className="text-[10px] font-mono text-slate-500">{sessions.length} sesi</span>
              </h4>

              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {sessions.map((s) => {
                  const isSelected = selectedSession?.id === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelectedSession(s)}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition flex items-center justify-between ${
                        isSelected
                          ? 'bg-blue-950/40 border-blue-500/50 shadow-sm'
                          : 'bg-slate-900/40 border-slate-800 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 uppercase">
                            {s.chartConfig?.type || 'BAR'}
                          </span>
                          <span className="text-xs font-bold text-white truncate block">{s.title}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block truncate">{s.datasetName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSession(s.id);
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1"
                        title="Hapus Sesi"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Visualizer & Insights */}
          <div className="lg:col-span-8 p-6 flex flex-col h-full overflow-y-auto bg-slate-950/40 space-y-5">
            {selectedSession ? (
              <>
                {/* Title and Meta */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-slate-400">{selectedSession.id}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold uppercase">
                        {selectedSession.chartConfig.type} CHART
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {new Date(selectedSession.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white">{selectedSession.title}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Dataset: <strong className="text-slate-300">{selectedSession.datasetName}</strong> ({selectedSession.sourceType})
                    </p>
                  </div>
                </div>

                {/* Statistical Metric Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                      <Hash className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Total Baris</span>
                      <span className="text-sm font-bold text-white font-mono">
                        {selectedSession.stats.totalRows}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                      <Layers className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Total Kolom</span>
                      <span className="text-sm font-bold text-white font-mono">
                        {selectedSession.stats.columnCount}
                      </span>
                    </div>
                  </div>

                  {selectedSession.stats.numericMetrics &&
                    Object.keys(selectedSession.stats.numericMetrics).length > 0 && (
                      <>
                        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                            <TrendingUp className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">Rata-rata</span>
                            <span className="text-sm font-bold text-white font-mono">
                              {
                                Object.values(selectedSession.stats.numericMetrics)[0].avg.toLocaleString()
                              }
                            </span>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                            <BarChart2 className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 block">Nilai Puncak</span>
                            <span className="text-sm font-bold text-white font-mono">
                              {
                                Object.values(selectedSession.stats.numericMetrics)[0].max.toLocaleString()
                              }
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                </div>

                {/* SVG Chart Visualization Canvas */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-blue-400" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        {selectedSession.chartConfig.title}
                      </h4>
                    </div>
                    {/* Legend */}
                    <div className="flex items-center gap-3 text-xs">
                      {selectedSession.chartConfig.datasets.map((ds, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: ds.color || '#3B82F6' }}
                          />
                          <span className="text-slate-300 font-mono text-[11px]">{ds.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Render Chart Engine */}
                  <div className="w-full h-64 sm:h-72">
                    <InteractiveSvgChart chartConfig={selectedSession.chartConfig} />
                  </div>
                </div>

                {/* Executive Summary & Insights */}
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                    <h4 className="text-xs font-bold text-blue-400 mb-1 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Ringkasan Eksekutif Analis:</span>
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {selectedSession.summary}
                    </p>
                  </div>

                  {selectedSession.insights.length > 0 && (
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                      <h4 className="text-xs font-bold text-slate-200 mb-2">
                        Wawasan Kunci & Pola Temuan:
                      </h4>
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        {selectedSession.insights.map((ins, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                            <span dangerouslySetInnerHTML={{ __html: ins.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500">
                <BarChart2 className="w-12 h-12 text-slate-700 mb-3" />
                <p className="text-sm font-semibold text-slate-400">Pilih atau Jalankan Analisis Baru</p>
                <p className="text-xs text-slate-600 max-w-sm mt-1">
                  Masukkan data pada form di sebelah kiri atau pilih salah satu preset untuk menghasilkan grafik analitik interaktif.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Interactive SVG Chart Component (Zero-Dependency) ---

const InteractiveSvgChart: React.FC<{ chartConfig: ChartConfig }> = ({ chartConfig }) => {
  const { type, labels, datasets } = chartConfig;

  if (!labels.length || !datasets.length) {
    return (
      <div className="h-full flex items-center justify-center text-slate-600 text-xs">
        Data grafik kosong.
      </div>
    );
  }

  // 1. Pie Chart Renderer
  if (type === 'pie') {
    const data = datasets[0]?.data || [];
    const total = data.reduce((a, b) => a + b, 0);
    if (total === 0) return <div className="text-xs text-slate-500">Total data bernilai nol.</div>;

    const colors = [
      '#3B82F6',
      '#10B981',
      '#8B5CF6',
      '#F59E0B',
      '#EC4899',
      '#06B6D4',
      '#EF4444'
    ];

    let cumulativePercent = 0;
    const slices = data.map((val, idx) => {
      const percent = val / total;
      const startPercent = cumulativePercent;
      cumulativePercent += percent;

      const getCoordinates = (p: number) => {
        const x = Math.cos(2 * Math.PI * p);
        const y = Math.sin(2 * Math.PI * p);
        return [x, y];
      };

      const [startX, startY] = getCoordinates(startPercent);
      const [endX, endY] = getCoordinates(cumulativePercent);
      const largeArcFlag = percent > 0.5 ? 1 : 0;
      const pathData = `M 0 0 L ${startX} ${startY} A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;

      return {
        pathData,
        color: colors[idx % colors.length],
        label: labels[idx] || `Item ${idx + 1}`,
        percent: (percent * 100).toFixed(1),
        val
      };
    });

    return (
      <div className="h-full flex flex-col sm:flex-row items-center justify-center gap-6">
        <svg viewBox="-1.2 -1.2 2.4 2.4" className="w-48 h-48 sm:w-56 sm:h-56 -rotate-90">
          {slices.map((slice, i) => (
            <path
              key={i}
              d={slice.pathData}
              fill={slice.color}
              stroke="#0f172a"
              strokeWidth="0.03"
              className="hover:opacity-80 transition cursor-pointer"
            >
              <title>{`${slice.label}: ${slice.val} (${slice.percent}%)`}</title>
            </path>
          ))}
        </svg>

        <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
          {slices.map((slice, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-3 h-3 rounded-md shrink-0" style={{ backgroundColor: slice.color }} />
              <span className="text-slate-300 font-medium truncate max-w-[140px]">{slice.label}:</span>
              <span className="text-white font-mono font-bold">{slice.percent}%</span>
              <span className="text-slate-500 font-mono text-[10px]">({slice.val})</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. Bar, Line, or Area Chart Renderer
  const allValues = datasets.flatMap((d) => d.data);
  const maxVal = Math.max(...allValues, 1);
  const minVal = Math.min(0, ...allValues);
  const range = maxVal - minVal || 1;

  const width = 600;
  const height = 240;
  const paddingLeft = 50;
  const paddingBottom = 40;
  const paddingTop = 20;
  const paddingRight = 20;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Grid steps (4 horizontal gridlines)
  const steps = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      <defs>
        {datasets.map((ds, idx) => (
          <linearGradient key={idx} id={`gradient-${idx}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ds.color || '#3B82F6'} stopOpacity="0.4" />
            <stop offset="100%" stopColor={ds.color || '#3B82F6'} stopOpacity="0.0" />
          </linearGradient>
        ))}
      </defs>

      {/* Gridlines */}
      {steps.map((step, i) => {
        const y = paddingTop + chartHeight * (1 - step);
        const val = Math.round(minVal + range * step);
        return (
          <g key={i}>
            <line
              x1={paddingLeft}
              y1={y}
              x2={width - paddingRight}
              y2={y}
              stroke="#334155"
              strokeDasharray="3 3"
              strokeWidth="0.8"
            />
            <text
              x={paddingLeft - 8}
              y={y + 3}
              textAnchor="end"
              fill="#94a3b8"
              fontSize="9"
              fontFamily="monospace"
            >
              {val.toLocaleString()}
            </text>
          </g>
        );
      })}

      {/* Bar Chart rendering */}
      {type === 'bar' &&
        labels.map((label, labelIdx) => {
          const groupWidth = chartWidth / labels.length;
          const barWidth = Math.min(28, (groupWidth * 0.7) / datasets.length);
          const groupX = paddingLeft + labelIdx * groupWidth;

          return (
            <g key={labelIdx}>
              {datasets.map((ds, dsIdx) => {
                const val = ds.data[labelIdx] || 0;
                const barHeight = Math.max(3, (val / range) * chartHeight);
                const x = groupX + (groupWidth - barWidth * datasets.length) / 2 + dsIdx * barWidth;
                const y = paddingTop + chartHeight - barHeight;

                return (
                  <rect
                    key={dsIdx}
                    x={x}
                    y={y}
                    width={barWidth - 2}
                    height={barHeight}
                    rx="3"
                    fill={ds.color || '#3B82F6'}
                    className="hover:opacity-80 transition cursor-pointer"
                  >
                    <title>{`${label} - ${ds.label}: ${val.toLocaleString()}`}</title>
                  </rect>
                );
              })}

              {/* X Axis Label */}
              <text
                x={groupX + groupWidth / 2}
                y={height - paddingBottom + 16}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="9"
                fontFamily="sans-serif"
              >
                {label.length > 8 ? `${label.slice(0, 7)}…` : label}
              </text>
            </g>
          );
        })}

      {/* Line or Area Chart rendering */}
      {(type === 'line' || type === 'area') && (
        <>
          {datasets.map((ds, dsIdx) => {
            const points = ds.data.map((val, i) => {
              const x = paddingLeft + (i / Math.max(1, labels.length - 1)) * chartWidth;
              const y = paddingTop + chartHeight - (val / range) * chartHeight;
              return { x, y, val };
            });

            const pointsString = points.map((p) => `${p.x},${p.y}`).join(' ');

            return (
              <g key={dsIdx}>
                {/* Area Gradient */}
                {type === 'area' && (
                  <polygon
                    points={`${paddingLeft},${paddingTop + chartHeight} ${pointsString} ${
                      paddingLeft + chartWidth
                    },${paddingTop + chartHeight}`}
                    fill={`url(#gradient-${dsIdx})`}
                  />
                )}

                {/* Polyline */}
                <polyline
                  fill="none"
                  stroke={ds.color || '#3B82F6'}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={pointsString}
                />

                {/* Point markers */}
                {points.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r="4"
                    fill="#0f172a"
                    stroke={ds.color || '#3B82F6'}
                    strokeWidth="2"
                    className="hover:r-6 transition cursor-pointer"
                  >
                    <title>{`${labels[i]} - ${ds.label}: ${p.val.toLocaleString()}`}</title>
                  </circle>
                ))}
              </g>
            );
          })}

          {/* X Axis Labels for Line/Area */}
          {labels.map((label, i) => {
            const x = paddingLeft + (i / Math.max(1, labels.length - 1)) * chartWidth;
            return (
              <text
                key={i}
                x={x}
                y={height - paddingBottom + 16}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="9"
                fontFamily="sans-serif"
              >
                {label.length > 8 ? `${label.slice(0, 7)}…` : label}
              </text>
            );
          })}
        </>
      )}
    </svg>
  );
};
