import React, { useState } from 'react';
import {
  X,
  Clock,
  Play,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Power,
  Calendar,
  Zap,
  Activity,
  Bot,
  Terminal,
  ShieldCheck,
  Check,
  Layers
} from 'lucide-react';

interface CronDaemon {
  id: string;
  name: string;
  cronExpr: string;
  humanSchedule: string;
  targetRole: string;
  description: string;
  isActive: boolean;
  lastRunStatus: 'SUCCESS' | 'RUNNING' | 'FAILED' | 'PENDING';
  lastRunTime: string;
  nextRunTime: string;
}

interface CronDaemonsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerTask?: () => void;
}

export const CronDaemonsModal: React.FC<CronDaemonsModalProps> = ({
  isOpen,
  onClose,
  onTriggerTask
}) => {
  const [daemons, setDaemons] = useState<CronDaemon[]>([
    {
      id: 'daemon-standup',
      name: 'Daily Morning Standup & Commit Digest',
      cronExpr: '0 8 * * 1-5',
      humanSchedule: 'Setiap Hari Kerja • 08:00 WIB',
      targetRole: 'Lead Architect',
      description:
        'Merangkum seluruh PR yang di-merge, commit git 24 jam terakhir, dan status task ke channel komunikasi tim.',
      isActive: true,
      lastRunStatus: 'SUCCESS',
      lastRunTime: 'Hari ini, 08:00 WIB',
      nextRunTime: 'Besok, 08:00 WIB'
    },
    {
      id: 'daemon-sre',
      name: 'SRE Production Health & Latency Sentinel',
      cronExpr: '*/10 * * * *',
      humanSchedule: 'Setiap 10 Menit',
      targetRole: 'Autonomous SRE',
      description:
        'Memeriksa latensi query database (>100ms), ketersediaan memori, dan mengisolasi query lambat secara proaktif.',
      isActive: true,
      lastRunStatus: 'SUCCESS',
      lastRunTime: '5 menit lalu',
      nextRunTime: 'Dalam 5 menit'
    },
    {
      id: 'daemon-cve',
      name: 'Weekly Security CVE & Dependency Sweep',
      cronExpr: '0 18 * * 5',
      humanSchedule: 'Setiap Jumat • 18:00 WIB',
      targetRole: 'Security Auditor',
      description:
        'Memindai basis data CVE terbaru terhadap pustaka npm & pip proyek, lalu menyusun usulan patch keamanan otomatis.',
      isActive: true,
      lastRunStatus: 'SUCCESS',
      lastRunTime: '17 Okt 2026, 18:00 WIB',
      nextRunTime: '24 Okt 2026, 18:00 WIB'
    },
    {
      id: 'daemon-memory',
      name: 'AST Codebase Memory Graph Re-Indexing',
      cronExpr: '0 2 * * *',
      humanSchedule: 'Setiap Hari • 02:00 WIB',
      targetRole: 'System Indexer',
      description:
        'Mengindeks ulang graf AST dan relasi dependensi simbolik lintas repositori saat jam beban server terendah.',
      isActive: false,
      lastRunStatus: 'PENDING',
      lastRunTime: '19 Okt 2026, 02:00 WIB',
      nextRunTime: 'Dijeda oleh pengguna'
    }
  ]);

  const [runningId, setRunningId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleToggle = (id: string) => {
    setDaemons((prev) =>
      prev.map((d) => (d.id === id ? { ...d, isActive: !d.isActive } : d))
    );
  };

  const handleRunNow = (daemon: CronDaemon) => {
    setRunningId(daemon.id);
    setSuccessToast(null);

    setTimeout(() => {
      setRunningId(null);
      setSuccessToast(`Daemon "${daemon.name}" berhasil dieksekusi! Laporan telah dibuat.`);
      if (onTriggerTask) onTriggerTask();
      setTimeout(() => setSuccessToast(null), 4000);
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/85 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Box */}
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl shadow-2xl shadow-black/90 flex flex-col max-h-[92vh] overflow-hidden z-10">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-pink-600 to-rose-600 text-white shadow-lg shadow-pink-500/20">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">Scheduled Autonomous Daemons</h3>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20">
                  24/7 Background Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Agen AI berjalan mandiri sesuai jadwal cron tanpa memerlukan klik manual dari operator manusia
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success Banner */}
        {successToast && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 sm:p-7 overflow-y-auto space-y-4 flex-1 text-sm text-slate-300">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-1">
            <span>Daftar Daemon Aktif ({daemons.filter((d) => d.isActive).length}/{daemons.length})</span>
            <span className="font-mono">Engine: Node-Cron Scheduler v3.0</span>
          </div>

          <div className="space-y-3.5">
            {daemons.map((daemon) => (
              <div
                key={daemon.id}
                className={`p-4 rounded-2xl border transition-all ${
                  daemon.isActive
                    ? 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    : 'bg-slate-950/30 border-slate-900 opacity-60'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-sm">{daemon.name}</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-900 text-cyan-400 border border-slate-800 font-mono text-[10px]">
                        {daemon.cronExpr}
                      </span>
                      <span className="text-slate-500 text-xs">•</span>
                      <span className="text-xs text-slate-400 font-medium">
                        {daemon.humanSchedule}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
                      {daemon.description}
                    </p>

                    <div className="flex items-center gap-4 text-[11px] text-slate-500 font-mono pt-1">
                      <span>
                        Agen Penanggung Jawab: <strong className="text-slate-300">{daemon.targetRole}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Eksekusi Terakhir: <strong className="text-slate-300">{daemon.lastRunTime}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Jadwal Berikutnya: <strong className="text-emerald-400">{daemon.nextRunTime}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => handleRunNow(daemon)}
                      disabled={runningId === daemon.id}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5 disabled:opacity-50"
                      title="Jalankan manual sekarang"
                    >
                      {runningId === daemon.id ? (
                        <RotateCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-slate-300" />
                      )}
                      <span>{runningId === daemon.id ? 'Memproses...' : 'Uji Sekarang'}</span>
                    </button>

                    <button
                      onClick={() => handleToggle(daemon.id)}
                      className={`p-2 rounded-xl border transition ${
                        daemon.isActive
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-slate-900 border-slate-800 text-slate-500'
                      }`}
                      title={daemon.isActive ? 'Nonaktifkan Daemon' : 'Aktifkan Daemon'}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div>
            <span>Daemons berjalan persisten di background service Railway dengan isolasi memori</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors"
            >
              Tutup Daemon Engine
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
