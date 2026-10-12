import React, { useState, useEffect } from 'react';
import {
  X,
  Layers,
  Plus,
  Edit3,
  Trash2,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  AlertCircle,
  Save,
  Check,
  FolderPlus
} from 'lucide-react';
import { Project, Task } from '../../../../shared/types.js';
import { api } from '../../services/api.js';
import { useFeedback } from '../../components/common/FeedbackContext.js';
import { CustomSelect } from '../../components/common/CustomSelect.js';
import { CustomDatePicker } from '../../components/common/CustomDatePicker.js';

interface ProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectsUpdated: () => void;
  onOpenCreateTaskForProject?: (projectId: string) => void;
  onSelectTask?: (task: Task) => void;
}

const STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  ACTIVE: { bg: 'bg-emerald-500/20 border-emerald-500/30', text: 'text-emerald-400', label: 'Active' },
  PLANNING: { bg: 'bg-blue-500/20 border-blue-500/30', text: 'text-blue-400', label: 'Planning' },
  COMPLETED: { bg: 'bg-purple-500/20 border-purple-500/30', text: 'text-purple-400', label: 'Completed' },
  ON_HOLD: { bg: 'bg-amber-500/20 border-amber-500/30', text: 'text-amber-400', label: 'On Hold' }
};

