import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Play,
  RotateCw,
  Plus,
  ShieldAlert,
  Activity,
  Layers,
  Database,
  Bot,
  AlertTriangle,
  History,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Check,
  Zap,
  Info
} from 'lucide-react';
import {
  Task,
  Project,
  AgentSchedule,
  ScheduleExecution,
  ScheduleRoutineType,
  CreateScheduleDTO
} from '../../../../shared/types.js';
import { api } from '../../services/api.js';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  projects: Project[];
  onSelectTask?: (task: Task) => void;
}

export const CalendarModal: React.FC<CalendarModalProps> = ({
  isOpen,
  onClose,
  tasks,
  projects,
  onSelectTask
}) => {
  const [activeTab, setActiveTab] = useState<'routines' | 'calendar'>('routines');

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());

  // Schedules State
  const [schedules, setSchedules] = useState<AgentSchedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [runningScheduleId, setRunningScheduleId] = useState<string | null>(null);

  // History Modal State
  const [selectedScheduleHistory, setSelectedScheduleHistory] = useState<AgentSchedule | null>(null);
  const [executionHistory, setExecutionHistory] = useState<ScheduleExecution[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState<CreateScheduleDTO>({
    title: '',
    description: '',
    cronExpression: '0 * * * *',
    routineType: 'HEALTH_CHECK',
    payload: { objective: '' },
    isActive: true
  });
  const [submitting, setSubmitting] = useState(false);

  // Load schedules
  const loadSchedules = useCallback(async () => {
    try {
      setLoadingSchedules(true);
      const res = await api.getSchedules();
      if (res && res.data) {
        setSchedules(res.data);
      }
    } catch (err) {
      console.error('Failed to load schedules:', err);
    } finally {
      setLoadingSchedules(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadSchedules();
    }
  }, [isOpen, loadSchedules]);

  // Real-time SSE listener for scheduler events
  useEffect(() => {
    if (!isOpen) return;

    const eventSource = new EventSource('/api/realtime');

    eventSource.addEventListener('schedule.executed', (e: MessageEvent) => {
      try {
        const execution: ScheduleExecution = JSON.parse(e.data);
        setSchedules((prev) =>
          prev.map((s) => {
            if (s.id === execution.scheduleId) {
              return {
                ...s,
                lastStatus: execution.status,
                lastResultSummary: execution.outputSummary,
                totalRuns: s.totalRuns + 1,
                lastRunAt: execution.startedAt
              };
            }
            return s;
          })
        );
      } catch (err) {
        console.error('SSE schedule.executed parse error:', err);
      }
    });

    eventSource.addEventListener('schedule.status', (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.scheduleId && payload.status) {
          setSchedules((prev) =>
            prev.map((s) => (s.id === payload.scheduleId ? { ...s, lastStatus: payload.status } : s))
          );
        }
      } catch (err) {
        console.error('SSE schedule.status parse error:', err);
      }
    });

    return () => {
      eventSource.close();
    };
  }, [isOpen]);

  // Keyboard shortcut (Escape)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedScheduleHistory) {
          setSelectedScheduleHistory(null);
        } else if (isCreateOpen) {
          setIsCreateOpen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, selectedScheduleHistory, isCreateOpen]);

  if (!isOpen) return null;

  // Calendar helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const getTasksForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return tasks.filter((t) => t.dueDate === dateStr);
  };

  // Schedule Action Handlers
  const handleRunNow = async (scheduleId: string) => {
    try {
      setRunningScheduleId(scheduleId);
      const res = await api.runScheduleNow(scheduleId);
      if (res && res.data) {
        setSchedules((prev) =>
          prev.map((s) =>
            s.id === scheduleId
              ? {
                  ...s,
                  lastStatus: res.data.status,
                  lastResultSummary: res.data.outputSummary,
                  totalRuns: s.totalRuns + 1,
                  lastRunAt: res.data.startedAt
                }
              : s
          )
        );
      }
    } catch (err: any) {
      alert(`Gagal menjalankan jadwal: ${err.message || err}`);
    } finally {
      setRunningScheduleId(null);
    }
  };

  const handleToggle = async (scheduleId: string) => {
    try {
      const res = await api.toggleSchedule(scheduleId);
      if (res && res.data) {
        setSchedules((prev) => prev.map((s) => (s.id === scheduleId ? res.data : s)));
      }
    } catch (err: any) {
      alert(`Gagal mengubah status jadwal: ${err.message || err}`);
    }
  };

  const handleDelete = async (scheduleId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus jadwal rutinitas ini?')) return;
    try {
      await api.deleteSchedule(scheduleId);
      setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
    } catch (err: any) {
      alert(`Gagal menghapus jadwal: ${err.message || err}`);
    }
  };

  const handleViewHistory = async (schedule: AgentSchedule) => {
    setSelectedScheduleHistory(schedule);
    try {
      setLoadingHistory(true);
      const res = await api.getScheduleHistory(schedule.id, 20);
      if (res && res.data) {
        setExecutionHistory(res.data);
      }
    } catch (err: any) {
      console.error('Failed to load history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return alert('Judul jadwal wajib diisi.');
    if (!formData.cronExpression.trim()) return alert('Ekspresi cron wajib diisi.');

    try {
      setSubmitting(true);
      const res = await api.createSchedule(formData);
      if (res && res.data) {
        setSchedules((prev) => [...prev, res.data]);
        setIsCreateOpen(false);
        setFormData({
          title: '',
          description: '',
          cronExpression: '0 * * * *',
          routineType: 'HEALTH_CHECK',
          payload: { objective: '' },
          isActive: true
        });
      }
    } catch (err: any) {
      alert(`Gagal membuat jadwal: ${err.message || err}`);
    } finally {
      setSubmitting(false);
    }
  };

  const applyPreset = (preset: {
    title: string;
    description: string;
    cronExpression: string;
    routineType: ScheduleRoutineType;
    payload?: any;
  }) => {
    setFormData({
      ...formData,
      title: preset.title,
      description: preset.description,
      cronExpression: preset.cronExpression,
      routineType: preset.routineType,
      payload: preset.payload || {}
    });
  };

  const getRoutineBadge = (type: ScheduleRoutineType) => {
    switch (type) {
      case 'HEALTH_CHECK':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <Activity className="w-2.5 h-2.5" /> Health Check
          </span>
        );
      case 'SECURITY_AUDIT':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <ShieldAlert className="w-2.5 h-2.5" /> Security Audit
          </span>
        );
      case 'SWARM_MISSION':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
            <Layers className="w-2.5 h-2.5" /> Swarm Mission
          </span>
        );
      case 'VECTOR_REINDEX':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/30">
            <Database className="w-2.5 h-2.5" /> RAG Vector Sync
          </span>
        );
      case 'AGENT_TASK':
      default:
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <Bot className="w-2.5 h-2.5" /> Agent Routine
          </span>
        );
    }
  };

  const formatCronReadable = (cron: string) => {
    const trimmed = cron.trim();
    if (trimmed === '0 * * * *' || trimmed === '@hourly') return 'Setiap Jam';
    if (trimmed === '0 0 * * *' || trimmed === '@daily' || trimmed === '@midnight') return 'Setiap Hari (00:00)';
    if (trimmed === '0 2 * * *') return 'Setiap Hari (02:00 Pagi)';
    if (trimmed === '0 4 * * *') return 'Setiap Hari (04:00 Pagi)';
    if (trimmed === '0 3 * * 1') return 'Setiap Senin (03:00 Pagi)';
    if (trimmed === '0 0 * * 0' || trimmed === '@weekly') return 'Setiap Minggu (00:00)';
    if (trimmed.startsWith('*/5')) return 'Setiap 5 Menit';
    if (trimmed.startsWith('*/15')) return 'Setiap 15 Menit';
    if (trimmed.startsWith('*/30')) return 'Setiap 30 Menit';
    return `Cron: ${trimmed}`;
  };

  const activeSchedulesCount = schedules.filter((s) => s.isActive).length;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0D121F] border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[94vh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-800 bg-[#080B13] gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0 shadow-inner">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white truncate">
                  Penjadwal & Rutinitas Otonom
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                  Daemon Active
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 hidden sm:block truncate">
                Otomatisasi terjadwal berbasis Cron untuk agen, audit keamanan, dan misi Swarm proaktif.
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center bg-slate-900/90 border border-slate-800 rounded-xl p-1 shrink-0">
            <button
              onClick={() => setActiveTab('routines')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                activeTab === 'routines'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Rutinitas Otonom</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-black/40">
                {activeSchedulesCount}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                activeTab === 'calendar'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Kalender Tugas</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="p-1.5 sm:p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        {activeTab === 'routines' ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {/* Action Bar */}
            <div className="flex items-center justify-between gap-3 bg-slate-900/50 border border-slate-800/80 rounded-xl p-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-slate-300 font-medium">
                  {schedules.length} Rutinitas Terdaftar ({activeSchedulesCount} Aktif)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadSchedules}
                  disabled={loadingSchedules}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  title="Segarkan data jadwal"
                >
                  <RotateCw className={`w-4 h-4 ${loadingSchedules ? 'animate-spin text-indigo-400' : ''}`} />
                </button>
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-md transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Rutinitas</span>
                </button>
              </div>
            </div>

            {/* Schedules List */}
            {loadingSchedules && schedules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                <RotateCw className="w-6 h-6 animate-spin text-indigo-400" />
                <span className="text-xs">Memuat rutinitas jadwal otonom...</span>
              </div>
            ) : schedules.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-slate-800 rounded-2xl p-6 bg-slate-950/20">
                <Bot className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-slate-300">Belum ada rutinitas terjadwal</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Tambahkan jadwal berkala agar sistem secara proaktif melakukan audit keamanan, cek kesehatan, atau memicu misi Swarm.
                </p>
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-lg"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Buat Rutinitas Pertama</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {schedules.map((schedule) => {
                  const isRunning = schedule.lastStatus === 'RUNNING' || runningScheduleId === schedule.id;
                  const isFailed = schedule.lastStatus === 'FAILED';

                  return (
                    <div
                      key={schedule.id}
                      className={`rounded-2xl border p-4 transition-all duration-200 flex flex-col justify-between ${
                        isRunning
                          ? 'bg-indigo-950/20 border-indigo-500/40 shadow-lg shadow-indigo-500/5'
                          : schedule.isActive
                          ? 'bg-[#111624] border-slate-800/90 hover:border-slate-700'
                          : 'bg-slate-950/40 border-slate-900 opacity-60'
                      }`}
                    >
                      <div className="space-y-3">
                        {/* Top row: Badges & Toggle */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {getRoutineBadge(schedule.routineType)}
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700/60">
                              {formatCronReadable(schedule.cronExpression)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleToggle(schedule.id)}
                              className="text-slate-400 hover:text-white transition p-1"
                              title={schedule.isActive ? 'Nonaktifkan Rutinitas' : 'Aktifkan Rutinitas'}
                            >
                              {schedule.isActive ? (
                                <ToggleRight className="w-5 h-5 text-emerald-400" />
                              ) : (
                                <ToggleLeft className="w-5 h-5 text-slate-600" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Title & Description */}
                        <div>
                          <h3 className="text-sm font-bold text-white leading-snug">{schedule.title}</h3>
                          {schedule.description && (
                            <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                              {schedule.description}
                            </p>
                          )}
                        </div>

                        {/* Status Summary */}
                        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 text-[11px] space-y-1">
                          <div className="flex items-center justify-between text-slate-400 font-mono">
                            <span className="flex items-center gap-1">
                              {isRunning ? (
                                <>
                                  <RotateCw className="w-3 h-3 animate-spin text-indigo-400" />
                                  <span className="text-indigo-400 font-bold">Sedang Berjalan...</span>
                                </>
                              ) : isFailed ? (
                                <>
                                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                                  <span className="text-rose-400 font-bold">Gagal</span>
                                </>
                              ) : schedule.lastStatus === 'SUCCESS' ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span className="text-emerald-400 font-bold">Berhasil</span>
                                </>
                              ) : (
                                <span className="text-slate-500">Menunggu Jadwal</span>
                              )}
                            </span>
                            <span>Total Eksekusi: {schedule.totalRuns}</span>
                          </div>

                          {schedule.lastResultSummary && (
                            <p className="text-slate-300 font-mono text-[10px] truncate" title={schedule.lastResultSummary}>
                              {schedule.lastResultSummary}
                            </p>
                          )}

                          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                            <span>
                              Jadwal Berikutnya:{' '}
                              {schedule.nextRunAt
                                ? new Date(schedule.nextRunAt).toLocaleTimeString('id-ID', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })
                                : '-'}
                            </span>
                            <span>
                              Terakhir:{' '}
                              {schedule.lastRunAt
                                ? new Date(schedule.lastRunAt).toLocaleTimeString('id-ID', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })
                                : '-'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom actions */}
                      <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-slate-800/60">
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                          <span className="text-slate-500">Cron:</span>
                          <code className="text-indigo-300 font-bold">{schedule.cronExpression}</code>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleViewHistory(schedule)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                            title="Lihat Riwayat Eksekusi"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(schedule.id)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition"
                            title="Hapus Rutinitas"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRunNow(schedule.id)}
                            disabled={isRunning}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm ${
                              isRunning
                                ? 'bg-indigo-600/40 text-indigo-300 cursor-not-allowed'
                                : 'bg-emerald-600/90 hover:bg-emerald-500 text-white'
                            }`}
                          >
                            {isRunning ? (
                              <RotateCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Play className="w-3 h-3 fill-current" />
                            )}
                            <span>Jalankan</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Calendar Grid Tab */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Calendar Nav */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 border-b border-slate-800 bg-slate-900/40">
              <div className="flex items-center gap-3">
                <h3 className="text-xs sm:text-sm font-bold text-white font-mono">
                  {monthNames[month]} {year}
                </h3>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="p-1 sm:p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="p-1 sm:p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Days Grid */}
            <div className="p-2 sm:p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center text-[10px] sm:text-xs font-bold text-slate-400 font-mono">
                <span>MIN</span><span>SEN</span><span>SEL</span><span>RAB</span><span>KAM</span><span>JUM</span><span>SAB</span>
              </div>

              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="min-h-[52px] sm:min-h-[85px] rounded-lg sm:rounded-xl bg-slate-950/20 border border-transparent" />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dayTasks = getTasksForDay(day);
                  const isToday =
                    new Date().getDate() === day &&
                    new Date().getMonth() === month &&
                    new Date().getFullYear() === year;

                  return (
                    <div
                      key={`day-${day}`}
                      className={`min-h-[52px] sm:min-h-[85px] p-1 sm:p-2 rounded-lg sm:rounded-xl border flex flex-col justify-between transition ${
                        isToday
                          ? 'bg-blue-950/30 border-blue-500/50'
                          : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] sm:text-xs font-mono font-bold ${isToday ? 'text-blue-400' : 'text-slate-300'}`}>
                          {day}
                        </span>
                        {dayTasks.length > 0 && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-300">
                            {dayTasks.length}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 mt-1 overflow-y-auto max-h-[55px]">
                        {dayTasks.map((t) => (
                          <div
                            key={t.id}
                            onClick={() => onSelectTask && onSelectTask(t)}
                            className={`text-[10px] p-1 rounded truncate font-medium flex items-center gap-1 cursor-pointer transition hover:opacity-80 ${
                              t.status === 'DONE'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-900 text-slate-200 border border-slate-800'
                            }`}
                            title={`${t.title} (Klik untuk rincian)`}
                          >
                            {t.status === 'DONE' ? <CheckCircle2 className="w-2.5 h-2.5 shrink-0" /> : <Clock className="w-2.5 h-2.5 shrink-0" />}
                            <span className="truncate">{t.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-800 bg-[#080B13] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <span>AI Center Proactive Engine</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* Modal: Buat Rutinitas Baru */}
      {isCreateOpen && (
        <div
          onClick={() => setIsCreateOpen(false)}
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#101726] border border-slate-700 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" />
                <span>Tambah Rutinitas Otonom Baru</span>
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Presets Row */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                Template Cepat (Preset)
              </label>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    applyPreset({
                      title: 'Pemeriksaan Kesehatan Server & Telemetri',
                      description: 'Audit berkala latensi database, memori server, dan kesiapan agen.',
                      cronExpression: '0 * * * *',
                      routineType: 'HEALTH_CHECK'
                    })
                  }
                  className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-emerald-500/50 text-left text-slate-300 hover:text-emerald-300 transition"
                >
                  <div className="font-semibold text-emerald-400">Health Check</div>
                  <div className="text-[10px] text-slate-500">Setiap Jam (@hourly)</div>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyPreset({
                      title: 'Audit Keamanan & Integritas Sandbox Harian',
                      description: 'Pemeriksaan berkala aksi diblokir dan proteksi sandbox.',
                      cronExpression: '0 2 * * *',
                      routineType: 'SECURITY_AUDIT'
                    })
                  }
                  className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-500/50 text-left text-slate-300 hover:text-amber-300 transition"
                >
                  <div className="font-semibold text-amber-400">Security Audit</div>
                  <div className="text-[10px] text-slate-500">Setiap Hari 02:00</div>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyPreset({
                      title: 'Swarm Autonomous Codebase Audit',
                      description: 'Misi multi-agent untuk dekomposisi audit dan review arsitektur.',
                      cronExpression: '0 3 * * 1',
                      routineType: 'SWARM_MISSION',
                      payload: { objective: 'Audit integritas codebase, dependensi, dan acceptance criteria.' }
                    })
                  }
                  className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-indigo-500/50 text-left text-slate-300 hover:text-indigo-300 transition"
                >
                  <div className="font-semibold text-indigo-400">Swarm Code Audit</div>
                  <div className="text-[10px] text-slate-500">Setiap Senin 03:00</div>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyPreset({
                      title: 'Sinkronisasi Indeks Memori Semantik RAG',
                      description: 'Verifikasi status chunk embedding vektor pada pgvector HNSW.',
                      cronExpression: '0 4 * * *',
                      routineType: 'VECTOR_REINDEX'
                    })
                  }
                  className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-purple-500/50 text-left text-slate-300 hover:text-purple-300 transition"
                >
                  <div className="font-semibold text-purple-400">RAG Vector Sync</div>
                  <div className="text-[10px] text-slate-500">Setiap Hari 04:00</div>
                </button>
              </div>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3 pt-2 border-t border-slate-800">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Judul Rutinitas *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Contoh: Audit Keamanan Otomatis"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Tipe Rutinitas *</label>
                  <select
                    value={formData.routineType}
                    onChange={(e) => setFormData({ ...formData, routineType: e.target.value as ScheduleRoutineType })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="HEALTH_CHECK">Pemeriksaan Kesehatan</option>
                    <option value="SECURITY_AUDIT">Audit Keamanan Sandbox</option>
                    <option value="SWARM_MISSION">Misi Swarm Multi-Agent</option>
                    <option value="VECTOR_REINDEX">Sinkronisasi Memori Vektor</option>
                    <option value="AGENT_TASK">Tugas Mandiri Agen</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Ekspresi Cron *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.cronExpression}
                    onChange={(e) => setFormData({ ...formData, cronExpression: e.target.value })}
                    placeholder="0 * * * * atau @hourly"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Deskripsi</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Penjelasan ringkas tujuan rutinitas..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              {formData.routineType === 'SWARM_MISSION' && (
                <div>
                  <label className="text-xs font-semibold text-indigo-300 block mb-1">
                    Objektif Misi Swarm
                  </label>
                  <textarea
                    rows={2}
                    value={formData.payload?.objective || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        payload: { ...formData.payload, objective: e.target.value }
                      })
                    }
                    placeholder="Tentukan target pekerjaan yang akan didekomposisi oleh swarm..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-indigo-500/40 text-white text-xs focus:outline-none focus:border-indigo-400"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg transition flex items-center gap-1.5"
                >
                  {submitting && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Simpan Rutinitas</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Riwayat Eksekusi */}
      {selectedScheduleHistory && (
        <div
          onClick={() => setSelectedScheduleHistory(null)}
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#101726] border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#080B13]">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-400" />
                  <span>Riwayat Eksekusi: {selectedScheduleHistory.title}</span>
                </h3>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Cron: {selectedScheduleHistory.cronExpression} | Total Runs: {selectedScheduleHistory.totalRuns}
                </p>
              </div>
              <button
                onClick={() => setSelectedScheduleHistory(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
              {loadingHistory ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <RotateCw className="w-5 h-5 animate-spin text-indigo-400" />
                  <span className="text-xs">Memuat log eksekusi...</span>
                </div>
              ) : executionHistory.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  Belum ada catatan eksekusi untuk jadwal ini.
                </div>
              ) : (
                executionHistory.map((exec) => (
                  <div
                    key={exec.id}
                    className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-900/60 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            exec.status === 'SUCCESS'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {exec.status}
                        </span>
                        <span className="text-slate-400 font-mono text-[11px]">
                          {new Date(exec.startedAt).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <span className="text-slate-500 font-mono text-[11px]">
                        {exec.durationMs !== undefined ? `${exec.durationMs}ms` : '-'}
                      </span>
                    </div>

                    {exec.outputSummary && (
                      <p className="text-slate-300 font-mono text-[11px] bg-black/40 p-2 rounded-lg border border-slate-800">
                        {exec.outputSummary}
                      </p>
                    )}

                    {exec.errorMessage && (
                      <p className="text-rose-400 font-mono text-[11px] bg-rose-950/20 p-2 rounded-lg border border-rose-900/50">
                        Error: {exec.errorMessage}
                      </p>
                    )}

                    {exec.missionId && (
                      <div className="text-[10px] text-indigo-400 font-mono flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        <span>Misi Swarm Terkait: {exec.missionId}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="px-5 py-3 border-t border-slate-800 bg-[#080B13] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedScheduleHistory(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
