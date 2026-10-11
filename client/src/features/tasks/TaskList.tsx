import React, { useState } from 'react';
import { Task, TaskStatus, AIAgent, Project } from '../../../../shared/types.js';
import { CheckCircle2, Clock, PlayCircle, AlertCircle, Play, Bot, ArrowRight, Search, Layers } from 'lucide-react';
import { api } from '../../services/api.js';
import { useFeedback } from '../../components/common/FeedbackContext.js';

interface TaskListProps {
  tasks: Task[];
  agents: AIAgent[];
  projects?: Project[];
  onTaskUpdated: () => void;
  onOpenCreateTask: () => void;
  onSelectTask?: (task: Task) => void;
}

const PRIORITY_STYLES: Record<string, string> = {
  LOW: 'bg-slate-800 text-slate-400 border-slate-700',
  MEDIUM: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  HIGH: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  CRITICAL: 'bg-red-500/10 text-red-400 border-red-500/30'
};

const STATUS_ICONS: Record<TaskStatus, React.ReactNode> = {
  TODO: <Clock className="w-3.5 h-3.5 text-slate-400" />,
  IN_PROGRESS: <PlayCircle className="w-3.5 h-3.5 text-blue-400 animate-spin" />,
  IN_REVIEW: <AlertCircle className="w-3.5 h-3.5 text-purple-400" />,
  DONE: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
  CANCELLED: <AlertCircle className="w-3.5 h-3.5 text-red-400" />
};

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  agents,
  projects = [],
  onTaskUpdated,
  onOpenCreateTask,
  onSelectTask
}) => {
  const { toast } = useFeedback();
  const [filter, setFilter] = useState<string>('ALL');
  const [projectFilter, setProjectFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [executingTaskId, setExecutingTaskId] = useState<string | null>(null);

  const filteredTasks = tasks.filter((t) => {
    if (filter !== 'ALL' && t.status !== filter) return false;
    if (projectFilter !== 'ALL' && t.projectId !== projectFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = t.description?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }
    return true;
  });

  const handleTransition = async (taskId: string, newStatus: TaskStatus, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.transitionTask(taskId, newStatus);
      onTaskUpdated();
      toast.success(`Status tugas diubah ke "${newStatus}".`);
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengubah status tugas.', 'Status Gagal Diubah');
    }
  };

  const handleExecuteTask = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    const agentId = task.assignedAgentId || agents[0]?.id;
    if (!agentId) {
      toast.warning('Tugaskan agen terlebih dahulu sebelum mengeksekusi tugas.', 'Belum Ada Agen');
      return;
    }

    setExecutingTaskId(task.id);
    try {
      await api.executeTask(task.id, agentId);
      onTaskUpdated();
      toast.success(`Tugas "${task.title}" berhasil dieksekusi oleh AI Agent.`);
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengeksekusi tugas.', 'Eksekusi Gagal');
    } finally {
      setExecutingTaskId(null);
    }
  };

  return (
    <div className="bg-[#111827]/90 border border-slate-800 rounded-xl p-4 flex flex-col h-full">
      {/* Header & Filter Controls */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Daftar Tugas & Orkestrasi</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-cyan-400 border border-slate-700">
                {filteredTasks.length} / {tasks.length}
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Klik tugas untuk rincian, instruksi LLM, riwayat audit, dan delegasi agent.
            </p>
          </div>

          <button
            onClick={onOpenCreateTask}
            className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg shadow-sm transition active:scale-95"
          >
            + Tugas Baru
          </button>
        </div>

        {/* Filter bar: Search + Project Filter + Status Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[160px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Cari tugas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {projects.length > 0 && (
            <div className="flex items-center gap-1.5">
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
              >
                <option value="ALL">Semua Proyek</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs overflow-x-auto">
            {['ALL', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'].map((st) => (
              <button
                key={st}
                onClick={() => setFilter(st)}
                className={`px-2.5 py-1 rounded-md font-semibold transition text-[11px] whitespace-nowrap ${
                  filter === st
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st === 'ALL' ? 'Semua' : st.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Task List Items */}
      {filteredTasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center border border-dashed border-slate-800 rounded-lg">
          <Clock className="w-8 h-8 text-slate-600 mb-2" />
          <p className="text-xs text-slate-400 mb-2">Tidak ada tugas dengan kriteria filter ini.</p>
          <button
            onClick={onOpenCreateTask}
            className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
          >
            + Buat Tugas Baru
          </button>
        </div>
      ) : (
        <div className="space-y-2.5 overflow-y-auto flex-1 pr-1 max-h-[500px]">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              onClick={() => onSelectTask && onSelectTask(task)}
              className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 hover:border-blue-500/50 hover:bg-slate-900/40 transition space-y-2 group cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <div className="mt-0.5">{STATUS_ICONS[task.status]}</div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white group-hover:text-cyan-300 transition truncate">
                      {task.title}
                    </h4>
                    {task.description && (
                      <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{task.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.MEDIUM}`}>
                    {task.priority}
                  </span>
                </div>
              </div>

              {/* Task Meta and Transition Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-xs gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-slate-400 text-[11px] flex-wrap">
                  <div className="flex items-center gap-1">
                    <Bot className="w-3.5 h-3.5 text-slate-500" />
                    <span className="font-semibold text-slate-300">
                      {task.assignedAgentName || 'Belum ditugaskan'}
                    </span>
                  </div>

                  {task.projectId && (
                    <div className="flex items-center gap-1 text-indigo-400 bg-indigo-500/10 px-1.5 py-0.2 rounded border border-indigo-500/20 text-[10px]">
                      <Layers className="w-3 h-3" />
                      <span>{projects.find((p) => p.id === task.projectId)?.name || 'Proyek'}</span>
                    </div>
                  )}

                  {task.dueDate && (
                    <span className="text-[10px] text-slate-500 font-mono">
                      Target: {new Date(task.dueDate).toLocaleDateString()}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {/* Status transition dropdown / quick button */}
                  {task.status !== 'DONE' && (
                    <button
                      onClick={(e) => handleExecuteTask(task, e)}
                      disabled={executingTaskId === task.id}
                      className="px-2 py-1 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-[11px] font-semibold flex items-center gap-1 transition"
                    >
                      <Play className={`w-3 h-3 ${executingTaskId === task.id ? 'animate-spin' : ''}`} />
                      <span>{executingTaskId === task.id ? 'Memproses...' : 'Eksekusi'}</span>
                    </button>
                  )}

                  {task.status === 'TODO' && (
                    <button
                      onClick={(e) => handleTransition(task.id, 'IN_PROGRESS', e)}
                      className="text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-900 border border-slate-800"
                    >
                      Mulai
                    </button>
                  )}

                  {task.status === 'IN_PROGRESS' && (
                    <button
                      onClick={(e) => handleTransition(task.id, 'DONE', e)}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20"
                    >
                      Selesaikan
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
