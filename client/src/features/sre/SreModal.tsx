import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert,
  Activity,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Play,
  FileText,
  X,
  Server,
  Zap,
  Cpu,
  HardDrive,
  Database,
  Lock,
  RotateCcw
} from 'lucide-react';
import { api } from '../../services/api.js';
import { SreIncident, SreScanResult } from '../../../../shared/types.js';

interface SreModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SreModal: React.FC<SreModalProps> = ({ isOpen, onClose }) => {
  const [incidents, setIncidents] = useState<SreIncident[]>([]);
  const [scanResult, setScanResult] = useState<SreScanResult | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<SreIncident | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchIncidents = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getSreIncidents(statusFilter === 'ALL' ? undefined : statusFilter);
      setIncidents(data);
      if (selectedIncident) {
        const updated = data.find((i) => i.id === selectedIncident.id);
        if (updated) setSelectedIncident(updated);
      }
    } catch (err: any) {
      console.error('Failed to load SRE incidents:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, selectedIncident?.id]);

  useEffect(() => {
    if (isOpen) {
      fetchIncidents();
    }
  }, [isOpen, fetchIncidents]);

  // Escape key handler contract
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleRunScan = async () => {
    try {
      setScanning(true);
      setMessage(null);
      const res = await api.scanSreHealth();
      setScanResult(res);
      await fetchIncidents();
      if (res.detectedIncidents.length > 0) {
        setMessage({
          text: `Pemindaian selesai: Terdeteksi ${res.detectedIncidents.length} anomali baru!`,
          type: 'error'
        });
      } else {
        setMessage({
          text: 'Pemindaian selesai: Semua sub-sistem beroperasi dalam ambang batas optimal (HEALTHY).',
          type: 'success'
        });
      }
    } catch (err: any) {
      setMessage({ text: `Gagal memindai kesehatan sistem: ${err.message}`, type: 'error' });
    } finally {
      setScanning(false);
    }
  };

  const handleInvestigate = async (id: string) => {
    try {
      setActionLoading(true);
      setMessage(null);
      const updated = await api.investigateSreIncident(id);
      setSelectedIncident(updated);
      await fetchIncidents();
      setMessage({
        text: `Investigasi mendalam selesai. Rekomendasi playbook disiapkan.`,
        type: 'success'
      });
    } catch (err: any) {
      setMessage({ text: `Gagal menginvestigasi insiden: ${err.message}`, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemediate = async (id: string) => {
    try {
      setActionLoading(true);
      setMessage(null);
      const updated = await api.remediateSreIncident(id);
      setSelectedIncident(updated);
      await fetchIncidents();
      setMessage({
        text: `Playbook berhasil dieksekusi! Status insiden: RESOLVED.`,
        type: 'success'
      });
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal mengeksekusi remediasi.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      setActionLoading(true);
      setMessage(null);
      const updated = await api.approveSreIncident(id);
      setSelectedIncident(updated);
      await fetchIncidents();
      setMessage({
        text: `Remediasi disetujui & dieksekusi dengan sukses! Post-Mortem diterbitkan.`,
        type: 'success'
      });
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal menyetujui insiden.', type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-[#0f172a] border border-slate-700/80 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Autonomous SRE & Server Self-Healing Agent
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  DAEMON ACTIVE
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Pemantauan proaktif, deteksi anomali real-time, investigasi akar masalah, dan playbook remediasi mandiri
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRunScan}
              disabled={scanning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
              <span>{scanning ? 'Memindai...' : 'Pindai Telemetri'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notifications / Banners */}
        {message && (
          <div
            className={`px-6 py-2.5 text-xs flex items-center justify-between border-b ${
              message.type === 'success'
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
                : 'bg-rose-950/40 text-rose-300 border-rose-800/40'
            }`}
          >
            <span>{message.text}</span>
            <button
              type="button"
              onClick={() => setMessage(null)}
              className="text-slate-400 hover:text-white ml-2 text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Quick Host Health Strip */}
        {scanResult && (
          <div className="px-6 py-3 bg-slate-900/30 border-b border-slate-800/80 flex flex-wrap items-center gap-6 text-xs font-mono">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Cpu className="w-3.5 h-3.5 text-blue-400" />
              <span>CPU: {scanResult.metrics.cpuPercent}%</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <HardDrive className="w-3.5 h-3.5 text-purple-400" />
              <span>RAM: {scanResult.metrics.memoryPercent}%</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <Server className="w-3.5 h-3.5 text-cyan-400" />
              <span>Disk: {scanResult.metrics.diskPercent}%</span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>PG Active Connections: {scanResult.metrics.activeConnections}</span>
            </div>
            <div className="ml-auto text-slate-400 text-[11px]">
              Waktu Pindai: {new Date(scanResult.timestamp).toLocaleTimeString()}
            </div>
          </div>
        )}

        {/* Body Layout: Incidents List (Left) & Incident Detail / Post-Mortem (Right) */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
          {/* Left Column: Incidents List */}
          <div className="lg:col-span-5 p-4 flex flex-col h-full overflow-hidden">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 mb-3">
              {['ALL', 'OPEN', 'INVESTIGATING', 'RESOLVED'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                    statusFilter === st
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {loading && incidents.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                  <span>Memuat daftar insiden SRE...</span>
                </div>
              ) : incidents.length === 0 ? (
                <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-xl">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                  <p className="text-sm font-semibold text-slate-300">Kondisi Sistem Prima</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Tidak ada insiden aktif dengan filter saat ini.
                  </p>
                </div>
              ) : (
                incidents.map((inc) => {
                  const isSelected = selectedIncident?.id === inc.id;
                  const isCritical = inc.severity === 'CRITICAL';
                  const isHigh = inc.severity === 'HIGH';
                  const isResolved = inc.status === 'RESOLVED';

                  return (
                    <div
                      key={inc.id}
                      onClick={() => setSelectedIncident(inc)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition text-left ${
                        isSelected
                          ? 'bg-slate-800/90 border-blue-500/50 shadow-md ring-1 ring-blue-500/30'
                          : 'bg-slate-900/40 border-slate-800 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                            isCritical
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : isHigh
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                          }`}
                        >
                          {inc.severity} • {inc.incidentType}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                            isResolved
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/30 animate-pulse'
                          }`}
                        >
                          {inc.status}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-white mb-1 line-clamp-1">{inc.title}</h4>
                      <p className="text-[11px] text-slate-400 line-clamp-2">{inc.description}</p>
                      <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                        <span>{new Date(inc.createdAt).toLocaleString()}</span>
                        {inc.requiresApproval && !inc.isApproved && (
                          <span className="flex items-center gap-1 text-amber-400 font-semibold">
                            <Lock className="w-3 h-3" /> Butuh Approval
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Deep Diagnostics & Post-Mortem */}
          <div className="lg:col-span-7 p-6 flex flex-col h-full overflow-y-auto bg-slate-950/40">
            {selectedIncident ? (
              <div className="space-y-5">
                {/* Header Info */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-mono text-slate-400">{selectedIncident.id}</span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                          selectedIncident.severity === 'CRITICAL'
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {selectedIncident.severity}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {selectedIncident.status}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white">{selectedIncident.title}</h3>
                  </div>

                  {/* Action Controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    {selectedIncident.status !== 'RESOLVED' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleInvestigate(selectedIncident.id)}
                          disabled={actionLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition disabled:opacity-50 border border-slate-700"
                        >
                          <Activity className="w-3.5 h-3.5 text-blue-400" />
                          <span>Investigasi Akar Masalah</span>
                        </button>

                        {selectedIncident.requiresApproval && !selectedIncident.isApproved ? (
                          <button
                            type="button"
                            onClick={() => handleApprove(selectedIncident.id)}
                            disabled={actionLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md transition disabled:opacity-50"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>Setujui & Jalankan Playbook</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRemediate(selectedIncident.id)}
                            disabled={actionLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition disabled:opacity-50"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Remediasi Mandiri</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Deskripsi & Ringkasan */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                  <h4 className="text-xs font-bold text-slate-300 mb-1">Deskripsi Anomali:</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{selectedIncident.description}</p>
                </div>

                {/* Remediation Plan */}
                {selectedIncident.remediationPlan && (
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                    <h4 className="text-xs font-bold text-cyan-400 mb-2 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5" />
                      <span>Rencana Playbook Remediasi:</span>
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-2">
                      <div className="text-slate-400">
                        Playbook:{' '}
                        <span className="text-white font-bold">
                          {selectedIncident.remediationPlan.playbook}
                        </span>
                      </div>
                      <div className="text-slate-400">
                        Estimasi Pemulihan:{' '}
                        <span className="text-white">
                          {selectedIncident.remediationPlan.estimatedRecoverySec}s
                        </span>
                      </div>
                      <div className="text-slate-400">
                        Destruktif:{' '}
                        <span
                          className={
                            selectedIncident.remediationPlan.isDestructive
                              ? 'text-rose-400 font-bold'
                              : 'text-emerald-400'
                          }
                        >
                          {selectedIncident.remediationPlan.isDestructive ? 'YA' : 'TIDAK'}
                        </span>
                      </div>
                      <div className="text-slate-400">
                        Human Approval Gate:{' '}
                        <span
                          className={
                            selectedIncident.requiresApproval
                              ? 'text-amber-400 font-bold'
                              : 'text-slate-300'
                          }
                        >
                          {selectedIncident.requiresApproval ? 'DIBUTUHKAN' : 'OTONOM'}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-300 italic">
                      "{selectedIncident.remediationPlan.description}"
                    </p>
                  </div>
                )}

                {/* Root Cause Diagnostics */}
                {selectedIncident.diagnostics?.rootCauseAnalysis && (
                  <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-800/40">
                    <h4 className="text-xs font-bold text-blue-300 mb-1 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5" />
                      <span>Analisis Diagnostik Agen:</span>
                    </h4>
                    <p className="text-xs text-slate-300 mb-1">
                      {selectedIncident.diagnostics.rootCauseAnalysis.probableCause}
                    </p>
                    <p className="text-xs text-blue-400 font-semibold">
                      Saran: {selectedIncident.diagnostics.rootCauseAnalysis.remediationRecommendation}
                    </p>
                  </div>
                )}

                {/* Post-Mortem Report Viewer */}
                {selectedIncident.postMortem ? (
                  <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="flex items-center gap-2 mb-3 text-emerald-400">
                      <FileText className="w-4 h-4" />
                      <h4 className="text-xs font-bold uppercase tracking-wider">
                        Laporan Post-Mortem Resmi
                      </h4>
                    </div>
                    <div className="prose prose-invert prose-xs max-w-none text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed bg-black/40 p-4 rounded-lg border border-slate-800/80">
                      {selectedIncident.postMortem}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-500 text-xs">
                    Insiden belum ditutup. Post-mortem otomatis akan dihasilkan setelah proses remediasi selesai.
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500">
                <ShieldAlert className="w-12 h-12 text-slate-700 mb-3" />
                <p className="text-sm font-semibold text-slate-400">Pilih Insiden</p>
                <p className="text-xs text-slate-600 max-w-xs mt-1">
                  Pilih salah satu insiden dari daftar sebelah kiri untuk menelaah diagnostik akar masalah dan mengeksekusi playbook perbaikan.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
