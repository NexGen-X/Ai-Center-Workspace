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
  AlertCircle
} from 'lucide-react';
import { ModelProviderConfig, AIAgent } from '../../../../shared/types.js';
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
  const [isCompareMode, setIsCompareMode] = useState<boolean>(true);
  const [prompt, setPrompt] = useState<string>('Jelaskan keunggulan arsitektur event-driven microservices untuk sistem AI Agent Command Center.');
  const [systemPrompt, setSystemPrompt] = useState<string>('You are an expert AI systems architect.');
  const [showSystemPrompt, setShowSystemPrompt] = useState<boolean>(false);

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
  const [copiedSlot, setCopiedSlot] = useState<'A' | 'B' | null>(null);

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
    }
  }, [providers, agents, slotAProviderId, slotBProviderId, slotAModelId]);

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
            {/* Compare Mode Toggle */}
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
              <span className="hidden sm:inline">{isCompareMode ? 'Mode Komparasi (2 Model)' : 'Mode Tunggal'}</span>
            </button>

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
                  <div className="h-full flex items-center justify-center text-slate-500 text-xs gap-2">
                    <Zap className="w-4 h-4 text-cyan-400 animate-spin" />
                    <span>Inference sedang berjalan...</span>
                  </div>
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
                    <div className="h-full flex items-center justify-center text-slate-500 text-xs gap-2">
                      <Zap className="w-4 h-4 text-purple-400 animate-spin" />
                      <span>Inference sedang berjalan...</span>
                    </div>
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
      </div>
    </div>
  );
};
