import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Bot,
  Play,
  Clock,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Layers,
  Edit3,
  Trash2,
  Save,
  RotateCcw,
  Check,
  History,
  FileText,
  Terminal,
  Sparkles,
  Copy,
  Download,
  CheckCheck
} from 'lucide-react';
import { Task, TaskStatus, TaskPriority, AIAgent, Project, AgentRun } from '../../../../shared/types.js';
import { api } from '../../services/api.js';
import { useFeedback } from '../../components/common/FeedbackContext.js';
import { CustomSelect } from '../../components/common/CustomSelect.js';
import { CustomDatePicker } from '../../components/common/CustomDatePicker.js';

interface TaskDetailModalProps {
  taskId: string | null;
  onClose: () => void;
  agents: AIAgent[];
  projects: Project[];
  onTaskUpdated: () => void;
}

const PRIORITY_STYLES: Record<string, string> = {
  LOW: 'bg-slate-800 text-slate-400 border-slate-700',
  MEDIUM: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  HIGH: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  CRITICAL: 'bg-red-500/10 text-red-400 border-red-500/30'
};

const STATUS_BADGES: Record<TaskStatus, { bg: string; text: string; label: string }> = {
  TODO: { bg: 'bg-slate-800', text: 'text-slate-300', label: 'To Do' },
  IN_PROGRESS: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'In Progress' },
  IN_REVIEW: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'In Review' },
  DONE: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Done' },
  CANCELLED: { bg: 'bg-rose-500/20', text: 'text-rose-400', label: 'Cancelled' }
};

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  taskId,
  onClose,
  agents,
  projects,
  onTaskUpdated
}) => {
  const { toast, confirm } = useFeedback();
  const [task, setTask] = useState<Task | null>(null);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSwarmLaunching, setIsSwarmLaunching] = useState(false);
  const [lastRun, setLastRun] = useState<AgentRun | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [streamingThoughts, setStreamingThoughts] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [streamTokenCount, setStreamTokenCount] = useState(0);
  const [streamingAgentName, setStreamingAgentName] = useState('');
  const streamRef = useRef<HTMLDivElement>(null);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState<TaskPriority>('MEDIUM');
  const [editAssigneeId, setEditAssigneeId] = useState('');
  const [editProjectId, setEditProjectId] = useState('');
  const [editDueDate, setEditDueDate] = useState('');

  const loadTask = async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getTask(id);
      setTask(res.task);
      setRuns(res.runs);
      setHistory(res.history);

      // Populate edit fields
      setEditTitle(res.task.title);
      setEditDescription(res.task.description || '');
      setEditPriority(res.task.priority);
      setEditAssigneeId(res.task.assignedAgentId || '');
      setEditProjectId(res.task.projectId || '');
      setEditDueDate(res.task.dueDate ? res.task.dueDate.split('T')[0] : '');
    } catch (err: any) {
      setError(err.message || 'Gagal memuat rincian tugas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (taskId) {
      loadTask(taskId);
      setIsEditing(false);
      setLastRun(null);
      setStreamingText('');
      setStreamingThoughts('');
      setIsThinking(false);
      setStreamTokenCount(0);
      setStreamingAgentName('');
    }
  }, [taskId]);

  // Connect to SSE for real-time live token streaming & reasoning trace
  useEffect(() => {
    if (!taskId) return;

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/realtime');

      eventSource.addEventListener('task.token_chunk', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data.taskId === taskId) {
            setIsExecuting(true);
            if (data.agentName) {
              setStreamingAgentName(data.agentName);
            }

            const fullText: string = data.accumulated || '';
            const thinkStart = fullText.indexOf('<think>');
            const thinkEnd = fullText.indexOf('</think>');

            if (thinkStart !== -1) {
              if (thinkEnd !== -1) {
                const thoughts = fullText.slice(thinkStart + 7, thinkEnd).trim();
                const cleanOutput = (fullText.slice(0, thinkStart) + fullText.slice(thinkEnd + 8)).trim();
                setStreamingThoughts(thoughts);
                setStreamingText(cleanOutput);
                setIsThinking(false);
              } else {
                const thoughts = fullText.slice(thinkStart + 7).trim();
                setStreamingThoughts(thoughts);
                setIsThinking(true);
              }
            } else {
              setStreamingText(fullText);
              setIsThinking(false);
            }

            setStreamTokenCount((prev) => prev + 1);
          }
        } catch {
          // ignore parsing error
        }
      });

      eventSource.addEventListener('task.token_completed', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data.taskId === taskId) {
            setIsExecuting(false);
            setIsThinking(false);
            loadTask(taskId);
          }
        } catch {
          // ignore
        }
      });
    } catch {
      // EventSource fallback
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [taskId]);

  // Auto-scroll stream box as tokens arrive
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [streamingText, streamingThoughts]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (taskId) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [taskId, onClose]);

  if (!taskId || !task) return null;

  const handleExecute = async () => {
    const targetAgentId = task.assignedAgentId || agents[0]?.id;
    if (!targetAgentId) {
      toast.warning('Belum ada AI Agent yang terdaftar untuk mengeksekusi tugas ini.', 'Belum Ditugaskan');
      return;
    }

    try {
      setIsExecuting(true);
      setStreamingText('');
      setStreamingThoughts('');
      setIsThinking(false);
      setStreamTokenCount(0);
      const runResult = await api.executeTask(task.id, targetAgentId);
      setLastRun(runResult);
      await loadTask(task.id);
      onTaskUpdated();
      toast.success(`Eksekusi tugas "${task.title}" berhasil diselesaikan.`);
    } catch (err: any) {
      toast.error(err.message || 'Eksekusi gagal dijalankan.', 'Gagal Mengeksekusi Tugas');
    } finally {
      setIsExecuting(false);
      setIsThinking(false);
    }
  };

  const handleAutoSwarm = async () => {
    if (!task) return;
    try {
      setIsSwarmLaunching(true);
      const res = await api.autoSwarmTask(task.id);
      toast.success(res.message || 'Misi Swarm berhasil diluncurkan ke seluruh tim spesialis!', 'Swarm Diluncurkan');
      await loadTask(task.id);
      onTaskUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Gagal meluncurkan misi swarm.', 'Swarm Error');
    } finally {
      setIsSwarmLaunching(false);
    }
  };

  const [copiedOutput, setCopiedOutput] = useState(false);

  const handleCopyOutput = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedOutput(true);
    toast.success('Keluaran tugas berhasil disalin ke clipboard.');
    setTimeout(() => setCopiedOutput(false), 2000);
  };

  const handleDownloadDeliverable = (taskTitle: string, outputText: string) => {
    if (!outputText) return;
    const content = `# Deliverable: ${taskTitle}\n\n**Generated by AI Agent Command Center**\n**Tanggal**: ${new Date().toLocaleString('id-ID')}\n\n---\n\n${outputText}\n`;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `deliverable-${taskTitle.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 40)}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Deliverable berhasil diunduh sebagai file Markdown (.md).');
  };

  const handleTransition = async (newStatus: TaskStatus) => {
    try {
      await api.transitionTask(task.id, newStatus);
      await loadTask(task.id);
      onTaskUpdated();
      toast.success(`Status tugas diubah ke "${newStatus}".`);
    } catch (err: any) {
      toast.error(err.message || 'Gagal memperbarui status tugas.', 'Gagal Mengubah Status');
    }
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim()) {
      toast.warning('Judul tugas wajib diisi.', 'Validasi Form');
      return;
    }

    try {
      setLoading(true);
      await api.updateTask(task.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        priority: editPriority,
        assignedAgentId: editAssigneeId || undefined,
        projectId: editProjectId || undefined,
        dueDate: editDueDate || undefined
      });
      setIsEditing(false);
      await loadTask(task.id);
      onTaskUpdated();
      toast.success('Perubahan tugas berhasil disimpan.');
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan perubahan tugas.', 'Gagal Menyimpan');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const isConfirmed = await confirm({
      title: 'Hapus Tugas',
      message: `Hapus tugas "${task.title}" secara permanen dari sistem?`,
      confirmText: 'Ya, Hapus Tugas',
      variant: 'danger'
    });
    if (!isConfirmed) return;

    try {
      setLoading(true);
      await api.deleteTask(task.id);
      onTaskUpdated();
      toast.success(`Tugas "${task.title}" berhasil dihapus.`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus tugas.', 'Penghapusan Gagal');
      setLoading(false);
    }
  };

  const statusConfig = STATUS_BADGES[task.status] || STATUS_BADGES.TODO;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl max-h-[94vh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 sm:px-6 py-3 sm:py-4 border-b border-slate-800 bg-slate-800/40 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border border-slate-700 ${statusConfig.bg} ${statusConfig.text}`}>
              {statusConfig.label}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.MEDIUM}`}>
              {task.priority}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="p-1.5 sm:p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                title="Edit Tugas"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white text-xs"
              >
                Batal
              </button>
            )}

            <button
              type="button"
              onClick={handleDelete}
              className="p-1.5 sm:p-2 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-rose-400 transition"
              title="Hapus Tugas"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              title="Tutup (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4 sm:space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isEditing ? (
            /* Edit Form */
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Judul Tugas</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Deskripsi Tugas</label>
                <textarea
                  rows={4}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Prioritas</label>
                  <CustomSelect
                    value={editPriority}
                    onChange={(val) => setEditPriority(val as TaskPriority)}
                    options={[
                      { value: 'LOW', label: 'LOW', badge: 'LOW', badgeColor: 'bg-slate-800 text-slate-300 border-slate-700' },
                      { value: 'MEDIUM', label: 'MEDIUM', badge: 'MED', badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
                      { value: 'HIGH', label: 'HIGH', badge: 'HIGH', badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                      { value: 'CRITICAL', label: 'CRITICAL', badge: 'CRIT', badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/20' }
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Tugaskan ke Agent</label>
                  <CustomSelect
                    value={editAssigneeId}
                    onChange={(val) => setEditAssigneeId(val)}
                    options={[
                      { value: '', label: '(Tanpa Assignee)' },
                      ...agents.map((a) => ({
                        value: a.id,
                        label: a.name,
                        description: a.role
                      }))
                    ]}
                    placeholder="Pilih Agent..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Hubungkan ke Proyek</label>
                  <CustomSelect
                    value={editProjectId}
                    onChange={(val) => setEditProjectId(val)}
                    options={[
                      { value: '', label: '(Tanpa Proyek)' },
                      ...projects.map((p) => ({
                        value: p.id,
                        label: p.name
                      }))
                    ]}
                    placeholder="Pilih Proyek..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Tenggat Waktu (Due Date)</label>
                <CustomDatePicker
                  value={editDueDate}
                  onChange={(val) => setEditDueDate(val)}
                  placeholder="Pilih tenggat waktu..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </div>
          ) : (
            /* View Mode */
            <>
              <div>
                <h1 className="text-xl font-bold text-white tracking-wide">{task.title}</h1>
                <p className="text-xs text-slate-400 mt-1 whitespace-pre-wrap leading-relaxed bg-slate-850/50 p-3 rounded-lg border border-slate-800/80">
                  {task.description || '(Tidak ada deskripsi rinci untuk tugas ini)'}
                </p>
              </div>

              {/* Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block mb-1">Assignee (Agent)</span>
                  <div className="flex items-center gap-1.5 text-white font-semibold">
                    <Bot className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="truncate">{task.assignedAgentName || 'Belum ditugaskan'}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block mb-1">Tenggat Waktu</span>
                  <div className="flex items-center gap-1.5 text-white font-semibold">
                    <Calendar className="w-3.5 h-3.5 text-purple-400" />
                    <span>{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Fleksibel'}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block mb-1">Dibuat Pada</span>
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{new Date(task.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60">
                  <span className="text-[10px] text-slate-400 block mb-1">Proyek</span>
                  <div className="flex items-center gap-1.5 text-indigo-300 font-semibold truncate">
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="truncate">{projects.find(p => p.id === task.projectId)?.name || 'Mandiri'}</span>
                  </div>
                </div>
              </div>

              {/* Quick Execution Box */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-slate-900 border border-blue-500/30 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Play className="w-3.5 h-3.5 text-blue-400" />
                    <span>Eksekusi & Pembagian Kerja AI Tim</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Jalankan agen mandiri dengan kapabilitas delegasi tim, atau otomatis bagi ke seluruh spesialis Swarm.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleAutoSwarm}
                    disabled={isExecuting || isSwarmLaunching}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600/90 hover:bg-indigo-500 text-white text-xs font-bold border border-indigo-400/40 shadow-lg shadow-indigo-500/20 transition active:scale-95 disabled:opacity-50"
                    title="Dekomposisi tugas ini menjadi Swarm DAG dan bagikan ke seluruh spesialis tim (Planner, Coder, QA, DevOps)"
                  >
                    <Sparkles className={`w-3.5 h-3.5 text-indigo-200 ${isSwarmLaunching ? 'animate-spin' : ''}`} />
                    <span>{isSwarmLaunching ? 'Meluncurkan Swarm...' : '⚡ Bagi Kerja ke Tim Swarm'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExecute}
                    disabled={isExecuting || isSwarmLaunching}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-500/20 transition active:scale-95 disabled:opacity-50"
                  >
                    <Play className={`w-3.5 h-3.5 ${isExecuting ? 'animate-spin' : ''}`} />
                    <span>{isExecuting ? 'Mengeksekusi...' : 'Jalankan Task Sekarang'}</span>
                  </button>
                </div>
              </div>

              {/* Live Token Streaming & Reasoning Trace Banner */}
              {(isExecuting || streamingText || streamingThoughts) && (
                <div className="p-4 rounded-xl bg-slate-950 border border-blue-500/40 shadow-xl space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isThinking ? 'bg-indigo-400' : 'bg-cyan-400'} opacity-75`}></span>
                        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isThinking ? 'bg-indigo-500' : 'bg-cyan-500'}`}></span>
                      </span>
                      <span className="text-xs font-bold text-white flex items-center gap-1.5 font-mono">
                        <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{isThinking ? '🧠 Deep Reasoning Trace' : `⚡ Live Streaming • ${streamingAgentName || 'Agent'}`}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
                      {isExecuting && (
                        <span className={`px-2 py-0.5 rounded border text-[10px] uppercase font-bold animate-pulse ${isThinking ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'}`}>
                          {isThinking ? 'Menalar...' : 'Streaming...'}
                        </span>
                      )}
                      <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-[10px]">
                        ~{streamTokenCount} tokens
                      </span>
                    </div>
                  </div>

                  {/* Reasoning Thought Box (if present) */}
                  {streamingThoughts && (
                    <div className="p-3 rounded-lg bg-indigo-950/20 border border-indigo-500/30 text-[11px] text-indigo-200/90 font-mono space-y-1">
                      <div className="flex items-center gap-1.5 text-indigo-400 font-bold text-[10px] uppercase tracking-wider">
                        <Sparkles className="w-3 h-3 text-indigo-400" />
                        <span>Chain of Thought / Alur Penalaran:</span>
                      </div>
                      <div className="whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto pl-2 border-l-2 border-indigo-500/40 italic">
                        {streamingThoughts}
                      </div>
                    </div>
                  )}

                  {/* Live Stream Output Box */}
                  <div
                    ref={streamRef}
                    className="p-3.5 rounded-lg bg-slate-900 border border-slate-800/80 font-mono text-xs text-slate-100 whitespace-pre-wrap max-h-64 overflow-y-auto leading-relaxed"
                  >
                    {streamingText || (isThinking ? 'Menganalisis dependensi tugas & konteks sistem...' : 'Menghubungkan ke model gateway...')}
                    {isExecuting && <span className="inline-block w-2 h-4 ml-1 bg-cyan-400 animate-pulse align-middle" />}
                  </div>
                </div>
              )}

              {/* Last Run Output */}
              {(lastRun || runs.length > 0) && (
                <div className="space-y-2">
                  {(() => {
                    const r = lastRun || runs[0];
                    const outputText = r.outputResult || (r as any).output_result || '';
                    return (
                      <>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Keluaran Eksekusi Terakhir</span>
                          </h3>
                          {outputText && (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleCopyOutput(outputText)}
                                className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-mono border border-slate-700 transition"
                                title="Salin output ke clipboard"
                              >
                                {copiedOutput ? <CheckCheck className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                <span>{copiedOutput ? 'Tersalin' : 'Salin Output'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadDeliverable(task.title, outputText)}
                                className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 text-[11px] font-mono border border-blue-500/30 transition shadow-sm"
                                title="Download output sebagai file Markdown (.md)"
                              >
                                <Download className="w-3 h-3" />
                                <span>Download .md</span>
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                          <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                            <span className={`px-2 py-0.5 rounded font-bold ${r.status === 'SUCCEEDED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                              {r.status}
                            </span>
                            <span>Durasi: {r.durationMs || 0} ms • Total Token: {r.tokensUsed?.totalTokens || (r as any).tokens_total || 0}</span>
                          </div>
                          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-200 whitespace-pre-wrap max-h-48 overflow-y-auto">
                            {outputText || '(Tidak ada keluaran teks)'}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* State Machine Transition Actions */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs text-slate-400 font-medium">Ubah Status:</span>
                <div className="flex items-center gap-1.5">
                  {task.status !== 'TODO' && (
                    <button
                      onClick={() => handleTransition('TODO')}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                    >
                      Kembalikan ke To Do
                    </button>
                  )}
                  {task.status === 'TODO' && (
                    <button
                      onClick={() => handleTransition('IN_PROGRESS')}
                      className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
                    >
                      Mulai Kerjakan
                    </button>
                  )}
                  {task.status === 'IN_PROGRESS' && (
                    <>
                      <button
                        onClick={() => handleTransition('IN_REVIEW')}
                        className="px-3 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
                      >
                        Kirim Review
                      </button>
                      <button
                        onClick={() => handleTransition('DONE')}
                        className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                      >
                        Selesaikan
                      </button>
                    </>
                  )}
                  {task.status === 'IN_REVIEW' && (
                    <button
                      onClick={() => handleTransition('DONE')}
                      className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                    >
                      Verifikasi Selesai
                    </button>
                  )}
                  {task.status !== 'CANCELLED' && task.status !== 'DONE' && (
                    <button
                      onClick={() => handleTransition('CANCELLED')}
                      className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 text-xs font-semibold"
                    >
                      Batalkan
                    </button>
                  )}
                </div>
              </div>

              {/* Audit History Timeline */}
              {history.length > 0 && (
                <div className="pt-3 border-t border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    <span>Riwayat Audit Task ({history.length})</span>
                  </h4>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {history.map((h, i) => (
                      <div key={h.id || i} className="text-[11px] p-2 rounded bg-slate-950/60 border border-slate-800 text-slate-400 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-slate-300 mr-2">{h.event_type}</span>
                          <span>{h.old_value ? `${h.old_value} ➔ ${h.new_value}` : h.new_value}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(h.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
