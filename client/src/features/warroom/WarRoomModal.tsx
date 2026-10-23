import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Swords,
  Users,
  Send,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Plus,
  Play,
  RotateCcw,
  CheckSquare,
  Shield,
  Cpu,
  Layers,
  Flame,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import {
  AIAgent,
  Project,
  WarRoom,
  WarRoomMessage,
  DebateRole
} from '../../../../shared/types.js';
import { api } from '../../services/api.js';
import { useFeedback } from '../../components/common/FeedbackContext.js';

interface WarRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  agents: AIAgent[];
  projects: Project[];
  onTaskCreated?: () => void;
}

const DEBATE_ROLES: Array<{ role: DebateRole; label: string; color: string; badgeClass: string }> = [
  {
    role: 'LEAD_ARCHITECT',
    label: 'Lead Architect',
    color: 'text-indigo-400',
    badgeClass: 'bg-indigo-950/80 text-indigo-300 border-indigo-700/60'
  },
  {
    role: 'SECURITY_ANALYST',
    label: 'Security Analyst',
    color: 'text-rose-400',
    badgeClass: 'bg-rose-950/80 text-rose-300 border-rose-700/60'
  },
  {
    role: 'DEV_LEAD',
    label: 'Dev Lead',
    color: 'text-amber-400',
    badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-700/60'
  },
  {
    role: 'PERFORMANCE_CRITIC',
    label: 'Performance Critic',
    color: 'text-emerald-400',
    badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60'
  },
  {
    role: 'SPECIALIST',
    label: 'Specialist',
    color: 'text-cyan-400',
    badgeClass: 'bg-cyan-950/80 text-cyan-300 border-cyan-700/60'
  }
];

