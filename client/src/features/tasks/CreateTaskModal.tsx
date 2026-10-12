import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import { AIAgent, TaskPriority, Project } from '../../../../shared/types.js';
import { api } from '../../services/api.js';
import { CustomSelect } from '../../components/common/CustomSelect.js';
import { CustomDatePicker } from '../../components/common/CustomDatePicker.js';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  agents: AIAgent[];
  projects?: Project[];
  initialProjectId?: string;
  onTaskCreated: () => void;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  agents,
  projects = [],
  initialProjectId,
  onTaskCreated
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
  const [assignedAgentId, setAssignedAgentId] = useState<string>(agents[0]?.id || '');
  const [projectId, setProjectId] = useState<string>(initialProjectId || '');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialProjectId) {
      setProjectId(initialProjectId);
    }
  }, [initialProjectId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Judul tugas wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await api.createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        projectId: projectId || undefined,
        assignedAgentId: assignedAgentId || undefined,
        dueDate: dueDate || undefined
      });
      onTaskCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal membuat tugas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800 bg-[#0B0F17]/60">
          <h2 className="text-base font-bold text-white">Buat Tugas Baru</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Judul Tugas <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Audit Keamanan Endpoint Egress"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Deskripsi Lengkap</label>
            <textarea
              rows={3}
              placeholder="Jelaskan kebutuhan, batasan, atau acceptance criteria..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Prioritas</label>
              <CustomSelect
                value={priority}
                onChange={(val) => setPriority(val as TaskPriority)}
                options={[
                  { value: 'LOW', label: 'Low', badge: 'LOW', badgeColor: 'bg-slate-800 text-slate-300 border-slate-700' },
                  { value: 'MEDIUM', label: 'Medium', badge: 'MED', badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
                  { value: 'HIGH', label: 'High', badge: 'HIGH', badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                  { value: 'CRITICAL', label: 'Critical', badge: 'CRIT', badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/20' }
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Tugaskan ke AI Agent</label>
              <CustomSelect
                value={assignedAgentId}
                onChange={(val) => setAssignedAgentId(val)}
                options={[
                  { value: '', label: '(Tanpa Assignee)' },
                  ...agents.map((ag) => ({
                    value: ag.id,
                    label: ag.name,
                    description: ag.role
                  }))
                ]}
                placeholder="Pilih AI Agent..."
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Hubungkan ke Proyek</label>
              <CustomSelect
                value={projectId}
                onChange={(val) => setProjectId(val)}
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

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Tenggat Waktu (Opsional)</label>
              <CustomDatePicker
                value={dueDate}
                onChange={(val) => setDueDate(val)}
                placeholder="Pilih tenggat waktu..."
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition disabled:opacity-50"
            >
              {isSubmitting ? 'Menyimpan...' : 'Buat Tugas'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
