import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Shield,
  User,
  Key,
  Server,
  Cpu,
  CheckCircle2,
  AlertCircle,
  Eye,
  Sliders,
  Lock,
  Globe,
  Radio,
  Zap,
  ExternalLink,
  Database,
  Download,
  Upload,
  RefreshCw,
  FileCheck
} from 'lucide-react';
import { ModelProviderConfig, WorkspaceBackup } from '../../../../shared/types.js';
import { api } from '../../services/api.js';
import { useFeedback } from '../../components/common/FeedbackContext.js';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  onLogout: () => void;
  onOpenManageProviders?: () => void;
  onWorkspaceRestored?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLogout,
  onOpenManageProviders,
  onWorkspaceRestored
}) => {
  const { toast, confirm } = useFeedback();
  const [activeTab, setActiveTab] = useState<'WORKSPACE' | 'SECURITY' | 'PROVIDERS' | 'BACKUP'>('WORKSPACE');
  const [providers, setProviders] = useState<ModelProviderConfig[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);

  // Password change state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [changingPass, setChangingPass] = useState(false);

  // Backup & Restore states
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [selectedBackupFile, setSelectedBackupFile] = useState<File | null>(null);
  const [parsedBackupData, setParsedBackupData] = useState<WorkspaceBackup | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  const handleDownloadBackup = async () => {
    try {
      setDownloadingBackup(true);
      const backup = await api.getSystemBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-center-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Snapshot database berhasil diunduh.');
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengunduh snapshot backup.');
    } finally {
      setDownloadingBackup(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBackupError(null);
    setParsedBackupData(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedBackupFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const json = JSON.parse(text);
        if (!json.version || !json.data || !Array.isArray(json.data.tasks)) {
          setBackupError('Format file JSON tidak cocok dengan skema snapshot AI Center.');
          return;
        }
        setParsedBackupData(json);
      } catch {
        setBackupError('File yang dipilih bukan file JSON yang valid.');
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (!parsedBackupData) return;

    const isConfirmed = await confirm({
      title: 'Konfirmasi Pemulihan Database',
      message: `Tindakan ini akan memulihkan ${parsedBackupData.data.tasks.length} tugas, ${parsedBackupData.data.projects?.length || 0} proyek, dan ${parsedBackupData.data.documents?.length || 0} dokumen dari snapshot. Data yang konflik akan diperbarui. Lanjutkan?`,
      confirmText: 'Ya, Pulihkan Sekarang',
      variant: 'danger'
    });

    if (!isConfirmed) return;

    try {
      setRestoringBackup(true);
      setBackupError(null);
      const res = await api.restoreSystemBackup(parsedBackupData);
      toast.success(res.message || 'Database berhasil dipulihkan!');
      if (onWorkspaceRestored) onWorkspaceRestored();
      setSelectedBackupFile(null);
      setParsedBackupData(null);
    } catch (err: any) {
      setBackupError(err.message || 'Gagal memulihkan database.');
      toast.error(err.message || 'Gagal memulihkan database.');
    } finally {
      setRestoringBackup(false);
    }
  };

  const fetchProviders = async () => {
    try {
      setLoadingProviders(true);
      const data = await api.getProviders();
      setProviders(data);
    } catch {
      // ignore
    } finally {
      setLoadingProviders(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchProviders();
      setPasswordMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Konfirmasi password baru tidak cocok.' });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'Password baru minimal 8 karakter.' });
      return;
    }

    try {
      setChangingPass(true);
      setPasswordMsg(null);
      await api.changePassword(oldPassword, newPassword);
      setPasswordMsg({ type: 'success', text: 'Password berhasil diubah. Silakan gunakan password baru pada sesi berikutnya.' });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message || 'Gagal mengubah password.' });
    } finally {
      setChangingPass(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[94vh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 sm:px-6 py-3 sm:py-4 border-b border-slate-800 bg-slate-800/40 gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 shrink-0">
              <Settings className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide truncate">
                Pengaturan Sistem
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 hidden sm:block truncate">
                Konfigurasi profil operator, pengawasan keamanan, dan koneksi provider AI
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-3.5 sm:px-6 border-b border-slate-800 bg-slate-900/60 gap-3 sm:gap-4 text-xs font-semibold overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('WORKSPACE')}
            className={`py-3 border-b-2 transition flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
              activeTab === 'WORKSPACE'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Workspace</span>
          </button>

          <button
            onClick={() => setActiveTab('SECURITY')}
            className={`py-3 border-b-2 transition flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
              activeTab === 'SECURITY'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Keamanan</span>
          </button>

          <button
            onClick={() => setActiveTab('PROVIDERS')}
            className={`py-3 border-b-2 transition flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
              activeTab === 'PROVIDERS'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Model Provider ({providers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('BACKUP')}
            className={`py-3 border-b-2 transition flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
              activeTab === 'BACKUP'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Backup & Restore</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4 sm:space-y-6">
          {activeTab === 'WORKSPACE' && (
            <div className="space-y-6">
              {/* Workspace Info Card */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Informasi Command Center Workspace
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Workspace Name</span>
                    <span className="font-semibold text-white">Command Center Headquarters</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Workspace ID</span>
                    <span className="font-mono text-cyan-400">ws-default-command-center</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Database Storage</span>
                    <span className="font-semibold text-emerald-400">PostgreSQL 16 (Relational)</span>
                  </div>
                </div>
              </div>

              {/* Operator Profile Card */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Sesi & Akun Operator
                  </h3>
                  {currentUser && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      Role: {currentUser.role || 'ADMIN'}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Nama Operator</span>
                    <span className="font-semibold text-white">{currentUser?.displayName || 'Lead Operator'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Email Login</span>
                    <span className="font-mono text-slate-300">{currentUser?.email || 'operator@ai-center.local'}</span>
                  </div>
                </div>

                {/* Change Password Form */}
                <div className="pt-4 border-t border-slate-700/60">
                  <h4 className="text-xs font-bold text-white mb-2 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-400" />
                    <span>Ubah Kata Sandi (Password) Operator</span>
                  </h4>

                  {passwordMsg && (
                    <div
                      className={`mb-3 p-3 rounded-lg text-xs flex items-center gap-2 border ${
                        passwordMsg.type === 'success'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      }`}
                    >
                      {passwordMsg.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0" />
                      )}
                      <span>{passwordMsg.text}</span>
                    </div>
                  )}

                  <form onSubmit={handleChangePassword} className="space-y-3 max-w-md">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Password Saat Ini</label>
                      <input
                        type="password"
                        required
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Password Baru</label>
                        <input
                          type="password"
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Konfirmasi Password Baru</label>
                        <input
                          type="password"
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={changingPass}
                      className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition disabled:opacity-50"
                    >
                      {changingPass ? 'Memperbarui...' : 'Perbarui Password'}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'SECURITY' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">Status Guardrail & Proteksi Keamanan</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Sistem beroperasi sesuai standar keamanan arsitektur: isolasi credential, proteksi injeksi, dan pencegahan SSRF.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-white block">Mitigasi SSRF Aktif</span>
                      <span className="text-[11px] text-slate-400">
                        Memblokir IP metadata cloud (169.254.169.254), loopback privat, dan subnet link-local pada seluruh adapter Custom API.
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-white block">Enkripsi AES-256-GCM</span>
                      <span className="text-[11px] text-slate-400">
                        Seluruh API key provider dienkripsi secara simetris di level database dan tidak pernah dibocorkan ke frontend atau log.
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-white block">Decoupled Multi-Provider</span>
                      <span className="text-[11px] text-emerald-300">
                        Mandiri dan tidak bergantung pada gateway lokal. Koneksi upstream langsung ke OpenAI, Anthropic, Gemini, Groq, dan Ollama.
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-white block">PBKDF2 Password Hashing</span>
                      <span className="text-[11px] text-slate-400">
                        100.000 iterasi SHA-512 dengan cryptographic salt unik untuk setiap operator command center.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'PROVIDERS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Model Provider Terkonfigurasi ({providers.length})
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Koneksi upstream multi-model dengan enkripsi AES-256-GCM.
                  </p>
                </div>
                {onOpenManageProviders && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenManageProviders();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-600/20 transition"
                  >
                    <Cpu className="w-3.5 h-3.5" />
                    <span>Kelola Semua Provider</span>
                    <ExternalLink className="w-3 h-3 ml-0.5" />
                  </button>
                )}
              </div>

              <div className="divide-y divide-slate-800/80 rounded-xl bg-slate-800/30 border border-slate-700/60 overflow-hidden">
                {providers.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    Belum ada provider yang terdaftar.
                  </div>
                ) : (
                  providers.map((p) => (
                    <div key={p.id} className="p-3.5 flex items-center justify-between text-xs gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{p.name}</span>
                          <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                            {p.providerType}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">{p.baseUrl}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                            p.connectionStatus === 'CONNECTION_OK' || p.connectionStatus === 'MODEL_VERIFIED'
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                          }`}
                        >
                          {p.connectionStatus}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'BACKUP' && (
            <div className="space-y-6">
              {/* Export Backup Card */}
              <div className="p-4 sm:p-5 rounded-xl bg-slate-850/60 border border-slate-700/60 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Download className="w-4 h-4 text-cyan-400" />
                      Ekspor Snapshot Database
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Unduh arsip data lengkap (proyek, tugas, agen AI, knowledge base, konfigurasi provider) ke file snapshot JSON yang aman.
                    </p>
                  </div>
                  <button
                    onClick={handleDownloadBackup}
                    disabled={downloadingBackup}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-md transition disabled:opacity-50 shrink-0 self-start sm:self-auto"
                  >
                    <Download className={`w-4 h-4 ${downloadingBackup ? 'animate-bounce' : ''}`} />
                    <span>{downloadingBackup ? 'Membuat Snapshot...' : 'Unduh Backup (.json)'}</span>
                  </button>
                </div>
              </div>

              {/* Restore Backup Card */}
              <div className="p-4 sm:p-5 rounded-xl bg-slate-850/60 border border-slate-700/60 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Upload className="w-4 h-4 text-purple-400" />
                    Pulihkan dari File Snapshot
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Unggah file snapshot JSON untuk memulihkan atau menyinkronkan data entitas workspace.
                  </p>
                </div>

                {/* File Input */}
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold cursor-pointer transition">
                    <Upload className="w-4 h-4 text-purple-400" />
                    <span>Pilih File Backup (.json)</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  {selectedBackupFile && (
                    <span className="text-xs font-mono text-cyan-400 truncate max-w-xs">
                      {selectedBackupFile.name} ({(selectedBackupFile.size / 1024).toFixed(1)} KB)
                    </span>
                  )}
                </div>

                {backupError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{backupError}</span>
                  </div>
                )}

                {/* Parsed summary preview */}
                {parsedBackupData && (
                  <div className="p-4 rounded-xl bg-slate-900 border border-purple-500/30 space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-purple-300">
                        <FileCheck className="w-4 h-4 text-purple-400" />
                        <span>Snapshot Valid (v{parsedBackupData.version})</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Dibuat: {new Date(parsedBackupData.exportedAt).toLocaleString('id-ID')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="p-2 bg-slate-800/60 rounded-lg">
                        <span className="text-slate-400 block text-[10px]">Tugas</span>
                        <span className="font-bold text-white text-sm">{parsedBackupData.data.tasks.length}</span>
                      </div>
                      <div className="p-2 bg-slate-800/60 rounded-lg">
                        <span className="text-slate-400 block text-[10px]">Proyek</span>
                        <span className="font-bold text-white text-sm">{parsedBackupData.data.projects?.length || 0}</span>
                      </div>
                      <div className="p-2 bg-slate-800/60 rounded-lg">
                        <span className="text-slate-400 block text-[10px]">Agen AI</span>
                        <span className="font-bold text-white text-sm">{parsedBackupData.data.agents?.length || 0}</span>
                      </div>
                      <div className="p-2 bg-slate-800/60 rounded-lg">
                        <span className="text-slate-400 block text-[10px]">Dokumen</span>
                        <span className="font-bold text-white text-sm">{parsedBackupData.data.documents?.length || 0}</span>
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        onClick={handleExecuteRestore}
                        disabled={restoringBackup}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/30 transition disabled:opacity-50"
                      >
                        <RefreshCw className={`w-4 h-4 ${restoringBackup ? 'animate-spin' : ''}`} />
                        <span>{restoringBackup ? 'Memulihkan Data...' : 'Konfirmasi Pulihkan Snapshot'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