export const WarRoomModal: React.FC<WarRoomModalProps> = ({
  isOpen,
  onClose,
  agents,
  projects,
  onTaskCreated
}) => {
  const { toast } = useFeedback();

  // State
  const [rooms, setRooms] = useState<WarRoom[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<WarRoom | null>(null);
  const [loading, setLoading] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // New room form
  const [newTitle, setNewTitle] = useState('');
  const [newTopic, setNewTopic] = useState('');
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [agentRoles, setAgentRoles] = useState<Record<string, DebateRole>>({});
  const [creatingRoom, setCreatingRoom] = useState(false);

  // Chat & Deliberation state
  const [userMessage, setUserMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [deliberating, setDeliberating] = useState(false);
  const [concluding, setConcluding] = useState(false);
  const [converting, setConverting] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Handle Escape key dismissal
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

  // Load Rooms on Open
  useEffect(() => {
    if (isOpen) {
      loadRooms();
    }
  }, [isOpen]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedRoom?.messages]);

  const loadRooms = async () => {
    setLoading(true);
    try {
      const data = await api.getWarRooms();
      setRooms(data);
      if (data.length > 0 && !selectedRoom) {
        loadRoomDetail(data[0].id);
      } else if (data.length === 0) {
        setIsCreatingNew(true);
      }
    } catch {
      toast.error('Gagal memuat daftar War Rooms.');
    } finally {
      setLoading(false);
    }
  };

  const loadRoomDetail = async (roomId: string) => {
    try {
      const detail = await api.getWarRoom(roomId);
      setSelectedRoom(detail);
      setIsCreatingNew(false);
    } catch {
      toast.error('Gagal memuat detail War Room.');
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newTopic.trim()) {
      toast.warning('Judul dan topik debat wajib diisi.');
      return;
    }
    if (selectedAgentIds.length === 0) {
      toast.warning('Pilih minimal 1 agen untuk berdebat.');
      return;
    }

    setCreatingRoom(true);
    try {
      const created = await api.createWarRoom({
        title: newTitle.trim(),
        topic: newTopic.trim(),
        agentIds: selectedAgentIds,
        roles: agentRoles
      });
      toast.success('Sesi War Room berhasil dibuat!');
      setRooms([created, ...rooms]);
      setSelectedRoom(created);
      setIsCreatingNew(false);
      setNewTitle('');
      setNewTopic('');
      setSelectedAgentIds([]);
    } catch (err: any) {
      toast.error(err.message || 'Gagal membuat War Room.');
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom || !userMessage.trim() || sendingMessage) return;

    const content = userMessage.trim();
    setUserMessage('');
    setSendingMessage(true);
    try {
      const msg = await api.postWarRoomMessage(selectedRoom.id, content);
      setSelectedRoom({
        ...selectedRoom,
        messages: [...(selectedRoom.messages || []), msg]
      });
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengirim pesan.');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleTriggerDeliberation = async () => {
    if (!selectedRoom || deliberating) return;

    setDeliberating(true);
    try {
      const res = await api.deliberateWarRoomRound(selectedRoom.id, {
        userPrompt: userMessage.trim() || undefined
      });
      setUserMessage('');
      if (res.messages && res.messages.length > 0) {
        setSelectedRoom({
          ...selectedRoom,
          messages: [...(selectedRoom.messages || []), ...res.messages]
        });
        toast.success(`Ronde debat ${res.roundNumber} selesai dengan ${res.messages.length} masukan ahli.`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Gagal memicu ronde debat.');
    } finally {
      setDeliberating(false);
    }
  };

  const handleConcludeConsensus = async () => {
    if (!selectedRoom || concluding) return;

    setConcluding(true);
    try {
      const concluded = await api.concludeWarRoom(selectedRoom.id);
      setSelectedRoom(concluded);
      toast.success('War Room berhasil diselesaikan dan konsensus akhir tercapai!');
    } catch (err: any) {
      toast.error(err.message || 'Gagal merumuskan konsensus.');
    } finally {
      setConcluding(false);
    }
  };

  const handleConvertToTask = async () => {
    if (!selectedRoom || converting) return;

    setConverting(true);
    try {
      const task = await api.convertWarRoomToTask(selectedRoom.id, {
        title: `[War Room Decision] ${selectedRoom.title}`,
        priority: 'HIGH'
      });
      toast.success(`Berhasil mengonversi konsensus menjadi Task: "${task.title}"`);
      if (onTaskCreated) onTaskCreated();
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengonversi ke Task.');
    } finally {
      setConverting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-6xl h-[90vh] flex flex-col bg-[#09090b] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between px-3.5 sm:px-6 py-2.5 sm:py-3.5 border-b border-zinc-800 bg-[#09090b] gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0">
              <Swords className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white truncate">
                  Multi-Agent War Room
                </h3>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 uppercase tracking-wider font-mono">
                  Autonomous Deliberation
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-zinc-400 truncate hidden sm:block">
                Debat arsitektur kolaboratif multi-agen untuk merumuskan konsensus teknis terbaik.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setSelectedRoom(null);
                setIsCreatingNew(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white text-xs font-semibold shadow-md transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Sesi Baru</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              title="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body Container */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar: Session List - hides on mobile if detail/create view is open */}
          <div className={`
            ${selectedRoom || isCreatingNew ? 'hidden md:flex' : 'flex'}
            w-full md:w-72 border-r border-zinc-800 bg-[#09090b] flex-col shrink-0
          `}>
            <div className="p-3 border-b border-zinc-800 text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
              <span>Daftar Sesi War Room</span>
              <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-300">
                {rooms.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
              {loading && rooms.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">Memuat sesi...</div>
              ) : rooms.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  Belum ada sesi War Room. Klik tombol "Sesi Baru" di atas.
                </div>
              ) : (
                rooms.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => loadRoomDetail(r.id)}
                    className={`w-full text-left p-2.5 rounded-xl border transition ${
                      selectedRoom?.id === r.id && !isCreatingNew
                        ? 'bg-rose-950/30 border-rose-500/40 text-white'
                        : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-800/50 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs truncate max-w-[140px]">{r.title}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase ${
                          r.status === 'CONCLUDED'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-amber-950 text-amber-400 border border-amber-800'
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{r.topic}</p>
                    <div className="mt-2 text-[10px] text-slate-500 flex items-center justify-between font-mono">
                      <span>{new Date(r.createdAt).toLocaleDateString('id-ID')}</span>
                      <span>ID: {r.id.slice(-6)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right Area: Active Debate Canvas or Create New Form */}
          <div className={`
            ${selectedRoom || isCreatingNew ? 'flex' : 'hidden md:flex'}
            flex-1 flex-col bg-[#09090b] overflow-hidden
          `}>
            {/* Mobile Back Button */}
            <div className="flex items-center justify-between p-2.5 bg-zinc-950 border-b border-zinc-800 md:hidden">
              <button
                type="button"
                onClick={() => { setSelectedRoom(null); setIsCreatingNew(false); }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-rose-400 text-xs font-semibold"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>← Sesi Lain</span>
              </button>
              <span className="text-xs text-zinc-300 font-medium truncate max-w-[180px]">
                {isCreatingNew ? 'Buat Sesi Baru' : selectedRoom?.title}
              </span>
            </div>
            {isCreatingNew ? (
              // Create New War Room Form
              <div className="flex-1 p-6 overflow-y-auto max-w-2xl mx-auto w-full">
                <div className="mb-6">
                  <h4 className="text-lg font-bold text-white flex items-center gap-2">
                    <Flame className="w-5 h-5 text-rose-500" />
                    Inisialisasi Sesi War Room Baru
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Tentukan topik perdebatan teknis dan tunjuk dewan ahli AI dengan peran spesifik.
                  </p>
                </div>

                <form onSubmit={handleCreateRoom} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Judul Sesi War Room
                    </label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Contoh: Migrasi Monolith ke Microservices vs Modular Monolith"
                      className="w-full px-3.5 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-rose-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Topik & Masalah Teknis yang Diperdebatkan
                    </label>
                    <textarea
                      value={newTopic}
                      onChange={(e) => setNewTopic(e.target.value)}
                      rows={3}
                      placeholder="Jelaskan trade-off teknis, batasan performa, atau isu keamanan yang perlu dicapai konsensusnya..."
                      className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-rose-500 resize-none leading-relaxed"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Pilih Agen Peserta & Tentukan Peran Debat
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1">
                      {agents.map((ag) => {
                        const isSelected = selectedAgentIds.includes(ag.id);
                        return (
                          <div
                            key={ag.id}
                            className={`p-2.5 rounded-xl border transition flex flex-col justify-between gap-2 ${
                              isSelected
                                ? 'bg-rose-950/20 border-rose-500/50'
                                : 'bg-slate-850 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedAgentIds([...selectedAgentIds, ag.id]);
                                    if (!agentRoles[ag.id]) {
                                      setAgentRoles({
                                        ...agentRoles,
                                        [ag.id]: 'SPECIALIST'
                                      });
                                    }
                                  } else {
                                    setSelectedAgentIds(selectedAgentIds.filter((id) => id !== ag.id));
                                  }
                                }}
                                className="rounded bg-slate-800 border-slate-700 text-rose-500 focus:ring-0"
                              />
                              <div>
                                <span className="text-xs font-bold text-white block">{ag.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">{ag.role}</span>
                              </div>
                            </label>

                            {isSelected && (
                              <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800/80">
                                <span className="text-[10px] text-slate-400">Peran:</span>
                                <select
                                  value={agentRoles[ag.id] || 'SPECIALIST'}
                                  onChange={(e) =>
                                    setAgentRoles({
                                      ...agentRoles,
                                      [ag.id]: e.target.value as DebateRole
                                    })
                                  }
                                  className="flex-1 text-[10px] px-2 py-1 rounded bg-slate-800 border border-slate-700 text-rose-300 font-semibold focus:outline-none"
                                >
                                  {DEBATE_ROLES.map((r) => (
                                    <option key={r.role} value={r.role}>
                                      {r.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-3 flex justify-end gap-2">
                    {rooms.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsCreatingNew(false)}
                        className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                      >
                        Batal
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={creatingRoom}
                      className="flex items-center gap-2 px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg transition"
                    >
                      <Swords className="w-4 h-4" />
                      <span>{creatingRoom ? 'Menginisialisasi...' : 'Mulai Sesi War Room'}</span>
                    </button>
                  </div>
                </form>
              </div>
            ) : selectedRoom ? (
              // Active War Room Discussion View
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Active Session Header Banner */}
                <div className="p-3 sm:px-6 sm:py-3 border-b border-slate-800 bg-slate-950/70 flex flex-wrap items-center justify-between gap-3 shrink-0">
                  <div className="flex-1 min-w-[240px]">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">{selectedRoom.title}</h4>
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded font-mono font-bold uppercase ${
                          selectedRoom.status === 'CONCLUDED'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-rose-950 text-rose-300 border border-rose-800'
                        }`}
                      >
                        {selectedRoom.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{selectedRoom.topic}</p>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedRoom.status !== 'CONCLUDED' && (
                      <>
                        <button
                          type="button"
                          onClick={handleTriggerDeliberation}
                          disabled={deliberating}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold shadow-md transition"
                          title="Picu agen peserta untuk memberikan respons dan kritik"
                        >
                          <Play className={`w-3.5 h-3.5 ${deliberating ? 'animate-spin' : ''}`} />
                          <span>{deliberating ? 'Deliberasi...' : 'Picu Ronde Debat'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleConcludeConsensus}
                          disabled={concluding}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-md transition"
                          title="Rumuskan konsensus akhir dan selesaikan sesi"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{concluding ? 'Merumuskan...' : 'Sintesis Konsensus'}</span>
                        </button>
                      </>
                    )}

                    {selectedRoom.status === 'CONCLUDED' && (
                      <button
                        type="button"
                        onClick={handleConvertToTask}
                        disabled={converting}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-md transition"
                        title="Ekspor konsensus ini menjadi project Task"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        <span>{converting ? 'Mengonversi...' : '1-Click Jadi Task'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Participant badges */}
                <div className="px-4 sm:px-6 py-2 border-b border-slate-800 bg-slate-900/60 flex items-center gap-2 overflow-x-auto text-[11px] shrink-0">
                  <span className="text-slate-500 font-mono text-[10px] uppercase font-bold shrink-0">
                    Dewan Ahli:
                  </span>
                  {selectedRoom.participants.map((p) => {
                    const roleMeta = DEBATE_ROLES.find((r) => r.role === p.roleInDebate);
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border font-mono text-[10px] shrink-0 ${
                          roleMeta?.badgeClass || 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        <span className="font-bold text-white">{p.agentName}</span>
                        <span className="opacity-70">[{roleMeta?.label || p.roleInDebate}]</span>
                      </div>
                    );
                  })}
                </div>

                {/* Messages Transcript Scroll Area */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
                  {(selectedRoom.messages || []).map((msg) => {
                    const isUser = msg.senderType === 'USER';
                    const isModerator = msg.senderType === 'MODERATOR';

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${
                          isUser ? 'items-end' : isModerator ? 'items-center' : 'items-start'
                        }`}
                      >
                        {isModerator ? (
                          // Moderator Banner
                          <div className="max-w-2xl w-full p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-300 text-xs shadow-lg">
                            <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-slate-800 text-[11px] font-bold text-rose-400">
                              <Shield className="w-4 h-4" />
                              <span>{msg.senderName}</span>
                              <span className="text-slate-500 font-mono text-[10px] ml-auto">
                                {new Date(msg.createdAt).toLocaleTimeString('id-ID')}
                              </span>
                            </div>
                            <div className="prose prose-invert prose-xs max-w-none whitespace-pre-wrap leading-relaxed">
                              {msg.content}
                            </div>
                          </div>
                        ) : isUser ? (
                          // User Bubble
                          <div className="max-w-xl p-3.5 rounded-2xl rounded-tr-none bg-rose-600 text-white text-xs shadow-md">
                            <div className="text-[10px] font-bold text-rose-200 mb-1 flex items-center justify-between gap-4">
                              <span>Commander (Human)</span>
                              <span className="opacity-75 font-mono">
                                {new Date(msg.createdAt).toLocaleTimeString('id-ID')}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                          </div>
                        ) : (
                          // Agent Bubble
                          <div className="max-w-2xl p-4 rounded-2xl rounded-tl-none bg-slate-850 border border-slate-800 text-slate-200 text-xs shadow-md">
                            <div className="flex items-center justify-between gap-3 mb-2 pb-1.5 border-b border-slate-800/80">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-xs">{msg.senderName}</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-rose-400 border border-slate-700 font-mono">
                                  Ronde {msg.roundNumber}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {new Date(msg.createdAt).toLocaleTimeString('id-ID')}
                              </span>
                            </div>
                            <div className="prose prose-invert prose-xs max-w-none whitespace-pre-wrap leading-relaxed">
                              {msg.content}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* User Input & Interjection Area */}
                <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950/70 shrink-0">
                  <form onSubmit={handleSendMessage} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={userMessage}
                      onChange={(e) => setUserMessage(e.target.value)}
                      placeholder="Ajukan interupsi atau arahan komando pada perdebatan..."
                      disabled={selectedRoom.status === 'CONCLUDED'}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-rose-500 disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={!userMessage.trim() || sendingMessage || selectedRoom.status === 'CONCLUDED'}
                      className="p-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white transition shadow-md"
                      title="Kirim pesan"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500">
                <Swords className="w-12 h-12 text-zinc-700 mb-3" />
                <h4 className="text-sm font-bold text-zinc-300 mb-1">Pilih Sesi War Room</h4>
                <p className="text-xs text-zinc-500 max-w-sm mb-4">
                  Pilih salah satu sesi di sebelah kiri untuk melihat perdebatan multi-agent secara real-time, atau buat sesi baru.
                </p>
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(true)}
                  className="px-4 py-2 rounded-xl bg-rose-600/80 hover:bg-rose-500 text-white text-xs font-semibold shadow-md transition"
                >
                  + Mulai Sesi Baru
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-2.5 border-t border-zinc-800 bg-[#09090b] flex justify-between items-center text-xs">
          <span className="text-zinc-500 font-mono text-[10px] sm:text-[11px] truncate mr-2">
            Multi-Perspective Autonomous Consensus Engine
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold shrink-0"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
