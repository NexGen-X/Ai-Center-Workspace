import React, { useState, useEffect } from 'react';
import {
  X,
  Workflow,
  Sparkles,
  ArrowRight,
  Play,
  CheckCircle2,
  Clock,
  AlertCircle,
  Cpu,
  Bot,
  Copy,
  Check,
  Layers,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { AIAgent, Project, PipelineTemplate, PipelineExecutionResult } from '../../../../shared/types.js';
import { api } from '../../services/api.js';
import { useFeedback } from '../../components/common/FeedbackContext.js';
import { CustomSelect } from '../../components/common/CustomSelect.js';

interface PipelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  agents: AIAgent[];
  projects: Project[];
  onPipelineCompleted?: () => void;
}

export const PipelineModal: React.FC<PipelineModalProps> = ({
  isOpen,
  onClose,
  agents,
  projects,
  onPipelineCompleted
}) => {
  const { toast } = useFeedback();

  const [templates, setTemplates] = useState<PipelineTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('feature-swarm');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState('');

  const [isDecomposing, setIsDecomposing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [decomposedStages, setDecomposedStages] = useState<any[]>([]);
  const [expandedStages, setExpandedStages] = useState<Record<number, boolean>>({});

  const [executionResult, setExecutionResult] = useState<PipelineExecutionResult | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.getPipelineTemplates()
        .then((res) => {
          setTemplates(res.templates || []);
          if (res.templates?.length > 0 && !selectedTemplateId) {
            setSelectedTemplateId(res.templates[0].id);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApplyPreset = (text: string) => {
    setObjective(text);
    if (!title) {
      setTitle(text.slice(0, 45));
    }
  };

  const handleDecompose = async () => {
    if (!objective.trim()) {
      toast.error('Silakan isi tujuan/objektif tugas terlebih dahulu.');
      return;
    }

    setIsDecomposing(true);
    setExecutionResult(null);
    try {
      const res = await api.decomposePipeline({
        title: title || undefined,
        objective,
        templateId: selectedTemplateId,
        projectId: selectedProjectId || undefined
      });

      setDecomposedStages(res.stages || []);
      // Expand first stage by default
      setExpandedStages({ 0: true });
      toast.success(`Dekomposisi berhasil: ${res.stages.length} tahap kolaborasi terbentuk.`);
    } catch (err: any) {
      toast.error(err.message || 'Gagal mendekomposisi swarm pipeline.');
    } finally {
      setIsDecomposing(false);
    }
  };

  const handleExecutePipeline = async () => {
    if (decomposedStages.length === 0) {
      toast.error('Belum ada tahap yang didekomposisi.');
      return;
    }

    setIsExecuting(true);
    setExecutionResult(null);
    try {
      const res = await api.executePipeline({
        title: title || `Swarm: ${objective.slice(0, 45)}`,
        objective,
        projectId: selectedProjectId || undefined,
        stages: decomposedStages
      });

      setExecutionResult(res);
      if (res.status === 'SUCCESS') {
        toast.success(`Pipeline selesai dengan sukses dalam ${(res.totalDurationMs / 1000).toFixed(2)} detik!`);
      } else {
        toast.warning(`Pipeline selesai dengan catatan (${res.status}).`);
      }

      if (onPipelineCompleted) {
        onPipelineCompleted();
      }
    } catch (err: any) {
      toast.error(err.message || 'Eksekusi swarm pipeline gagal.');
    } finally {
      setIsExecuting(false);
    }
  };

  const toggleStageExpand = (idx: number) => {
    setExpandedStages((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const updateStageAgent = (stageIdx: number, newAgentId: string) => {
    const targetAgent = agents.find((a) => a.id === newAgentId);
    setDecomposedStages((prev) =>
      prev.map((st, i) =>
        i === stageIdx
          ? {
              ...st,
              agentId: newAgentId,
              agentName: targetAgent?.name || st.agentName
            }
          : st
      )
    );
  };

  const handleCopySummary = () => {
    if (!executionResult?.finalSummary) return;
    navigator.clipboard.writeText(executionResult.finalSummary);
    setCopiedSummary(true);
    toast.info('Laporan ringkasan disalin ke clipboard.');
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-800 bg-slate-800/40 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 shrink-0">
              <Workflow className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide truncate">
                  Multi-Agent Swarm Pipeline
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                  SWARM DECOMPOSITION
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 hidden sm:block truncate">
                Rantai kolaborasi agen otonom: dekomposisi tujuan, serah terima data bertahap, dan verifikasi QA otomatis
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Top Configuration Card */}
          <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/60 space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1 font-medium">Pilih Template Swarm</label>
                <CustomSelect
                  value={selectedTemplateId}
                  onChange={(val) => setSelectedTemplateId(val)}
                  options={templates.map((tpl) => ({
                    value: tpl.id,
                    label: tpl.name,
                    badge: `${tpl.stages.length} Tahap`,
                    badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                  }))}
                  placeholder="Pilih template swarm..."
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-medium">Kaitkan ke Proyek (Opsional)</label>
                <CustomSelect
                  value={selectedProjectId}
                  onChange={(val) => setSelectedProjectId(val)}
                  options={[
                    { value: '', label: '(Tanpa Proyek / Standalone Swarm)' },
                    ...projects.map((p) => ({ value: p.id, label: p.name }))
                  ]}
                  placeholder="Pilih Proyek..."
                />
              </div>
            </div>

            {/* Objective input */}
            <div className="text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-slate-300 font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  Objektif / Instruksi Tingkat Tinggi (High-Level Goal) *
                </label>
                <span className="text-[10px] text-slate-500">
                  {objective.length} karakter
                </span>
              </div>
              <textarea
                rows={3}
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="Deskripsikan fitur atau masalah yang ingin dipecahkan oleh tim AI (contoh: Rancang dan implementasikan fitur autentikasi dua faktor TOTP lengkap dengan schema DB, controller, dan audit keamanan)..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-purple-400 leading-relaxed font-sans"
              />

              {/* Preset prompt pills */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                <span className="text-[10px] text-slate-500 uppercase font-mono">Preset:</span>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('Rancang arsitektur microservice order payment, buat struktur event-driven, dan audit proteksi idempotent')}
                  className="px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-[10px] border border-slate-700/60 transition"
                >
                  Payment Microservice
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('Investigasi potensi race-condition pada saldo dompet pengguna dan buat patch concurrency lock')}
                  className="px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-[10px] border border-slate-700/60 transition"
                >
                  Race Condition Bugfix
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyPreset('Audit seluruh endpoint REST API terhadap ancaman SSRF, implementasikan CIDR blocklist, dan verifikasi validasi')}
                  className="px-2 py-0.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-[10px] border border-slate-700/60 transition"
                >
                  SSRF Defense Hardening
                </button>
              </div>
            </div>

            {/* Decompose trigger button */}
            <div className="flex justify-end pt-1">
              <button
                onClick={handleDecompose}
                disabled={isDecomposing || !objective.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/30 transition disabled:opacity-50"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isDecomposing ? 'animate-spin' : ''}`} />
                <span>{isDecomposing ? 'Mendekomposisi Swarm...' : '⚡ Dekomposisi Otomatis ke Tim AI'}</span>
              </button>
            </div>
          </div>

          {/* Decomposed Pipeline Stages Flow */}
          {decomposedStages.length > 0 && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" />
                  Rantai Alur Kerja ({decomposedStages.length} Tahap Berurutan)
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  Output dari setiap tahap otomatis dialirkan ke tahap berikutnya
                </span>
              </div>

              {/* Visual Pipeline Stage Graph Cards */}
              <div className="space-y-3">
                {decomposedStages.map((stage, idx) => {
                  const isExpanded = !!expandedStages[idx];
                  const execStage = executionResult?.stages?.find((s) => s.stageId === stage.stageId);
                  const isDone = execStage?.status === 'COMPLETED';
                  const isFailed = execStage?.status === 'FAILED';
                  const isStageRunning = isExecuting && !isDone && !isFailed;

                  return (
                    <div
                      key={stage.stageId || idx}
                      className={`rounded-xl border transition-all ${
                        isDone
                          ? 'bg-slate-900/90 border-emerald-500/40'
                          : isFailed
                          ? 'bg-slate-900/90 border-rose-500/40'
                          : isStageRunning
                          ? 'bg-slate-900/90 border-purple-500/60 shadow-lg shadow-purple-500/10'
                          : 'bg-slate-900/60 border-slate-800'
                      }`}
                    >
                      {/* Stage Card Header */}
                      <div className="p-3.5 flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Stage Number Badge */}
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                              isDone
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : isFailed
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                                : 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
                            }`}
                          >
                            {isDone ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-white">
                                {stage.stageName}
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                {stage.role}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 block truncate">
                              Petugas: <strong className="text-cyan-300">{stage.agentName}</strong>
                            </span>
                          </div>
                        </div>

                        {/* Stage Controls: Assign Agent Dropdown & Expand */}
                        <div className="flex items-center gap-2">
                          <div className="w-56">
                            <CustomSelect
                              disabled={isExecuting}
                              value={stage.agentId}
                              onChange={(newAgentId) => updateStageAgent(idx, newAgentId)}
                              options={agents.map((ag) => ({
                                value: ag.id,
                                label: `🤖 ${ag.name}`,
                                description: ag.role
                              }))}
                              placeholder="Pilih Agen..."
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleStageExpand(idx)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                            title="Tampilkan Detail Template"
                          >
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Expandable details */}
                      {isExpanded && (
                        <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-800/80 space-y-2 text-xs">
                          <div>
                            <span className="text-[10px] uppercase font-mono text-slate-500 block mb-0.5">
                              Prompt Template Alur
                            </span>
                            <pre className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed">
                              {stage.promptTemplate}
                            </pre>
                          </div>

                          {/* If executed, show stage output */}
                          {execStage && (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-bold text-emerald-400">
                                  Hasil Eksekusi Tahap {idx + 1}
                                </span>
                                <span className="text-slate-400 font-mono">
                                  Durasi: {execStage.durationMs}ms • Tokens: {execStage.tokensUsed || 0}
                                </span>
                              </div>
                              <pre className="p-2.5 bg-[#05070A] rounded-lg border border-slate-800 text-[11px] font-mono text-cyan-200 whitespace-pre-wrap max-h-56 overflow-y-auto leading-relaxed">
                                {execStage.output || execStage.error || '(Tanpa output)'}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Execution CTA button */}
              <div className="flex items-center justify-between pt-2 flex-wrap gap-2">
                <span className="text-xs text-slate-400">
                  Siap mengeksekusi {decomposedStages.length} tahap secara berantai.
                </span>
                <button
                  onClick={handleExecutePipeline}
                  disabled={isExecuting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition disabled:opacity-50 active:scale-95"
                >
                  <Play className={`w-4 h-4 ${isExecuting ? 'animate-spin' : 'fill-white'}`} />
                  <span>{isExecuting ? 'Sedang Mengeksekusi Pipeline Swarm...' : '🚀 Jalankan Swarm Pipeline Sekarang'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Final Aggregated Summary Report Card */}
          {executionResult && (
            <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/40 space-y-3 animate-in fade-in duration-300">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <h4 className="text-sm font-bold text-white">
                    Laporan Eksekusi Swarm Pipeline Selesai ({executionResult.status})
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-400">
                    Total: {(executionResult.totalDurationMs / 1000).toFixed(2)}s
                  </span>
                  <button
                    onClick={handleCopySummary}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition"
                  >
                    {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                    <span>{copiedSummary ? 'Tersalin' : 'Salin Laporan'}</span>
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 max-h-72 overflow-y-auto">
                <pre className="text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {executionResult.finalSummary}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex justify-between items-center text-xs">
          <span className="text-slate-500 font-mono">
            Autonomous Swarm Orchestration Engine
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
