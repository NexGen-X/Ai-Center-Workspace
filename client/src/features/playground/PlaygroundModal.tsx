/**
 * AI Playground & Multi-Model Benchmark Sandbox — AI Agent Command Center
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  FlaskConical,
  Play,
  RotateCcw,
  Copy,
  Check,
  Zap,
  Clock,
  Coins,
  Cpu,
  Layers,
  Sparkles,
  Sliders,
  Split,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Trophy,
  Award,
  Scale,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';
import {
  ModelProviderConfig,
  AIAgent,
  EvalBenchmarkItem,
  EvalRunResult,
  EvalLeaderboardEntry,
  EvalCategory
} from '../../../../shared/types.js';
import { api } from '../../services/api.js';
import { useFeedback } from '../../components/common/FeedbackContext.js';
import { CustomSelect } from '../../components/common/CustomSelect.js';

interface PlaygroundModalProps {
  isOpen: boolean;
  onClose: () => void;
  providers: ModelProviderConfig[];
  agents: AIAgent[];
}

interface BenchmarkResult {
  slotId: 'A' | 'B';
  providerId: string;
  providerName: string;
  modelId: string;
  success: boolean;
  status: string;
  outputResult?: string;
  durationMs: number;
  tokensUsed?: { promptTokens: number; completionTokens: number; totalTokens: number };
  errorMessage?: string;
}

const PROMPT_PRESETS = [
  {
    name: 'Analisis Kode & Keamanan',
    prompt: 'Analisis potensi celah keamanan (OWASP Top 10) pada fungsi autentikasi JWT dan berikan perbaikan kode TypeScript.'
  },
  {
    name: 'Arsitektur Sistem Terdistribusi',
    prompt: 'Rancang arsitektur event-driven microservices untuk pipeline orkestrasi 50 AI agent dengan throughput tinggi.'
  },
  {
    name: 'Logika & Algoritma',
    prompt: 'Implementasikan algoritma rate limiter sliding window di TypeScript beserta analisis kompleksitas waktu dan memori.'
  },
  {
    name: 'Ekstraksi JSON Terstruktur',
    prompt: 'Ekstraksi entitas dari teks berikut ke format JSON murni: "PT Teknologi Mandiri berencana merger dengan Global AI Corp senilai $50M pada Q4 2026."'
  }
];

export const PlaygroundModal: React.FC<PlaygroundModalProps> = ({
  isOpen,
  onClose,
  providers,
  agents
}) => {
  const { toast } = useFeedback();
  const [activeTab, setActiveTab] = useState<'SANDBOX' | 'ARENA'>('SANDBOX');
  const [isCompareMode, setIsCompareMode] = useState<boolean>(true);
  const [prompt, setPrompt] = useState<string>('Jelaskan keunggulan arsitektur event-driven microservices untuk sistem AI Agent Command Center.');
  const [systemPrompt, setSystemPrompt] = useState<string>('You are an expert AI systems architect.');
  const [showSystemPrompt, setShowSystemPrompt] = useState<boolean>(false);

  // Evals & LLM-as-a-Judge Arena state
  const [benchmarks, setBenchmarks] = useState<EvalBenchmarkItem[]>([]);
  const [selectedBenchmarkId, setSelectedBenchmarkId] = useState<string>('');
  const [evalTargetProviderId, setEvalTargetProviderId] = useState<string>('');
  const [evalTargetModelId, setEvalTargetModelId] = useState<string>('');
  const [evalJudgeProviderId, setEvalJudgeProviderId] = useState<string>('');
  const [evalJudgeModelId, setEvalJudgeModelId] = useState<string>('');
  const [evalRunLoading, setEvalRunLoading] = useState<boolean>(false);
  const [lastEvalResult, setLastEvalResult] = useState<EvalRunResult | null>(null);
  const [leaderboard, setLeaderboard] = useState<EvalLeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState<boolean>(false);

  const fetchBenchmarksAndLeaderboard = async () => {
    try {
      const bList = await api.getEvalBenchmarks();
      setBenchmarks(bList);
      if (bList.length > 0 && !selectedBenchmarkId) {
        setSelectedBenchmarkId(bList[0].id);
      }
      fetchLeaderboard();
    } catch (err: any) {
      console.error('Failed to load benchmarks:', err);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      setLoadingLeaderboard(true);
      const lb = await api.getEvalLeaderboard();
      setLeaderboard(lb);
    } catch (err: any) {
      console.error('Failed to load leaderboard:', err);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  const handleRunEval = async () => {
    if (!selectedBenchmarkId || !evalTargetProviderId || !evalTargetModelId) {
      toast.warning('Pilih benchmark test case, provider, dan model target untuk dievaluasi.');
      return;
    }

    try {
      setEvalRunLoading(true);
      setLastEvalResult(null);
      toast.info('Menjalankan inferensi model dan penilaian LLM-as-a-Judge...');
      const res = await api.runEval({
        benchmarkId: selectedBenchmarkId,
        providerId: evalTargetProviderId,
        modelId: evalTargetModelId,
        judgeProviderId: evalJudgeProviderId || undefined,
        judgeModelId: evalJudgeModelId || undefined
      });
      setLastEvalResult(res);
      toast.success(`Evaluasi selesai! Skor Total: ${((res.judgeScoreCorrectness + res.judgeScoreFaithfulness) / 2).toFixed(1)}/100`);
      fetchLeaderboard();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menjalankan evaluasi benchmark.');
    } finally {
      setEvalRunLoading(false);
    }
  };

  // Slot A Config
  const [slotAProviderId, setSlotAProviderId] = useState<string>('');
  const [slotAModelId, setSlotAModelId] = useState<string>('');
  const [slotATemp, setSlotATemp] = useState<number>(0.7);

  // Slot B Config
  const [slotBProviderId, setSlotBProviderId] = useState<string>('');
  const [slotBModelId, setSlotBModelId] = useState<string>('');
  const [slotBTemp, setSlotBTemp] = useState<number>(0.7);

  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<Record<'A' | 'B', BenchmarkResult | null>>({
    A: null,
    B: null
  });
  const [streamOutputs, setStreamOutputs] = useState<Record<'A' | 'B', string>>({
    A: '',
    B: ''
  });
  const [copiedSlot, setCopiedSlot] = useState<'A' | 'B' | null>(null);

  // Connect to SSE for real-time live streaming of playground token chunks
  useEffect(() => {
    if (!isOpen) return;

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/realtime');

      eventSource.addEventListener('playground.token_chunk', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data.slotId === 'A' || data.slotId === 'B') {
            setStreamOutputs((prev) => ({
              ...prev,
              [data.slotId]: data.text || ''
            }));
          }
        } catch {
          // ignore parse error
        }
      });
    } catch {
      // fallback
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [isOpen]);

  // Initialize default selections from available providers/agents
  useEffect(() => {
    if (providers.length > 0) {
      const activeProviders = providers.filter(p => p.enabled);
      const provA = activeProviders[0] || providers[0];
      const provB = activeProviders[1] || provA;

      if (!slotAProviderId && provA) {
        setSlotAProviderId(provA.id);
        const agentA = agents.find(a => a.providerId === provA.id);
        setSlotAModelId(agentA?.modelId || 'gpt-4o');
      }

      if (!slotBProviderId && provB) {
        setSlotBProviderId(provB.id);
        const agentB = agents.find(a => a.providerId === provB.id && a.modelId !== slotAModelId) || agents[0];
        setSlotBModelId(agentB?.modelId || 'claude-3-7-sonnet');
      }

      if (!evalTargetProviderId && provA) {
        setEvalTargetProviderId(provA.id);
        const agent = agents.find(a => a.providerId === provA.id);
        setEvalTargetModelId(agent?.modelId || 'gpt-4o');
      }

      if (!evalJudgeProviderId && provB) {
        setEvalJudgeProviderId(provB.id);
        const jAgent = agents.find(a => a.providerId === provB.id) || agents[0];
        setEvalJudgeModelId(jAgent?.modelId || 'claude-3-7-sonnet');
      }
    }
  }, [providers, agents, slotAProviderId, slotBProviderId, slotAModelId, evalTargetProviderId, evalJudgeProviderId]);

  useEffect(() => {
    if (isOpen) {
      fetchBenchmarksAndLeaderboard();
    }
  }, [isOpen]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleRunBenchmark = async () => {
    if (!prompt.trim()) {
      toast.warning('Silakan masukkan prompt pengujian terlebih dahulu.');
      return;
    }

    if (!slotAProviderId || !slotAModelId) {
      toast.warning('Pilih provider dan model untuk Slot A.');
      return;
    }

    setLoading(true);
    setResults({ A: null, B: null });
    setStreamOutputs({ A: '', B: '' });

    const targets: any[] = [
      {
        slotId: 'A',
        providerId: slotAProviderId,
        modelId: slotAModelId,
        temperature: slotATemp
      }
    ];

    if (isCompareMode && slotBProviderId && slotBModelId) {
      targets.push({
        slotId: 'B',
        providerId: slotBProviderId,
        modelId: slotBModelId,
        temperature: slotBTemp
      });
    }

    try {
      const res = await api.executePlayground({
        prompt: prompt.trim(),
        globalSystemPrompt: systemPrompt.trim(),
        targets
      });

      const newResults: Record<'A' | 'B', BenchmarkResult | null> = { A: null, B: null };
      res.results.forEach((r) => {
        if (r.slotId === 'A' || r.slotId === 'B') {
          newResults[r.slotId] = r;
        }
      });
      setResults(newResults);
      toast.success('Pengujian benchmark selesai dieksekusi.');
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengeksekusi benchmark.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyResult = (slot: 'A' | 'B', text?: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedSlot(slot);
    toast.success(`Output Slot ${slot} berhasil disalin ke clipboard.`);
    setTimeout(() => setCopiedSlot(null), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[#0B0F17] border border-cyan-500/30 rounded-2xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl shadow-cyan-950/40 overflow-hidden font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 sm:px-6 py-3 sm:py-4 border-b border-slate-800 bg-[#0E1424] gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                  AI Playground & Benchmark Sandbox
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  A/B Testing
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 hidden sm:block truncate">
                Bandingkan performa inferensi, latensi, dan token output antar model LLM secara berdampingan.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Tab Switcher: Sandbox vs LLM-as-a-Judge Arena */}
            <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('SANDBOX')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  activeTab === 'SANDBOX'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FlaskConical className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sandbox A/B</span>
                <span className="sm:hidden">A/B</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('ARENA');
                  fetchBenchmarksAndLeaderboard();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  activeTab === 'ARENA'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Judge Arena</span>
                <span className="sm:hidden">Arena</span>
              </button>
            </div>

            {activeTab === 'SANDBOX' && (
              <button
                type="button"
                onClick={() => setIsCompareMode(!isCompareMode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                  isCompareMode
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <Split className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isCompareMode ? '2 Model' : '1 Model'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Tutup (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {activeTab === 'SANDBOX' ? (
          <>
            {/* Collapsible System Prompt */}
            <div className="border-b border-slate-800 bg-slate-900/60 px-4 py-2 text-xs">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowSystemPrompt(!showSystemPrompt)}
              className="flex items-center gap-1.5 text-slate-400 hover:text-cyan-300 font-semibold transition"
            >
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span>System Prompt Global</span>
              {showSystemPrompt ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {/* Presets dropdown */}
            <div className="flex items-center gap-2 w-48 sm:w-56">
              <span className="text-[10px] text-slate-500 hidden sm:inline shrink-0">Preset:</span>
              <CustomSelect
                value=""
                onChange={(presetName) => {
                  const preset = PROMPT_PRESETS.find(p => p.name === presetName);
                  if (preset) setPrompt(preset.prompt);
                }}
                options={[
                  { value: '', label: 'Pilih Contoh Uji...' },
                  ...PROMPT_PRESETS.map((p) => ({ value: p.name, label: p.name }))
                ]}
                placeholder="Pilih Contoh Uji..."
              />
            </div>
          </div>

          {showSystemPrompt && (
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Instruksi sistem..."
              className="w-full mt-2 p-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono focus:border-cyan-500 focus:outline-none"
              rows={2}
            />
          )}
        </div>

        {/* Comparison Body: Slot A and Slot B */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {/* SLOT A */}
          <div className="flex flex-col bg-slate-950/70 border border-slate-800 rounded-xl p-3 sm:p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 font-bold text-xs flex items-center justify-center font-mono">
                  A
                </span>
                <span className="font-bold text-xs text-white">Target Model A</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-mono">Temp: {slotATemp}</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={slotATemp}
                  onChange={(e) => setSlotATemp(parseFloat(e.target.value))}
                  className="w-16 accent-cyan-400"
                />
              </div>
            </div>

            {/* Provider and Model selectors */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="block text-[10px] text-slate-500 font-semibold mb-1">Provider</label>
                <CustomSelect
                  value={slotAProviderId}
                  onChange={(val) => setSlotAProviderId(val)}
                  options={providers.map((p) => ({
                    value: p.id,
                    label: p.name,
                    description: p.providerType
                  }))}
                  placeholder="Pilih Provider..."
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 font-semibold mb-1">Model ID</label>
                <input
                  type="text"
                  value={slotAModelId}
                  onChange={(e) => setSlotAModelId(e.target.value)}
                  placeholder="e.g. gpt-4o, claude-3-7-sonnet"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-white font-mono"
                />
              </div>
            </div>

            {/* Output Display Area */}
            <div className="flex-1 flex flex-col min-h-[200px] bg-[#080C14] border border-slate-850 rounded-lg p-3">
              <div className="flex items-center justify-between text-[11px] pb-2 border-b border-slate-900 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-mono">Output:</span>
                  {results.A && (
                    <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      results.A.success ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                    }`}>
                      {results.A.status}
                    </span>
                  )}
                </div>

                {results.A && (
                  <div className="flex items-center gap-2 text-slate-400 text-[10px] font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-cyan-400" />
                      {results.A.durationMs}ms
                    </span>
                    <span>{results.A.tokensUsed?.totalTokens || 0} tok</span>
                    <button
                      onClick={() => handleCopyResult('A', results.A?.outputResult)}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                      title="Salin hasil"
                    >
                      {copiedSlot === 'A' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto text-xs font-mono text-slate-200 leading-relaxed whitespace-pre-wrap select-text">
                {loading ? (
                  streamOutputs.A ? (
                    <div>
                      {streamOutputs.A}
                      <span className="inline-block w-1.5 h-3.5 ml-1 bg-cyan-400 animate-pulse align-middle" />
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-500 text-xs gap-2">
                      <Zap className="w-4 h-4 text-cyan-400 animate-spin" />
                      <span>Inference sedang berjalan...</span>
                    </div>
                  )
                ) : results.A ? (
                  results.A.outputResult || (
                    <span className="text-rose-400">{results.A.errorMessage || 'Tidak ada output'}</span>
                  )
                ) : (
                  <span className="text-slate-600 italic">Tekan "Jalankan Benchmark" untuk melihat hasil inferensi.</span>
                )}
              </div>
            </div>
          </div>

          {/* SLOT B */}
          {isCompareMode ? (
            <div className="flex flex-col bg-slate-950/70 border border-slate-800 rounded-xl p-3 sm:p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 font-bold text-xs flex items-center justify-center font-mono">
                    B
                  </span>
                  <span className="font-bold text-xs text-white">Target Model B</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-mono">Temp: {slotBTemp}</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={slotBTemp}
                    onChange={(e) => setSlotBTemp(parseFloat(e.target.value))}
                    className="w-16 accent-purple-400"
                  />
                </div>
              </div>

              {/* Provider and Model selectors */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold mb-1">Provider</label>
                  <CustomSelect
                    value={slotBProviderId}
                    onChange={(val) => setSlotBProviderId(val)}
                    options={providers.map((p) => ({
                      value: p.id,
                      label: p.name,
                      description: p.providerType
                    }))}
                    placeholder="Pilih Provider..."
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 font-semibold mb-1">Model ID</label>
                  <input
                    type="text"
                    value={slotBModelId}
                    onChange={(e) => setSlotBModelId(e.target.value)}
                    placeholder="e.g. gemini-2.5-flash, deepseek-r1"
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Output Display Area */}
              <div className="flex-1 flex flex-col min-h-[200px] bg-[#080C14] border border-slate-850 rounded-lg p-3">
                <div className="flex items-center justify-between text-[11px] pb-2 border-b border-slate-900 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-mono">Output:</span>
                    {results.B && (
                      <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        results.B.success ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                      }`}>
                        {results.B.status}
                      </span>
                    )}
                  </div>

                  {results.B && (
                    <div className="flex items-center gap-2 text-slate-400 text-[10px] font-mono">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-purple-400" />
                        {results.B.durationMs}ms
                      </span>
                      <span>{results.B.tokensUsed?.totalTokens || 0} tok</span>
                      <button
                        onClick={() => handleCopyResult('B', results.B?.outputResult)}
                        className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                        title="Salin hasil"
                      >
                        {copiedSlot === 'B' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto text-xs font-mono text-slate-200 leading-relaxed whitespace-pre-wrap select-text">
                  {loading ? (
                    streamOutputs.B ? (
                      <div>
                        {streamOutputs.B}
                        <span className="inline-block w-1.5 h-3.5 ml-1 bg-purple-400 animate-pulse align-middle" />
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-500 text-xs gap-2">
                        <Zap className="w-4 h-4 text-purple-400 animate-spin" />
                        <span>Inference sedang berjalan...</span>
                      </div>
                    )
                  ) : results.B ? (
                    results.B.outputResult || (
                      <span className="text-rose-400">{results.B.errorMessage || 'Tidak ada output'}</span>
                    )
                  ) : (
                    <span className="text-slate-600 italic">Tekan "Jalankan Benchmark" untuk melihat hasil inferensi.</span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center bg-slate-950/40 border border-dashed border-slate-800 rounded-xl p-8 text-center text-slate-500 text-xs">
              <Split className="w-8 h-8 text-slate-600 mb-2" />
              <p>Mode komparasi dinonaktifkan.</p>
              <button
                onClick={() => setIsCompareMode(true)}
                className="mt-2 text-cyan-400 hover:underline font-semibold"
              >
                Aktifkan perbandingan 2 model
              </button>
            </div>
          )}
        </div>

        {/* Bottom Input & Benchmark Execution Bar */}
        <div className="p-3 sm:p-4 border-t border-slate-800 bg-[#0E1424] flex items-center gap-2 sm:gap-3">
          <div className="flex-1 relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Masukkan instruksi prompt pengujian..."
              rows={2}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none font-mono"
            />
          </div>

          <button
            type="button"
            onClick={handleRunBenchmark}
            disabled={loading}
            className="flex items-center gap-2 px-4 sm:px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/25 transition active:scale-95 disabled:opacity-50 shrink-0"
          >
            <Play className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Menguji...' : 'Jalankan Benchmark'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs transition shrink-0"
          >
            Tutup
          </button>
        </div>
      </>
    ) : (
      /* TAB 2: LLM-as-a-Judge Benchmark Arena */
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* Top Config Row: Select Benchmark & Model Target */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#0E1424] border border-amber-500/30 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm sm:text-base font-bold text-white">
                Automated Agent Evals & Benchmark Arena
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">Metodologi:</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                LLM-as-a-Judge (Rubrik 4 Metrik)
              </span>
            </div>
          </div>

          {/* Benchmark Suite Picker */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">Pilih Test Case Standar:</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {benchmarks.map((b) => {
                const isSelected = selectedBenchmarkId === b.id;
                const catBadgeColor: Record<EvalCategory, string> = {
                  CODING: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                  ARCHITECTURE: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
                  SECURITY: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
                  ANTI_HALLUCINATION: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                };

                return (
                  <div
                    key={b.id}
                    onClick={() => setSelectedBenchmarkId(b.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/10'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${catBadgeColor[b.category] || 'bg-slate-800 text-slate-300'}`}>
                      {b.category}
                    </span>
                    <h4 className="text-xs font-bold text-white mt-1.5 line-clamp-1">{b.title}</h4>
                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">{b.prompt}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Target & Judge Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800/80 items-end">
            <div>
              <label className="text-xs text-slate-400 block mb-1 font-medium">Model yang Dievaluasi (Target) *</label>
              <CustomSelect
                value={evalTargetProviderId}
                onChange={(val) => {
                  setEvalTargetProviderId(val);
                  const agent = agents.find((a) => a.providerId === val);
                  if (agent) setEvalTargetModelId(agent.modelId);
                }}
                options={providers.map((p) => ({
                  value: p.id,
                  label: p.name,
                  badge: p.providerType,
                  badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                }))}
              />
              <input
                type="text"
                value={evalTargetModelId}
                onChange={(e) => setEvalTargetModelId(e.target.value)}
                placeholder="Model ID (cth: gpt-4o, claude-3-7-sonnet)"
                className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1 font-medium">Evaluator Model (Judge LLM)</label>
              <CustomSelect
                value={evalJudgeProviderId}
                onChange={(val) => {
                  setEvalJudgeProviderId(val);
                  const agent = agents.find((a) => a.providerId === val);
                  if (agent) setEvalJudgeModelId(agent.modelId);
                }}
                options={[
                  { value: '', label: 'Automated Rubric (Fallback)', badge: 'RUBRIC', badgeColor: 'bg-slate-800 text-slate-400' },
                  ...providers.map((p) => ({
                    value: p.id,
                    label: p.name,
                    badge: p.providerType,
                    badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                  }))
                ]}
              />
              <input
                type="text"
                value={evalJudgeModelId}
                onChange={(e) => setEvalJudgeModelId(e.target.value)}
                placeholder="Judge Model ID (opsional)"
                className="w-full mt-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleRunEval}
                disabled={evalRunLoading || !selectedBenchmarkId || !evalTargetProviderId}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Scale className={`w-4 h-4 ${evalRunLoading ? 'animate-spin' : ''}`} />
                <span>{evalRunLoading ? 'Mengevaluasi...' : 'Jalankan Uji Benchmark'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Evaluation Scoreboard Outcome */}
        {lastEvalResult && (
          <div className="p-4 sm:p-5 rounded-2xl bg-[#0E1424] border border-slate-800 space-y-4 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                <h4 className="text-sm font-bold text-white">Hasil Penilaian LLM-as-a-Judge</h4>
                <span className="text-xs font-mono text-cyan-400">({lastEvalResult.modelName})</span>
              </div>
              <span className="text-[11px] text-slate-500">
                Evaluator: <strong className="text-slate-300 font-mono">{lastEvalResult.judgeModel}</strong>
              </span>
            </div>

            {/* KPI Metrics Gauges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Correctness</span>
                <div className="text-2xl font-black text-emerald-400">{lastEvalResult.judgeScoreCorrectness}%</div>
                <span className="text-[10px] text-slate-500">Ketepatan Teknis</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Faithfulness</span>
                <div className="text-2xl font-black text-cyan-400">{lastEvalResult.judgeScoreFaithfulness}%</div>
                <span className="text-[10px] text-slate-500">Anti-Halusinasi</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Latency</span>
                <div className="text-2xl font-black text-amber-400">{lastEvalResult.latencyMs} ms</div>
                <span className="text-[10px] text-slate-500">{lastEvalResult.tokensUsed} tokens</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Estimated Cost</span>
                <div className="text-2xl font-black text-indigo-400">${lastEvalResult.costUsd.toFixed(4)}</div>
                <span className="text-[10px] text-slate-500">Inferensi & Tokens</span>
              </div>
            </div>

            {/* Judge Verdict Box */}
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 leading-relaxed">
              <strong className="block mb-1 text-amber-300 font-bold uppercase tracking-wider text-[10px]">
                Ulasan & Kritik Konstruktif Evaluator:
              </strong>
              {lastEvalResult.judgeVerdict}
            </div>

            {/* Collapsible Model Output */}
            <details className="text-xs group">
              <summary className="cursor-pointer text-slate-400 hover:text-white font-semibold py-1">
                Lihat Jawaban Lengkap Model ({lastEvalResult.modelName})
              </summary>
              <pre className="mt-2 p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 overflow-x-auto max-h-60 whitespace-pre-wrap">
                {lastEvalResult.agentOutput}
              </pre>
            </details>
          </div>
        )}

        {/* Model Arena Leaderboard Table */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[#0E1424] border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Leaderboard Peringkat Model LLM ({leaderboard.length} Model)
              </h4>
            </div>
            <button
              type="button"
              onClick={fetchLeaderboard}
              disabled={loadingLeaderboard}
              className="p-1 text-slate-400 hover:text-white"
              title="Segarkan Leaderboard"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingLeaderboard ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loadingLeaderboard && leaderboard.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">Menghitung skor leaderboard...</div>
          ) : leaderboard.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">Belum ada hasil evaluasi yang tercatat di arena.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase font-bold">
                    <th className="py-2 px-3">Rank</th>
                    <th className="py-2 px-3">Model</th>
                    <th className="py-2 px-3 text-center">Total Uji</th>
                    <th className="py-2 px-3 text-center">Correctness</th>
                    <th className="py-2 px-3 text-center">Faithfulness</th>
                    <th className="py-2 px-3 text-center">Skor Keseluruhan</th>
                    <th className="py-2 px-3 text-center">Rata-rata Latensi</th>
                    <th className="py-2 px-3 text-right">Total Biaya</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {leaderboard.map((entry, idx) => (
                    <tr key={entry.modelName} className="hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3">
                        <span
                          className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-bold ${
                            idx === 0
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : idx === 1
                              ? 'bg-slate-600 text-slate-200'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {idx + 1}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-200">{entry.modelName}</td>
                      <td className="py-2.5 px-3 text-center text-slate-400">{entry.totalRuns}x</td>
                      <td className="py-2.5 px-3 text-center text-emerald-400">{entry.avgCorrectness}%</td>
                      <td className="py-2.5 px-3 text-center text-cyan-400">{entry.avgFaithfulness}%</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          {entry.overallScore} / 100
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-400">{entry.avgLatencyMs} ms</td>
                      <td className="py-2.5 px-3 text-right text-indigo-300">${entry.totalCostUsd.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )}
      </div>
    </div>
  );
};
