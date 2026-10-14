import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Play,
  CheckCircle2,
  Clock,
  AlertCircle,
  Bot,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  GitBranch,
  Network,
  ArrowRight,
  Activity,
  Layers,
  StopCircle,
  MessageSquare,
  FileText,
  Share2
} from 'lucide-react';
import {
  AIAgent,
  SwarmMission,
  SwarmSubtask,
  SwarmMessage,
  SwarmMissionStatus
} from '../../../../shared/types.js';
import { api } from '../../services/api.js';
import { useFeedback } from '../../components/common/FeedbackContext.js';

interface SwarmMissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  agents: AIAgent[];
  onMissionLaunched?: () => void;
}

export const SwarmMissionModal: React.FC<SwarmMissionModalProps> = ({
  isOpen,
  onClose,
  agents,
  onMissionLaunched
}) => {
  const { toast } = useFeedback();

  // Active Tab: 'planner' | 'monitor' | 'feed' | 'archive'
  const [activeTab, setActiveTab] = useState<'planner' | 'monitor' | 'feed' | 'archive'>('planner');

  // Planner form state
  const [objective, setObjective] = useState('');
  const [title, setTitle] = useState('');
  const [isPlanning, setIsPlanning] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [plannedSubtasks, setPlannedSubtasks] = useState<SwarmSubtask[]>([]);
  const [coordinatorAgent, setCoordinatorAgent] = useState<AIAgent | null>(null);

  // Active & selected mission state
  const [activeMission, setActiveMission] = useState<SwarmMission | null>(null);
  const [missionMessages, setMissionMessages] = useState<SwarmMessage[]>([]);
  const [pastMissions, setPastMissions] = useState<SwarmMission[]>([]);
  const [loadingPastMissions, setLoadingPastMissions] = useState(false);

  // Subtask accordion expansion in monitor
  const [expandedSubtasks, setExpandedSubtasks] = useState<Record<string, boolean>>({});
  const [copiedSynthesis, setCopiedSynthesis] = useState(false);

  // Chat feed scroll ref
  const feedEndRef = useRef<HTMLDivElement>(null);

  // Load past missions when modal opens or archive tab activated
  const fetchPastMissions = async () => {
    setLoadingPastMissions(true);
    try {
      const res = await api.getSwarmMissions();
      setPastMissions(res.missions || []);
    } catch (err: any) {
      console.error('Failed to load past missions:', err);
    } finally {
      setLoadingPastMissions(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPastMissions();
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Auto-scroll inter-agent feed when new messages arrive
  useEffect(() => {
    if (activeTab === 'feed') {
      feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [missionMessages, activeTab]);

  // SSE Listener for real-time mission updates
  useEffect(() => {
    if (!isOpen) return;

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/realtime');

      eventSource.addEventListener('swarm.mission_started', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data.mission) {
            setActiveMission(data.mission);
          }
        } catch {}
      });

      eventSource.addEventListener('swarm.subtask_dispatched', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setActiveMission(prev => {
            if (!prev || prev.id !== data.missionId) return prev;
            const updated = prev.subtasks.map(st =>
              st.id === data.subtask.id ? data.subtask : st
            );
            return { ...prev, subtasks: updated };
          });
        } catch {}
      });

      eventSource.addEventListener('swarm.agent_handoff', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          const handoffMsg: SwarmMessage = {
            id: `handoff-${Date.now()}`,
            missionId: data.missionId,
            fromAgentId: data.fromAgentId,
            fromAgentName: data.fromAgentName,
            toAgentId: data.toAgentId,
            toAgentName: data.toAgentName,
            messageType: 'HANDOFF',
            content: data.summary,
            createdAt: new Date().toISOString()
          };
          setMissionMessages(prev => [...prev, handoffMsg]);
        } catch {}
      });

      eventSource.addEventListener('swarm.subtask_completed', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setActiveMission(prev => {
            if (!prev || prev.id !== data.missionId) return prev;
            const updated = prev.subtasks.map(st =>
              st.id === data.subtask.id ? data.subtask : st
            );
            return { ...prev, subtasks: updated };
          });

          // Also reload messages to get the feedback message
          if (data.missionId) {
            api.getSwarmMission(data.missionId).then(res => {
              setMissionMessages(res.messages || []);
            }).catch(() => {});
          }
        } catch {}
      });

      eventSource.addEventListener('swarm.mission_completed', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setActiveMission(prev => {
            if (!prev || prev.id !== data.missionId) return prev;
            return {
              ...prev,
              status: data.status,
              totalDurationMs: data.totalDurationMs,
              finalSynthesis: data.finalSynthesis
            };
          });
          fetchPastMissions();
          toast.success(`Misi Swarm telah selesai (${data.status})!`);
        } catch {}
      });

      eventSource.addEventListener('swarm.mission_cancelled', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setActiveMission(prev => {
            if (!prev || prev.id !== data.missionId) return prev;
            return { ...prev, status: 'CANCELLED' };
          });
          toast.info('Misi Swarm dibatalkan.');
        } catch {}
      });
    } catch {}

    return () => {
      eventSource?.close();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Preset prompts
  const presets = [
    {
      title: 'Full-Stack Security Audit & Hardening',
      desc: 'Analisis celah injeksi, rancang mitigasi, implementasi sanitasi input, dan verifikasi batas tepi.',
      prompt: 'Lakukan audit keamanan menyeluruh terhadap sistem otentikasi dan API Command Center. Identifikasi potensi SSRF, broken access control, dan data leak. Buat rancangan patch hardening, implementasikan perbaikan, serta lakukan uji penetrasi empiris.'
    },
    {
      title: 'Autonomous Microservice & API Scaffold',
      desc: 'Rancang spesifikasi OpenAPI, scaffold service modular, validasi integritas schema DB.',
      prompt: 'Rancang dan implementasikan microservice telemetri baru untuk mengumpulkan metrik GPU & RAM secara real-time. Tentukan kontrak endpoint REST, bangun handler yang efisien, dan sediakan acceptance test otomatis.'
    },
    {
      title: 'Incident Triage & Root-Cause Patch',
      desc: 'Diagnosis anomali runtime, investigasi log stack trace, terbitkan hotfix, dan verifikasi regresi.',
      prompt: 'Terjadi anomali timeout koneksi pada salah satu model provider lokal saat konkurensi tinggi. Lakukan root cause analysis pada adapter pooling, buat skenario reproduksi, berikan patch mitigasi circuit breaker, dan verifikasi kestabilan.'
    }
  ];

  const handleApplyPreset = (prompt: string, presetTitle: string) => {
    setObjective(prompt);
    setTitle(presetTitle);
  };

  // Plan dynamic DAG
  const handleGeneratePlan = async () => {
    if (!objective.trim()) {
      toast.error('Silakan isi objektif misi terlebih dahulu.');
      return;
    }

    setIsPlanning(true);
    try {
      const plan = await api.planSwarm(objective.trim());
      setPlannedSubtasks(plan.subtasks || []);
      setCoordinatorAgent(plan.coordinatorAgent);
      if (!title) {
        setTitle(plan.title);
      }
      toast.success('Rencana Dynamic DAG berhasil didekomposisi oleh Lead Coordinator!');
    } catch (err: any) {
      toast.error(err.message || 'Gagal merancang dynamic DAG swarm.');
    } finally {
      setIsPlanning(false);
    }
  };

  // Dispatch swarm mission
  const handleDispatchSwarm = async () => {
    if (!objective.trim()) {
      toast.error('Silakan isi objektif misi terlebih dahulu.');
      return;
    }

    setIsDispatching(true);
    try {
      const mission = await api.dispatchSwarm({
        objective: objective.trim(),
        title: title.trim() || undefined,
        subtasks: plannedSubtasks.length > 0 ? plannedSubtasks : undefined,
        coordinatorAgentId: coordinatorAgent?.id
      });

      setActiveMission(mission);
      setActiveTab('monitor');
      onMissionLaunched?.();
      toast.success('🚀 Autonomous Multi-Agent Swarm berhasil diluncurkan!');

      // Load initial messages
      api.getSwarmMission(mission.id).then(res => {
        setMissionMessages(res.messages || []);
      }).catch(() => {});
    } catch (err: any) {
      toast.error(err.message || 'Gagal meluncurkan misi swarm.');
    } finally {
      setIsDispatching(false);
    }
  };

  // Cancel mission
  const handleCancelMission = async () => {
    if (!activeMission) return;
    try {
      await api.cancelSwarmMission(activeMission.id);
      toast.info('Permintaan pembatalan misi telah dikirim.');
    } catch (err: any) {
      toast.error(err.message || 'Gagal membatalkan misi.');
    }
  };

  // View past mission
  const handleSelectPastMission = async (m: SwarmMission) => {
    try {
      const res = await api.getSwarmMission(m.id);
      setActiveMission(res.mission);
      setMissionMessages(res.messages || []);
      setActiveTab('monitor');
    } catch (err: any) {
      toast.error(err.message || 'Gagal memuat data misi arsip.');
    }
  };

  // Toggle subtask accordion
  const toggleSubtaskAccordion = (id: string) => {
    setExpandedSubtasks(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Copy final synthesis
  const handleCopySynthesis = () => {
    if (!activeMission?.finalSynthesis) return;
    navigator.clipboard.writeText(activeMission.finalSynthesis);
    setCopiedSynthesis(true);
    setTimeout(() => setCopiedSynthesis(false), 2000);
    toast.success('Laporan sintesis disalin ke clipboard!');
  };

  // Calculations for progress
  const totalSubtasks = activeMission?.subtasks?.length || 0;
  const completedSubtasks = activeMission?.subtasks?.filter(s => s.status === 'COMPLETED').length || 0;
  const progressPercent = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-[#0f172a] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/80 bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Network className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Autonomous Multi-Agent Swarm & Hierarchical Delegation Mesh
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Dynamic DAG
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Dekomposisi tugas otonom, koordinasi multi-spesialis terdistribusi, dan serah terima konteks antar-agen real-time.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-5 border-b border-slate-800 bg-slate-900/60 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('planner')}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'planner'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Perencana Misi (DAG Planner)</span>
          </button>

          <button
            onClick={() => setActiveTab('monitor')}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'monitor'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Monitor DAG Real-Time</span>
            {activeMission && activeMission.status === 'EXECUTING' && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('feed')}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'feed'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Transkrip Handoff Antar-Agen</span>
            {missionMessages.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-indigo-300 font-mono">
                {missionMessages.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('archive');
              fetchPastMissions();
            }}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'archive'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Arsip Misi & Sintesis</span>
            {pastMissions.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-400 font-mono">
                {pastMissions.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* TAB 1: PLANNER & DAG BUILDER */}
          {activeTab === 'planner' && (
            <div className="space-y-5">
              {/* Objective Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                  <span>Tujuan / Objektif Misi (Instruksi Bebas)</span>
                  <span className="text-[11px] font-normal text-slate-400">
                    Coordinator Agent akan memecah instruksi ini menjadi DAG subtugas otonom
                  </span>
                </label>
                <textarea
                  value={objective}
                  onChange={e => setObjective(e.target.value)}
                  placeholder="Contoh: Rancang sistem audit keamanan API terintegrasi, temukan celah, implementasikan patch, dan buat pengujian otomatis..."
                  className="w-full h-28 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder:text-slate-500 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition resize-none leading-relaxed"
                />
              </div>

              {/* Title Input (Optional) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  Judul Misi (Opsional)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Dihasilkan otomatis jika dibiarkan kosong"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder:text-slate-500 text-xs focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              {/* Quick Presets */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Preset Misi Populer:
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {presets.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPreset(p.prompt, p.title)}
                      className="p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 text-left transition group space-y-1"
                    >
                      <div className="text-xs font-bold text-slate-200 group-hover:text-indigo-400 transition flex items-center justify-between">
                        <span>{p.title}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition" />
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                        {p.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Plan Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={handleGeneratePlan}
                  disabled={isPlanning || !objective.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-indigo-300 text-xs font-semibold border border-indigo-500/30 transition"
                >
                  <Sparkles className={`w-4 h-4 ${isPlanning ? 'animate-spin' : ''}`} />
                  <span>{isPlanning ? 'Menganalisis & Mendekomposisi...' : '✦ Rancang Dynamic DAG (Preview)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDispatchSwarm}
                  disabled={isDispatching || !objective.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition active:scale-95 disabled:opacity-50"
                >
                  <Play className={`w-4 h-4 ${isDispatching ? 'animate-spin' : 'fill-white'}`} />
                  <span>{isDispatching ? 'Menyiapkan Swarm...' : 'Luncurkan Autonomous Swarm 🚀'}</span>
                </button>
              </div>

              {/* Planned Subtasks Preview */}
              {plannedSubtasks.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-indigo-400" />
                      <h3 className="text-xs font-bold text-slate-200">
                        Pratinjau Dynamic Directed Acyclic Graph (DAG)
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300 font-mono">
                        {plannedSubtasks.length} Subtugas
                      </span>
                    </div>
                    {coordinatorAgent && (
                      <span className="text-[11px] text-slate-400">
                        Koordinator: <strong className="text-indigo-300">{coordinatorAgent.name}</strong> ({coordinatorAgent.role})
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {plannedSubtasks.map((st, idx) => (
                      <div
                        key={st.id}
                        className="p-3.5 rounded-xl bg-slate-900 border border-slate-800/90 space-y-2 relative"
                      >
                        <div className="flex items-center justify-between">
                          <span className="w-5 h-5 rounded-lg bg-indigo-500/20 text-indigo-400 text-[11px] font-bold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                            {st.role}
                          </span>
                        </div>

                        <div className="text-xs font-bold text-slate-200">
                          {st.title}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>
                            Agen:{' '}
                            <strong className="text-slate-300">
                              {st.assignedAgentName || 'Spesialis'}
                            </strong>
                          </span>
                          {st.dependencies.length > 0 ? (
                            <span className="text-amber-400/90 text-[10px]">
                              Tergantung: {st.dependencies.join(', ')}
                            </span>
                          ) : (
                            <span className="text-emerald-400/90 text-[10px]">
                              Tahap Awal (Root Node)
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-400 italic line-clamp-2 bg-slate-950/40 p-2 rounded-lg border border-slate-800/50">
                          {st.promptTemplate}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LIVE DAG MONITOR */}
          {activeTab === 'monitor' && (
            <div className="space-y-5">
              {!activeMission ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                    <Activity className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-300">
                    Belum Ada Misi Swarm yang Aktif
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Kunjungi tab Perencana Misi untuk meluncurkan swarm otonom baru, atau pilih salah satu dari arsip.
                  </p>
                  <button
                    onClick={() => setActiveTab('planner')}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition"
                  >
                    Buka Perencana Misi
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Mission Summary Card */}
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white">
                            {activeMission.title}
                          </h3>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                              activeMission.status === 'EXECUTING'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                                : activeMission.status === 'COMPLETED'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : activeMission.status === 'CANCELLED'
                                ? 'bg-slate-700 text-slate-300'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            }`}
                          >
                            {activeMission.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {activeMission.objective}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {activeMission.status === 'EXECUTING' && (
                          <button
                            onClick={handleCancelMission}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition"
                          >
                            <StopCircle className="w-3.5 h-3.5" />
                            <span>Batalkan Misi</span>
                          </button>
                        )}
                        {activeMission.finalSynthesis && (
                          <button
                            onClick={handleCopySynthesis}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                          >
                            {copiedSynthesis ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>Salin Laporan</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar & Stats */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>
                          Kemajuan Koordinasi DAG: <strong className="text-slate-200">{completedSubtasks}/{totalSubtasks} Subtugas</strong>
                        </span>
                        <span>{progressPercent}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-400 transition-all duration-500"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* DAG Subtasks Flow */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Alur Eksekusi Subtugas Multi-Agen
                    </h4>

                    <div className="space-y-2.5">
                      {activeMission.subtasks.map((st, idx) => {
                        const isExpanded = expandedSubtasks[st.id] ?? false;
                        return (
                          <div
                            key={st.id}
                            className={`rounded-xl border transition overflow-hidden ${
                              st.status === 'RUNNING'
                                ? 'bg-indigo-950/20 border-indigo-500/50 shadow-md shadow-indigo-950/50'
                                : st.status === 'COMPLETED'
                                ? 'bg-slate-900 border-emerald-500/30'
                                : st.status === 'FAILED'
                                ? 'bg-slate-900 border-rose-500/30'
                                : 'bg-slate-900/60 border-slate-800 opacity-70'
                            }`}
                          >
                            {/* Card Header */}
                            <div
                              onClick={() => toggleSubtaskAccordion(st.id)}
                              className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 transition gap-2"
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center">
                                  {st.status === 'COMPLETED' ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                  ) : st.status === 'RUNNING' ? (
                                    <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
                                  ) : st.status === 'FAILED' ? (
                                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                                  ) : (
                                    <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                                  )}
                                </div>

                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-200">
                                      #{idx + 1} {st.title}
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                                      {st.role}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                    <span>Agen: <strong className="text-indigo-300">{st.assignedAgentName || 'Spesialis'}</strong></span>
                                    {st.durationMs ? (
                                      <span>• {(st.durationMs / 1000).toFixed(1)} detik</span>
                                    ) : null}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {st.status === 'RUNNING' && (
                                  <span className="text-[10px] font-bold text-indigo-400 animate-pulse">
                                    SEDANG BERJALAN...
                                  </span>
                                )}
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-slate-400" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-slate-400" />
                                )}
                              </div>
                            </div>

                            {/* Card Details (Accordion) */}
                            {isExpanded && (
                              <div className="px-4 pb-4 pt-1 border-t border-slate-800/60 bg-slate-950/30 space-y-3">
                                <div className="space-y-1">
                                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                    Instruksi / Prompt Subtugas:
                                  </span>
                                  <p className="text-[11px] font-mono text-slate-300 bg-slate-900 p-2.5 rounded-lg border border-slate-800 whitespace-pre-wrap">
                                    {st.promptTemplate}
                                  </p>
                                </div>

                                {st.outputResult && (
                                  <div className="space-y-1">
                                    <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                                      Hasil Keluaran Agen:
                                    </span>
                                    <div className="text-xs text-slate-200 bg-slate-900/90 p-3 rounded-lg border border-emerald-500/20 max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed font-sans">
                                      {st.outputResult}
                                    </div>
                                  </div>
                                )}

                                {st.error && (
                                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                                    <strong>Kendala:</strong> {st.error}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LIVE INTER-AGENT HANDOFF FEED */}
          {activeTab === 'feed' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-indigo-400" />
                    <span>Transkrip Handoff & Komunikasi Antar-Agen</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Aliran pesan koordinasi real-time saat agen membagikan artefak dan menyerahkan subtugas.
                  </p>
                </div>
              </div>

              {missionMessages.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-500">
                  Belum ada pesan komunikasi antar-agen yang tercatat untuk misi ini.
                </div>
              ) : (
                <div className="space-y-3">
                  {missionMessages.map(msg => {
                    const isHandoff = msg.messageType === 'HANDOFF';
                    const isDelegation = msg.messageType === 'DELEGATION';
                    const isSynthesis = msg.messageType === 'SYNTHESIS';

                    return (
                      <div
                        key={msg.id}
                        className={`p-3.5 rounded-xl border space-y-1.5 transition ${
                          isHandoff
                            ? 'bg-cyan-950/20 border-cyan-500/30'
                            : isDelegation
                            ? 'bg-indigo-950/20 border-indigo-500/30'
                            : isSynthesis
                            ? 'bg-emerald-950/20 border-emerald-500/30'
                            : 'bg-slate-900 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold uppercase font-mono ${
                                isHandoff
                                  ? 'bg-cyan-500/20 text-cyan-300'
                                  : isDelegation
                                  ? 'bg-indigo-500/20 text-indigo-300'
                                  : isSynthesis
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {msg.messageType}
                            </span>
                            <span className="font-semibold text-slate-300">
                              {msg.fromAgentName || 'Lead Coordinator'}
                              {msg.toAgentName ? ` ➔ ${msg.toAgentName}` : ''}
                            </span>
                          </div>
                          <span className="text-slate-500 font-mono text-[10px]">
                            {new Date(msg.createdAt).toLocaleTimeString('id-ID')}
                          </span>
                        </div>

                        <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                        </p>
                      </div>
                    );
                  })}
                  <div ref={feedEndRef} />
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ARCHIVE & SYNTHESIS REPORT */}
          {activeTab === 'archive' && (
            <div className="space-y-5">
              {activeMission?.finalSynthesis && (
                <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-xs font-bold text-white">
                        Laporan Sintesis Akhir Misi Terpilih
                      </h4>
                    </div>
                    <button
                      onClick={handleCopySynthesis}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                    >
                      {copiedSynthesis ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>Salin Laporan</span>
                    </button>
                  </div>

                  <div className="text-xs text-slate-200 bg-slate-950/60 p-4 rounded-lg border border-slate-800 font-sans leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto">
                    {activeMission.finalSynthesis}
                  </div>
                </div>
              )}

              {/* Past Missions List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Riwayat Misi Swarm Sebelumnya
                  </h4>
                  <button
                    onClick={fetchPastMissions}
                    className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
                    title="Segarkan Riwayat"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingPastMissions ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {pastMissions.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-500">
                    Belum ada riwayat misi tersimpan.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {pastMissions.map(m => (
                      <div
                        key={m.id}
                        onClick={() => handleSelectPastMission(m)}
                        className="p-3.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/40 transition cursor-pointer space-y-2 group"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              m.status === 'COMPLETED'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : m.status === 'EXECUTING'
                                ? 'bg-amber-500/20 text-amber-300 animate-pulse'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {m.status}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(m.createdAt).toLocaleDateString('id-ID')}
                          </span>
                        </div>

                        <div className="text-xs font-bold text-slate-200 group-hover:text-indigo-400 transition line-clamp-1">
                          {m.title}
                        </div>

                        <p className="text-[11px] text-slate-400 line-clamp-2">
                          {m.objective}
                        </p>

                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/60">
                          <span>Subtugas: {m.subtasks?.length || 0}</span>
                          <span>Durasi: {((m.totalDurationMs || 0) / 1000).toFixed(1)}s</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <span>Autonomous Swarm Mesh Active</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
          >
            Tutup Panel
          </button>
        </div>
      </div>
    </div>
  );
};
