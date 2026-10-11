import React, { useState } from 'react';
import { Task, TaskStatus, AIAgent } from '../../../../shared/types.js';
import { CheckCircle2, Clock, PlayCircle, AlertCircle, Play, Bot, ArrowRight } from 'lucide-react';
import { api } from '../../services/api.js';

interface TaskListProps {
  tasks: Task[];
  agents: AIAgent[];
  onTaskUpdated: () => void;
  onOpenCreateTask: () => void;
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

export const TaskList: React.FC<TaskListProps> = ({ tasks, agents, onTaskUpdated, onOpenCreateTask }) => {
  const [filter, setFilter] = useState<string>('ALL');
  const [executingTaskId, setExecutingTaskId] = useState<string | null>(null);

  const filteredTasks = tasks.filter((t) => {
    if (filter === 'ALL') return true;
    return t.status === filter;
  });

  const handleTransition = async (taskId: string, newStatus: TaskStatus) => {
    try {
      await api.transitionTask(taskId, newStatus);
      onTaskUpdated();
    } catch (err: any) {
      alert(`Gagal mengubah status: ${err.message}`);
    }
  };

  const handleExecuteTask = async (task: Task) => {
    if (!task.assignedAgentId && agents.length > 0) {
      alert('Tugaskan agen terlebih dahulu atau agen otomatis akan dipilih.');
    }
    const agentId = task.assignedAgentId || agents[0]?.id;
    if (!agentId) return;

    setExecutingTaskId(task.id);
    try {
      await api.executeTask(task.id, agentId);
      onTaskUpdated();
    } catch (err: any) {
      alert(`Gagal mengeksekusi tugas: ${err.message}`);
    } finally {
      setExecutingTaskId(null);
    }
  };

  return (
    <div className="bg-[#111827]/90 border border-slate-800 rounded-xl p-4 flex flex-col h-full">
      {/* Header & Status Filter Bar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <span>Daftar Tugas & Orkestrasi</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
              {filteredTasks.length}
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Pantau status eksekusi dan delegasikan ke anggota AI Team.</p>
        </div>

        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
          {['ALL', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'].map((st) => (
            <button
              key={st}
              onClick={() => setFilter(st)}
              className={`px-2.5 py-1 rounded-md font-semibold transition text-[11px] ${
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

      {/* Task List Items */}
      {filteredTasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center border border-dashed border-slate-800 rounded-lg">
          <Clock className="w-8 h-8 text-slate-600 mb-2" />
          <p className="text-xs text-slate-400 mb-2">Tidak ada tugas dengan filter ini.</p>
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
              className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition space-y-2 group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <div className="mt-0.5">{STATUS_ICONS[task.status]}</div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white truncate">{task.title}</h4>
                    {task.description && (
                      <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{task.description}</p>
                    )}
                  </div>
                </div>

                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase shrink-0 ${PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.MEDIUM}`}>
                  {task.priority}
                </span>
              </div>

              {/* Task Meta and Transition Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-900 text-xs gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                  <Bot className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-semibold text-slate-300">
                    {task.assignedAgentName || 'Belum ditugaskan'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Status transition dropdown / quick button */}
                  {task.status !== 'DONE' && (
                    <button
                      onClick={() => handleExecuteTask(task)}
                      disabled={executingTaskId === task.id}
                      className="px-2 py-1 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-[11px] font-semibold flex items-center gap-1 transition"
                    >
                      <Play className={`w-3 h-3 ${executingTaskId === task.id ? 'animate-spin' : ''}`} />
                      <span>{executingTaskId === task.id ? 'Memproses...' : 'Eksekusi'}</span>
                    </button>
                  )}

                  {task.status === 'TODO' && (
                    <button
                      onClick={() => handleTransition(task.id, 'IN_PROGRESS')}
                      className="text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-900 border border-slate-800"
                    >
                      Mulai
                    </button>
                  )}

                  {task.status === 'IN_PROGRESS' && (
                    <button
                      onClick={() => handleTransition(task.id, 'DONE')}
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
