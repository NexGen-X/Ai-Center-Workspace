import React from 'react';
import { X, CheckSquare, Plus } from 'lucide-react';
import { TaskList } from './TaskList.js';
import { Task, AIAgent, Project } from '../../../../shared/types.js';

interface TasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  agents: AIAgent[];
  projects: Project[];
  onTaskUpdated: () => void;
  onOpenCreateTask: () => void;
  onSelectTask: (task: Task) => void;
}

export const TasksModal: React.FC<TasksModalProps> = ({
  isOpen,
  onClose,
  tasks,
  agents,
  projects,
  onTaskUpdated,
  onOpenCreateTask,
  onSelectTask
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0B0F17] border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl shadow-blue-950/40 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Manajemen & Orkestrasi Tugas</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold font-mono">
                  {tasks.length} Total Tugas
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Kelola status, prioritas, kaitan proyek, dan delegasi tugas ke agen AI.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                onOpenCreateTask();
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/25 transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tugas Baru</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <TaskList
            tasks={tasks}
            agents={agents}
            projects={projects}
            onTaskUpdated={onTaskUpdated}
            onOpenCreateTask={onOpenCreateTask}
            onSelectTask={onSelectTask}
          />
        </div>
      </div>
    </div>
  );
};