export const ProjectsModal: React.FC<ProjectsModalProps> = ({
  isOpen,
  onClose,
  onProjectsUpdated,
  onOpenCreateTaskForProject,
  onSelectTask
}) => {
  const { toast, confirm } = useFeedback();
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState<'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'ON_HOLD'>('ACTIVE');
  const [formDueDate, setFormDueDate] = useState('');

  const fetchProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getProjects();
      setProjects(data);

      if (data.length > 0 && !selectedProject && !isCreating) {
        loadProjectDetail(data[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memuat proyek.');
    } finally {
      setLoading(false);
    }
  };

  const loadProjectDetail = async (id: string) => {
    try {
      setLoading(true);
      const res = await api.getProject(id);
      setSelectedProject(res.project);
      setProjectTasks(res.tasks);
      setIsCreating(false);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat detail proyek.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchProjects();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartCreate = () => {
    setIsCreating(true);
    setIsEditing(false);
    setSelectedProject(null);
    setFormName('');
    setFormDescription('');
    setFormStatus('ACTIVE');
    setFormDueDate('');
  };

  const handleStartEdit = (proj: any) => {
    setIsEditing(true);
    setIsCreating(false);
    setFormName(proj.name);
    setFormDescription(proj.description || '');
    setFormStatus(proj.status);
    setFormDueDate(proj.dueDate ? proj.dueDate.split('T')[0] : '');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.warning('Nama proyek wajib diisi.', 'Validasi Form');
      return;
    }

    try {
      setLoading(true);
      if (isCreating) {
        await api.createProject({
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          status: formStatus,
          dueDate: formDueDate || undefined
        });
        toast.success(`Proyek "${formName.trim()}" berhasil dibuat.`);
      } else if (isEditing && selectedProject) {
        await api.updateProject(selectedProject.id, {
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          status: formStatus,
          dueDate: formDueDate || undefined
        });
        toast.success(`Perubahan proyek "${formName.trim()}" berhasil disimpan.`);
      }

      await fetchProjects();
      onProjectsUpdated();
      setIsCreating(false);
      setIsEditing(false);
    } catch (err: any) {
      toast.error(err.message || 'Terjadi kesalahan sistem.', 'Gagal Menyimpan Proyek');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const isConfirmed = await confirm({
      title: 'Hapus Proyek',
      message: `Hapus proyek "${name}"? Tugas terkait akan dipisahkan menjadi tugas mandiri.`,
      confirmText: 'Ya, Hapus Proyek',
      variant: 'danger'
    });
    if (!isConfirmed) return;

    try {
      setLoading(true);
      await api.deleteProject(id);
      setSelectedProject(null);
      await fetchProjects();
      onProjectsUpdated();
      toast.success(`Proyek "${name}" berhasil dihapus.`);
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus proyek.', 'Penghapusan Gagal');
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter((p) => {
    if (statusFilter === 'ALL') return true;
    return p.status === statusFilter;
  });

  const isMobileDetailView = Boolean(selectedProject || isCreating || isEditing);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl h-[92vh] sm:h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 sm:px-6 py-3 sm:py-4 border-b border-slate-800 bg-slate-800/40 gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide truncate">
                Manajemen Proyek
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 hidden sm:block truncate">
                Pantau progres tugas terintegrasi, target milestone, dan delegasi pekerjaan AI Team.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <button
              onClick={handleStartCreate}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-95"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Proyek Baru</span>
              <span className="sm:hidden">+ Baru</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body: Left List + Right Detail/Form */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Projects List */}
          <div className={`${isMobileDetailView ? 'hidden md:flex' : 'flex'} w-full md:w-80 border-r border-slate-800 bg-slate-900/60 flex-col shrink-0`}>
            {/* Filter Pills */}
            <div className="p-3 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto text-xs">
              {['ALL', 'ACTIVE', 'PLANNING', 'COMPLETED', 'ON_HOLD'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:text-white bg-slate-800/60'
                  }`}
                >
                  {st === 'ALL' ? 'Semua' : st}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
              {filteredProjects.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  Tidak ada proyek dengan status ini.
                </div>
              ) : (
                filteredProjects.map((p) => {
                  const badge = STATUS_BADGES[p.status] || STATUS_BADGES.ACTIVE;
                  const isSelected = selectedProject?.id === p.id && !isCreating;

                  return (
                    <div
                      key={p.id}
                      onClick={() => loadProjectDetail(p.id)}
                      className={`p-3.5 cursor-pointer transition space-y-2 ${
                        isSelected
                          ? 'bg-slate-800/90 border-l-2 border-amber-400'
                          : 'hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-bold text-white truncate flex-1">{p.name}</h4>
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1 font-mono">
                          <span>Progres: {p.progressPercentage}%</span>
                          <span>{p.completedTasks}/{p.totalTasks} Tugas</span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-amber-500 to-orange-500 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${p.progressPercentage}%` }}
                          />
                        </div>
                      </div>

                      {p.dueDate && (
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                          <Calendar className="w-3 h-3" />
                          <span>Target: {new Date(p.dueDate).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Detail or Form */}
          <div className={`${!isMobileDetailView ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-slate-900/40 overflow-hidden`}>
            {isCreating || isEditing ? (
              /* Create / Edit Form */
              <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setIsEditing(false);
                  }}
                  className="md:hidden flex items-center gap-1.5 text-xs text-amber-400 font-bold mb-2 hover:text-amber-300"
                >
                  ← Kembali ke Daftar Proyek
                </button>

                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">
                    {isCreating ? 'Buat Proyek Baru' : 'Edit Rincian Proyek'}
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreating(false);
                        setIsEditing(false);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{loading ? 'Menyimpan...' : 'Simpan'}</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Nama Proyek <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Migrasi Multi-Model AI Agent"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Deskripsi Proyek</label>
                  <textarea
                    rows={4}
                    placeholder="Jelaskan ruang lingkup, target deliverable, dan kriteria sukses..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Status Proyek</label>
                    <CustomSelect
                      value={formStatus}
                      onChange={(val) => setFormStatus(val as any)}
                      options={[
                        { value: 'PLANNING', label: 'PLANNING', badge: 'PLAN', badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
                        { value: 'ACTIVE', label: 'ACTIVE', badge: 'ACT', badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
                        { value: 'COMPLETED', label: 'COMPLETED', badge: 'DONE', badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
                        { value: 'ON_HOLD', label: 'ON_HOLD', badge: 'HOLD', badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20' }
                      ]}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Tenggat Waktu (Due Date)</label>
                    <CustomDatePicker
                      value={formDueDate}
                      onChange={(val) => setFormDueDate(val)}
                      placeholder="Pilih tenggat waktu proyek..."
                    />
                  </div>
                </div>
              </form>
            ) : selectedProject ? (
              /* Detail View */
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Mobile Back Button */}
                <div className="px-4 pt-3 pb-0 md:hidden bg-slate-850/40">
                  <button
                    type="button"
                    onClick={() => setSelectedProject(null)}
                    className="flex items-center gap-1.5 text-xs text-amber-400 font-bold hover:text-amber-300"
                  >
                    ← Kembali ke Daftar Proyek
                  </button>
                </div>

                {/* Detail Header */}
                <div className="p-4 sm:p-6 border-b border-slate-800/80 bg-slate-850/40 flex items-start justify-between">
                  <div className="space-y-1.5 flex-1 pr-4">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${STATUS_BADGES[selectedProject.status]?.bg} ${STATUS_BADGES[selectedProject.status]?.text}`}>
                        {selectedProject.status}
                      </span>
                      {selectedProject.dueDate && (
                        <span className="text-xs text-slate-400 font-mono">
                          Target: {new Date(selectedProject.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold text-white tracking-wide">{selectedProject.name}</h2>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {selectedProject.description || '(Tidak ada deskripsi rinci proyek)'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleStartEdit(selectedProject)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                      title="Edit Proyek"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(selectedProject.id, selectedProject.name)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-rose-400 transition"
                      title="Hapus Proyek"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Progress Overview Bar */}
                <div className="p-4 bg-slate-900/70 border-b border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
                  <div className="flex-1 w-full">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 font-mono">
                      <span>Progres Penyelesaian Tugas</span>
                      <span className="font-bold text-amber-400">
                        {selectedProject.progressPercentage}% ({selectedProject.completedTasks} dari {selectedProject.totalTasks} tugas selesai)
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-orange-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${selectedProject.progressPercentage}%` }}
                      />
                    </div>
                  </div>

                  {onOpenCreateTaskForProject && (
                    <button
                      onClick={() => onOpenCreateTaskForProject(selectedProject.id)}
                      className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-semibold whitespace-nowrap shrink-0 self-start sm:self-auto"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Tambah Tugas ke Proyek</span>
                    </button>
                  )}
                </div>

                {/* Linked Tasks List */}
                <div className="flex-1 p-6 overflow-y-auto space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Daftar Tugas dalam Proyek ({projectTasks.length})</span>
                  </h3>

                  {projectTasks.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                      Belum ada tugas yang dihubungkan ke proyek ini.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {projectTasks.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => onSelectTask && onSelectTask(t)}
                          className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 hover:border-blue-500/50 transition cursor-pointer flex items-center justify-between gap-3 group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${t.status === 'DONE' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-white group-hover:text-cyan-300 transition truncate">
                                {t.title}
                              </h4>
                              {t.description && (
                                <p className="text-[11px] text-slate-400 truncate mt-0.5">{t.description}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                              {t.status}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-cyan-400 transition" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-500 text-xs">
                <Layers className="w-12 h-12 text-slate-600 mb-3" />
                <p>Pilih proyek dari daftar di sebelah kiri atau buat proyek baru.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
