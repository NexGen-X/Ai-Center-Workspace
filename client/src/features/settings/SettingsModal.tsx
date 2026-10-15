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
  FileCheck,
  Copy,
  Check,
  Send,
  Terminal,
  Bell,
  Trash2,
  Plus,
  MessageSquare,
  Plug,
  Code2,
  Play
} from 'lucide-react';
import {
  ModelProviderConfig,
  WorkspaceBackup,
  AlertWebhookItem,
  AlertPlatform,
  AlertEventType,
  AlertDeliveryLog,
  McpServer,
  McpTool,
  McpServerTemplate,
  McpTransport
} from '../../../../shared/types.js';
import { api } from '../../services/api.js';
import { useFeedback } from '../../components/common/FeedbackContext.js';
import { CustomSelect } from '../../components/common/CustomSelect.js';
import { CustomCheckbox } from '../../components/common/CustomCheckbox.js';

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
  const [activeTab, setActiveTab] = useState<'WORKSPACE' | 'SECURITY' | 'PROVIDERS' | 'BACKUP' | 'WEBHOOKS' | 'ALERTS' | 'MCP'>('WORKSPACE');
  const [providers, setProviders] = useState<ModelProviderConfig[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);

  // Outbound Alerting state
  const [alertWebhooks, setAlertWebhooks] = useState<AlertWebhookItem[]>([]);
  const [loadingAlertWebhooks, setLoadingAlertWebhooks] = useState(false);
  const [isAddingAlertWebhook, setIsAddingAlertWebhook] = useState(false);
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);

  // New webhook form
  const [whName, setWhName] = useState('');
  const [whPlatform, setWhPlatform] = useState<AlertPlatform>('DISCORD');
  const [whUrl, setWhUrl] = useState('');
  const [whSecret, setWhSecret] = useState('');
  const [whEvents, setWhEvents] = useState<AlertEventType[]>([
    'SECURITY_ALERT',
    'SWARM_COMPLETED',
    'ACTION_PENDING',
    'SCHEDULE_FAILED'
  ]);

  // Delivery logs state
  const [deliveryLogs, setDeliveryLogs] = useState<AlertDeliveryLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showDeliveryHistory, setShowDeliveryHistory] = useState(false);

  const fetchAlertWebhooks = async () => {
    try {
      setLoadingAlertWebhooks(true);
      const res = await api.getAlertWebhooks();
      setAlertWebhooks(res);
    } catch (err: any) {
      console.error('Failed to load alert webhooks:', err);
    } finally {
      setLoadingAlertWebhooks(false);
    }
  };

  const fetchDeliveryLogs = async () => {
    try {
      setLoadingHistory(true);
      const res = await api.getAlertHistory();
      setDeliveryLogs(res);
    } catch (err: any) {
      console.error('Failed to load alert history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCreateAlertWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whName.trim() || !whUrl.trim()) {
      toast.error('Nama webhook dan URL webhook tujuan wajib diisi.');
      return;
    }

    try {
      await api.createAlertWebhook({
        name: whName.trim(),
        platform: whPlatform,
        webhookUrl: whUrl.trim(),
        secretToken: whSecret.trim() || undefined,
        events: whEvents,
        isActive: true
      });
      toast.success(`Webhook "${whName}" berhasil ditambahkan.`);
      setWhName('');
      setWhUrl('');
      setWhSecret('');
      setIsAddingAlertWebhook(false);
      fetchAlertWebhooks();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyimpan webhook alert.');
    }
  };

  const handleToggleWebhook = async (wh: AlertWebhookItem) => {
    try {
      await api.updateAlertWebhook(wh.id, { isActive: !wh.isActive });
      toast.info(`Webhook "${wh.name}" ${!wh.isActive ? 'diaktifkan' : 'dinonaktifkan'}.`);
      fetchAlertWebhooks();
    } catch (err: any) {
      toast.error(err.message || 'Gagal memperbarui status webhook.');
    }
  };

  const handleDeleteWebhook = async (wh: AlertWebhookItem) => {
    const ok = await confirm({
      title: 'Hapus Webhook Alert?',
      message: `Apakah Anda yakin ingin menghapus webhook "${wh.name}" (${wh.platform})? Notifikasi outbound ke channel ini akan dihentikan.`,
      confirmText: 'Hapus Webhook',
      cancelText: 'Batal',
      variant: 'danger'
    });
    if (!ok) return;

    try {
      await api.deleteAlertWebhook(wh.id);
      toast.success(`Webhook "${wh.name}" berhasil dihapus.`);
      fetchAlertWebhooks();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus webhook.');
    }
  };

  const handleTestWebhook = async (wh: AlertWebhookItem) => {
    try {
      setTestingWebhookId(wh.id);
      toast.info(`Mengirim payload uji ke ${wh.platform}...`);
      const res = await api.testAlertWebhook(wh.id);
      if (res.success) {
        toast.success(`Uji koneksi ke ${wh.name} sukses! (HTTP ${res.statusCode || 200})`);
      } else {
        toast.error(`Uji koneksi gagal: ${res.error || 'Terjadi kesalahan'}`);
      }
      fetchDeliveryLogs();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menguji webhook.');
    } finally {
      setTestingWebhookId(null);
    }
  };

  // MCP Protocol states
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [loadingMcpServers, setLoadingMcpServers] = useState(false);
  const [mcpTemplates, setMcpTemplates] = useState<McpServerTemplate[]>([]);
  const [testingServerId, setTestingServerId] = useState<string | null>(null);
  const [isAddingMcpServer, setIsAddingMcpServer] = useState(false);
  const [inspectingServer, setInspectingServer] = useState<McpServer | null>(null);

  // New MCP Server Form
  const [mcpName, setMcpName] = useState('');
  const [mcpDesc, setMcpDesc] = useState('');
  const [mcpTransport, setMcpTransport] = useState<McpTransport>('stdio');
  const [mcpCommand, setMcpCommand] = useState('npx');
  const [mcpArgs, setMcpArgs] = useState('-y @modelcontextprotocol/server-filesystem /root/Ai-Center-Workspace');
  const [mcpEnv, setMcpEnv] = useState('');
  const [mcpUrl, setMcpUrl] = useState('');

  // Tool tester state
  const [selectedToolForTest, setSelectedToolForTest] = useState<McpTool | null>(null);
  const [toolTestArgs, setToolTestArgs] = useState('{}');
  const [toolTestResult, setToolTestResult] = useState<any>(null);
  const [executingToolTest, setExecutingToolTest] = useState(false);

  const fetchMcpServers = async () => {
    try {
      setLoadingMcpServers(true);
      const [servers, templates] = await Promise.all([
        api.getMcpServers(),
        api.getMcpTemplates()
      ]);
      setMcpServers(servers);
      setMcpTemplates(templates);
    } catch (err: any) {
      toast.error('Gagal memuat daftar MCP server: ' + err.message);
    } finally {
      setLoadingMcpServers(false);
    }
  };

  const handleTestMcpServer = async (server: McpServer) => {
    setTestingServerId(server.id);
    try {
      toast.info(`Menguji koneksi JSON-RPC ke ${server.name}...`);
      const res = await api.testMcpServer(server.id);
      if (res.success) {
        toast.success(`Server "${server.name}" terhubung! Ditemukan ${res.data.tools.length} tool.`);
        await fetchMcpServers();
      } else {
        toast.error(`Koneksi gagal: ${res.data.error || 'Unknown error'}`);
        await fetchMcpServers();
      }
    } catch (err: any) {
      toast.error('Gagal menguji MCP server: ' + err.message);
    } finally {
      setTestingServerId(null);
    }
  };

  const handleToggleMcpServer = async (server: McpServer) => {
    try {
      await api.updateMcpServer(server.id, { enabled: !server.enabled });
      toast.info(`Server "${server.name}" ${!server.enabled ? 'diaktifkan' : 'dinonaktifkan'}.`);
      await fetchMcpServers();
    } catch (err: any) {
      toast.error('Gagal memperbarui status server: ' + err.message);
    }
  };

  const handleDeleteMcpServer = async (server: McpServer) => {
    const ok = await confirm({
      title: 'Hapus MCP Server?',
      message: `Apakah Anda yakin ingin menghapus MCP server "${server.name}"? Tool dari server ini tidak akan lagi tersedia bagi agen.`,
      confirmText: 'Hapus Server',
      cancelText: 'Batal',
      variant: 'danger'
    });
    if (!ok) return;

    try {
      await api.deleteMcpServer(server.id);
      toast.success('MCP Server berhasil dihapus.');
      await fetchMcpServers();
      if (inspectingServer?.id === server.id) {
        setInspectingServer(null);
      }
    } catch (err: any) {
      toast.error('Gagal menghapus server: ' + err.message);
    }
  };

  const handleApplyMcpTemplate = (tmpl: McpServerTemplate) => {
    setMcpName(tmpl.name);
    setMcpDesc(tmpl.description);
    setMcpTransport(tmpl.transport);
    setMcpCommand(tmpl.command);
    setMcpArgs(tmpl.args.join(' '));
    setMcpUrl('');
    setIsAddingMcpServer(true);
  };

  const handleCreateMcpServer = async () => {
    if (!mcpName.trim()) {
      toast.error('Nama server MCP wajib diisi.');
      return;
    }

    try {
      let parsedArgs: string[] = [];
      if (mcpArgs.trim()) {
        parsedArgs = mcpArgs.trim().split(/\s+/);
      }

      let parsedEnv: Record<string, string> = {};
      if (mcpEnv.trim()) {
        try {
          parsedEnv = JSON.parse(mcpEnv);
        } catch {
          mcpEnv.split('\n').forEach(line => {
            const idx = line.indexOf('=');
            if (idx !== -1) {
              const k = line.slice(0, idx).trim();
              const v = line.slice(idx + 1).trim();
              if (k) parsedEnv[k] = v;
            }
          });
        }
      }

      await api.registerMcpServer({
        name: mcpName.trim(),
        description: mcpDesc.trim() || undefined,
        transport: mcpTransport,
        command: mcpTransport === 'stdio' ? mcpCommand.trim() : undefined,
        args: parsedArgs,
        env: parsedEnv,
        url: mcpTransport === 'sse' ? mcpUrl.trim() : undefined,
        enabled: true
      });

      toast.success('MCP Server berhasil ditambahkan!');
      setIsAddingMcpServer(false);
      setMcpName('');
      setMcpDesc('');
      await fetchMcpServers();
    } catch (err: any) {
      toast.error('Gagal menambahkan MCP server: ' + err.message);
    }
  };

  const handleExecuteToolTest = async () => {
    if (!selectedToolForTest) return;
    setExecutingToolTest(true);
    setToolTestResult(null);

    try {
      let argsObj: any = {};
      if (toolTestArgs.trim()) {
        argsObj = JSON.parse(toolTestArgs);
      }

      const res = await api.callMcpTool(selectedToolForTest.serverId, selectedToolForTest.name, argsObj);
      setToolTestResult(res);
      toast.success(`Tool "${selectedToolForTest.name}" berhasil dieksekusi!`);
    } catch (err: any) {
      setToolTestResult({ isError: true, error: err.message });
      toast.error('Eksekusi tool gagal: ' + err.message);
    } finally {
      setExecutingToolTest(false);
    }
  };

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

  // Webhook Tester State
  const [webhookTitle, setWebhookTitle] = useState('Verifikasi Build CI/CD & Vulnerability Scan');
  const [webhookDesc, setWebhookDesc] = useState('Analisis log deployment dan verifikasi integrasi sistem dari pipeline GitHub Actions.');
  const [webhookPriority, setWebhookPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');
  const [webhookAutoExecute, setWebhookAutoExecute] = useState(true);
  const [dispatchingWebhook, setDispatchingWebhook] = useState(false);
  const [webhookResult, setWebhookResult] = useState<any>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const handleTestDispatchWebhook = async () => {
    if (!webhookTitle.trim()) {
      toast.error('Judul pemicu webhook wajib diisi.');
      return;
    }
    setDispatchingWebhook(true);
    setWebhookResult(null);
    try {
      const res = await api.dispatchWebhookTask({
        title: webhookTitle,
        description: webhookDesc,
        priority: webhookPriority,
        autoExecute: webhookAutoExecute
      });
      setWebhookResult(res);
      toast.success(res.message || 'Webhook berhasil dipicu!');
      if (onWorkspaceRestored) onWorkspaceRestored();
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengirim pemicu webhook.');
      setWebhookResult({ error: err.message });
    } finally {
      setDispatchingWebhook(false);
    }
  };

  const handleCopyWebhookUrl = () => {
    const url = `${window.location.origin}/api/webhooks/dispatch-task`;
    navigator.clipboard.writeText(url);
    setCopiedUrl(true);
    toast.info('URL Webhook disalin ke clipboard.');
    setTimeout(() => setCopiedUrl(false), 2000);
  };

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
      fetchAlertWebhooks();
      setPasswordMsg(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[94vh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
      >
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
            type="button"
            onClick={onClose}
            aria-label="Tutup pengaturan sistem"
            className="p-1.5 sm:p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-3.5 sm:px-6 border-b border-slate-800 bg-slate-900/60 gap-3 sm:gap-4 text-xs font-semibold overflow-x-auto no-scrollbar">
          <button
            type="button"
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
            type="button"
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
            type="button"
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
            type="button"
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

          <button
            type="button"
            onClick={() => setActiveTab('WEBHOOKS')}
            className={`py-3 border-b-2 transition flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
              activeTab === 'WEBHOOKS'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-4 h-4 text-emerald-400" />
            <span>Webhook Trigger (Inbound)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('ALERTS');
              fetchAlertWebhooks();
            }}
            className={`py-3 border-b-2 transition flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
              activeTab === 'ALERTS'
                ? 'border-indigo-400 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Bell className="w-4 h-4 text-indigo-400" />
            <span>Outbound Alerting ({alertWebhooks.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('MCP');
              fetchMcpServers();
            }}
            className={`py-3 border-b-2 transition flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
              activeTab === 'MCP'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Plug className="w-4 h-4 text-emerald-400" />
            <span>MCP Protocol ({mcpServers.length})</span>
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
                    type="button"
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
                    type="button"
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
                        type="button"
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

          {activeTab === 'WEBHOOKS' && (
            <div className="space-y-6">
              {/* Webhook Header & API Info */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      <Radio className="w-4 h-4 text-emerald-400" />
                      Inbound Webhook & Automation Trigger
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Integrasikan pemicu tugas otomatis dari CI/CD (GitHub Actions, GitLab CI), alert monitoring, Slack bot, n8n, atau Zapier.
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-mono font-bold">
                    POST /api/webhooks/dispatch-task
                  </span>
                </div>

                {/* Endpoint & Copy URL */}
                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] text-slate-500 uppercase font-mono block">Webhook Endpoint URL</span>
                    <span className="text-xs font-mono text-cyan-300 break-all select-all">
                      {window.location.origin}/api/webhooks/dispatch-task
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyWebhookUrl}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition shrink-0"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                    <span>{copiedUrl ? 'Tersalin' : 'Salin URL'}</span>
                  </button>
                </div>
              </div>

              {/* cURL Example */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  Contoh Request cURL
                </h4>
                <pre className="p-3 bg-[#070A0F] rounded-xl border border-slate-800/80 text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed">
{`curl -X POST "${window.location.origin}/api/webhooks/dispatch-task" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "${webhookTitle}",
    "description": "${webhookDesc}",
    "priority": "${webhookPriority}",
    "autoExecute": ${webhookAutoExecute}
  }'`}
                </pre>
              </div>

              {/* In-App Webhook Dispatch Simulator */}
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                  <Send className="w-3.5 h-3.5 text-amber-400" />
                  Webhook Trigger Simulator (Pengujian Langsung)
                </h4>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1 font-medium">Judul Tugas (Payload: title) *</label>
                    <input
                      type="text"
                      value={webhookTitle}
                      onChange={(e) => setWebhookTitle(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                      placeholder="Contoh: Otomatisasi deploy & verifikasi sistem"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1 font-medium">Deskripsi / Konteks (Payload: description)</label>
                    <textarea
                      rows={2}
                      value={webhookDesc}
                      onChange={(e) => setWebhookDesc(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
                      placeholder="Detail instruksi atau payload event yang diterima"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                    <div>
                      <label className="text-slate-400 block mb-1 font-medium">Tingkat Prioritas (priority)</label>
                      <CustomSelect
                        value={webhookPriority}
                        onChange={(val) => setWebhookPriority(val as any)}
                        options={[
                          { value: 'LOW', label: 'LOW', badge: 'LOW', badgeColor: 'bg-slate-800 text-slate-300 border-slate-700' },
                          { value: 'MEDIUM', label: 'MEDIUM', badge: 'MED', badgeColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
                          { value: 'HIGH', label: 'HIGH', badge: 'HIGH', badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                          { value: 'CRITICAL', label: 'CRITICAL', badge: 'CRIT', badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/20' }
                        ]}
                      />
                    </div>

                    <div className="pt-5 sm:pt-4">
                      <CustomCheckbox
                        variant="switch"
                        checked={webhookAutoExecute}
                        onChange={(val) => setWebhookAutoExecute(val)}
                        label="Eksekusi Otomatis Seketika"
                        description="Tugaskan dan jalankan inferensi AI secara instan saat webhook tiba."
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleTestDispatchWebhook}
                      disabled={dispatchingWebhook || !webhookTitle.trim()}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition disabled:opacity-50"
                    >
                      <Send className={`w-3.5 h-3.5 ${dispatchingWebhook ? 'animate-pulse' : ''}`} />
                      <span>{dispatchingWebhook ? 'Mengirim Pemicu...' : 'Kirim Pemicu Webhook'}</span>
                    </button>
                  </div>
                </div>

                {/* Webhook Response Viewer */}
                {webhookResult && (
                  <div className="mt-4 p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Status Response: {webhookResult.error ? 'FAILED' : '200 OK'}
                      </span>
                      {webhookResult.taskId && (
                        <span className="text-[10px] font-mono text-cyan-400">
                          Task ID: {webhookResult.taskId}
                        </span>
                      )}
                    </div>
                    <pre className="p-2.5 bg-[#05070A] rounded-lg text-[11px] font-mono text-emerald-300 overflow-x-auto">
                      {JSON.stringify(webhookResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: OUTBOUND ALERTING & WEBHOOK DISPATCHER */}
          {activeTab === 'ALERTS' && (
            <div className="space-y-6">
              {/* Header Banner */}
              <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-slate-900 border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <Bell className="w-4 h-4 text-indigo-400" />
                    <span>Outbound Alerting & Incident Webhooks</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xl">
                    Kirim notifikasi otomatis ke Discord, Slack, Telegram, atau custom webhook saat terjadi ancaman keamanan, persetujuan tool berisiko, atau kegagalan cron daemon.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeliveryHistory(!showDeliveryHistory);
                      if (!showDeliveryHistory) fetchDeliveryLogs();
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition ${
                      showDeliveryHistory
                        ? 'bg-slate-700 border-slate-600 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>{showDeliveryHistory ? 'Sembunyikan Log' : 'Riwayat Pengiriman'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingAlertWebhook(!isAddingAlertWebhook)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isAddingAlertWebhook ? 'Tutup Form' : '+ Webhook Baru'}</span>
                  </button>
                </div>
              </div>

              {/* Form Add Webhook */}
              {isAddingAlertWebhook && (
                <form
                  onSubmit={handleCreateAlertWebhook}
                  className="p-4 sm:p-5 rounded-xl bg-slate-800/80 border border-indigo-500/40 space-y-4 animate-in fade-in duration-200"
                >
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Konfigurasi Endpoint Webhook Baru
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-slate-400 block mb-1 text-xs font-medium">Platform Channel *</label>
                      <CustomSelect
                        value={whPlatform}
                        onChange={(val) => setWhPlatform(val as AlertPlatform)}
                        options={[
                          { value: 'DISCORD', label: 'Discord Webhook', badge: 'DISCORD', badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
                          { value: 'SLACK', label: 'Slack Incoming Webhook', badge: 'SLACK', badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
                          { value: 'TELEGRAM', label: 'Telegram Bot API', badge: 'TELEGRAM', badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
                          { value: 'GENERIC', label: 'Custom Webhook (JSON)', badge: 'GENERIC', badgeColor: 'bg-slate-700 text-slate-300 border-slate-600' }
                        ]}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-slate-400 block mb-1 text-xs font-medium">Nama Integrasi *</label>
                      <input
                        type="text"
                        value={whName}
                        onChange={(e) => setWhName(e.target.value)}
                        placeholder="Contoh: Discord DevOps Incident Room"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1 text-xs font-medium">Webhook URL *</label>
                    <input
                      type="url"
                      value={whUrl}
                      onChange={(e) => setWhUrl(e.target.value)}
                      placeholder={
                        whPlatform === 'DISCORD'
                          ? 'https://discord.com/api/webhooks/...'
                          : whPlatform === 'SLACK'
                          ? 'https://hooks.slack.com/services/...'
                          : whPlatform === 'TELEGRAM'
                          ? 'https://api.telegram.org/bot<TOKEN>/sendMessage'
                          : 'https://api.example.com/webhooks/incidents'
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-400"
                    />
                  </div>

                  {whPlatform === 'TELEGRAM' ? (
                    <div>
                      <label className="text-slate-400 block mb-1 text-xs font-medium">Chat ID Telegram (Wajib untuk bot) *</label>
                      <input
                        type="text"
                        value={whSecret}
                        onChange={(e) => setWhSecret(e.target.value)}
                        placeholder="Contoh: -100123456789 atau @channel_name"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-400"
                      />
                    </div>
                  ) : whPlatform === 'GENERIC' ? (
                    <div>
                      <label className="text-slate-400 block mb-1 text-xs font-medium">Secret Token (Header X-Webhook-Secret) - Opsional</label>
                      <input
                        type="password"
                        value={whSecret}
                        onChange={(e) => setWhSecret(e.target.value)}
                        placeholder="Secret key untuk HMAC / validasi tanda tangan"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-400"
                      />
                    </div>
                  ) : null}

                  <div>
                    <label className="text-slate-400 block mb-1.5 text-xs font-medium">Event yang Dilanggan (Subscribed Events):</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {[
                        { key: 'SECURITY_ALERT', label: 'Security Alerts (Celah SSRF, Prompt Injection, Anomali)' },
                        { key: 'ACTION_PENDING', label: 'Action Approvals (Persetujuan Aksi Agen Berisiko Tinggi)' },
                        { key: 'SWARM_COMPLETED', label: 'Swarm Missions (Selesai Misi Autonomous Swarm)' },
                        { key: 'SCHEDULE_FAILED', label: 'Cron Schedules (Kegagalan Rutinitas Otomatis)' },
                        { key: 'SYSTEM_ANOMALY', label: 'System Anomaly (Lonjakan Error atau Latensi Sistem)' }
                      ].map((ev) => {
                        const isChecked = whEvents.includes(ev.key as AlertEventType);
                        return (
                          <label
                            key={ev.key}
                            className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition ${
                              isChecked
                                ? 'bg-indigo-500/10 border-indigo-500/30 text-slate-200'
                                : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setWhEvents([...whEvents, ev.key as AlertEventType]);
                                } else {
                                  setWhEvents(whEvents.filter((item) => item !== ev.key));
                                }
                              }}
                              className="mt-0.5 rounded border-slate-700 text-indigo-500 focus:ring-0"
                            />
                            <span className="text-[11px] leading-tight">{ev.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsAddingAlertWebhook(false)}
                      className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-400 hover:text-white"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={!whName.trim() || !whUrl.trim()}
                      className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
                    >
                      Simpan Webhook Alert
                    </button>
                  </div>
                </form>
              )}

              {/* Delivery History Section */}
              {showDeliveryHistory && (
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                      Log Audit Pengiriman Webhook Terakhir
                    </h4>
                    <button
                      type="button"
                      onClick={fetchDeliveryLogs}
                      disabled={loadingHistory}
                      className="p-1 rounded-lg text-slate-400 hover:text-white"
                      title="Segarkan Log"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  {loadingHistory ? (
                    <div className="p-4 text-center text-xs text-slate-500">Memuat riwayat pengiriman...</div>
                  ) : deliveryLogs.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">Belum ada riwayat pengiriman notifikasi.</div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto divide-y divide-slate-800 text-xs">
                      {deliveryLogs.map((log) => (
                        <div key={log.id} className="py-2.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 min-w-0">
                            {log.success ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-200 truncate">
                                  {(log as any).webhook_name || log.webhookId}
                                </span>
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                                  {log.eventType}
                                </span>
                              </div>
                              {log.errorMessage && (
                                <p className="text-[10px] text-rose-400 truncate mt-0.5">{log.errorMessage}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span
                              className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                                log.success
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}
                            >
                              HTTP {log.statusCode || (log.success ? 200 : 'ERR')}
                            </span>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {new Date(log.createdAt).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Webhooks List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Daftar Integrasi Webhook Aktif ({alertWebhooks.length})
                </h4>

                {loadingAlertWebhooks && alertWebhooks.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">Memuat konfigurasi webhook...</div>
                ) : alertWebhooks.length === 0 ? (
                  <div className="p-8 text-center rounded-xl bg-slate-800/30 border border-dashed border-slate-700/60 space-y-2">
                    <Radio className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-xs font-medium text-slate-400">Belum ada webhook outbound yang terkonfigurasi.</p>
                    <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                      Tambahkan webhook Discord atau Slack untuk menerima laporan instan saat agen menyelesaikan misi swarm atau mendeteksi aksi berisiko.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsAddingAlertWebhook(true)}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Buat Webhook Pertama</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {alertWebhooks.map((wh) => {
                      const platformColors: Record<AlertPlatform, { bg: string; text: string; border: string }> = {
                        DISCORD: { bg: 'bg-indigo-500/20', text: 'text-indigo-300', border: 'border-indigo-500/30' },
                        SLACK: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30' },
                        TELEGRAM: { bg: 'bg-sky-500/20', text: 'text-sky-300', border: 'border-sky-500/30' },
                        GENERIC: { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/30' }
                      };
                      const color = platformColors[wh.platform] || platformColors.GENERIC;

                      return (
                        <div
                          key={wh.id}
                          className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/80 hover:border-slate-600 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${color.bg} ${color.text} ${color.border}`}>
                                {wh.platform}
                              </span>
                              <h5 className="text-sm font-bold text-white truncate">{wh.name}</h5>
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                                  wh.isActive
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-slate-700 text-slate-400'
                                }`}
                              >
                                {wh.isActive ? 'Active' : 'Disabled'}
                              </span>
                            </div>
                            <p className="text-[11px] font-mono text-slate-400 truncate max-w-md">
                              {wh.webhookUrl.slice(0, 45)}...
                            </p>
                            <div className="flex flex-wrap gap-1 pt-1">
                              {wh.events.map((ev) => (
                                <span
                                  key={ev}
                                  className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800"
                                >
                                  {ev}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                            <button
                              type="button"
                              onClick={() => handleToggleWebhook(wh)}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                                wh.isActive
                                  ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                              }`}
                            >
                              {wh.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTestWebhook(wh)}
                              disabled={testingWebhookId === wh.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-semibold transition disabled:opacity-50"
                              title="Kirim payload uji ke webhook ini"
                            >
                              <Send className={`w-3 h-3 ${testingWebhookId === wh.id ? 'animate-bounce' : ''}`} />
                              <span>{testingWebhookId === wh.id ? 'Menguji...' : 'Uji Ping'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteWebhook(wh)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 border border-slate-700 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 transition"
                              title="Hapus Webhook"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 7: MODEL CONTEXT PROTOCOL (MCP) CLIENT HUB */}
          {activeTab === 'MCP' && (
            <div className="space-y-6">
              {/* Header Banner */}
              <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-r from-emerald-950/40 via-teal-950/20 to-slate-900 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <Plug className="w-5 h-5 text-emerald-400" />
                    <span>Model Context Protocol (MCP) Client Hub</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider font-mono">
                      Anthropic Spec 2026
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                    Hubungkan agen AI Anda dengan puluhan server MCP resmi (Filesystem, PostgreSQL, Fetch, Git, Memory) menggunakan protokol JSON-RPC 2.0 untuk memperluas kapabilitas agen secara instan.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={fetchMcpServers}
                    disabled={loadingMcpServers}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                    title="Segarkan daftar server MCP"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingMcpServers ? 'animate-spin text-emerald-400' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingMcpServer(!isAddingMcpServer);
                      setInspectingServer(null);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/30 transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isAddingMcpServer ? 'Tutup Formulir' : 'Tambah Server MCP'}</span>
                  </button>
                </div>
              </div>

              {/* Template Quick-Launcher Carousel */}
              {mcpTemplates.length > 0 && !isAddingMcpServer && !inspectingServer && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Template Server MCP Populer</span>
                    </span>
                    <span className="text-[11px] text-slate-500">1-Klik untuk mengonfigurasi</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {mcpTemplates.slice(0, 3).map((tmpl) => (
                      <div
                        key={tmpl.id}
                        className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-emerald-500/40 transition flex flex-col justify-between gap-3 group"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-white group-hover:text-emerald-300 transition">
                              {tmpl.name}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-800 text-slate-400 uppercase">
                              {tmpl.transport}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2">
                            {tmpl.description}
                          </p>
                          <div className="flex flex-wrap gap-1 pt-1">
                            {tmpl.defaultTools.slice(0, 3).map((tool) => (
                              <span
                                key={tool}
                                className="px-1.5 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40 text-[9px] font-mono text-emerald-300"
                              >
                                {tool}
                              </span>
                            ))}
                            {tmpl.defaultTools.length > 3 && (
                              <span className="text-[9px] text-slate-500 self-center">
                                +{tmpl.defaultTools.length - 3} lagi
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleApplyMcpTemplate(tmpl)}
                          className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-emerald-600/30 text-slate-300 hover:text-emerald-200 border border-slate-700/80 hover:border-emerald-500/40 text-xs font-semibold transition flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Gunakan Template Ini</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add New Server Form */}
              {isAddingMcpServer && (
                <div className="p-4 sm:p-5 rounded-xl bg-slate-900/90 border border-emerald-500/40 space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                      <Plus className="w-4 h-4 text-emerald-400" />
                      <span>Konfigurasi Server MCP Baru</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setIsAddingMcpServer(false)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Batal
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1.5">
                      <label className="text-slate-300 font-semibold block">Nama Server MCP</label>
                      <input
                        type="text"
                        value={mcpName}
                        onChange={(e) => setMcpName(e.target.value)}
                        placeholder="Contoh: Production Filesystem MCP"
                        className="w-full px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-slate-300 font-semibold block">Transport Protokol</label>
                      <CustomSelect
                        value={mcpTransport}
                        onChange={(val) => setMcpTransport(val as McpTransport)}
                        options={[
                          { value: 'stdio', label: 'STDIO Process (Child Process npx/node/python)' },
                          { value: 'sse', label: 'HTTP / SSE Endpoint (Remote Server)' }
                        ]}
                      />
                    </div>

                    {mcpTransport === 'stdio' ? (
                      <>
                        <div className="space-y-1.5">
                          <label className="text-slate-300 font-semibold block">Command Utama</label>
                          <input
                            type="text"
                            value={mcpCommand}
                            onChange={(e) => setMcpCommand(e.target.value)}
                            placeholder="Contoh: npx, node, python3, docker"
                            className="w-full px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-slate-300 font-semibold block">Argumen Eksekusi (Args)</label>
                          <input
                            type="text"
                            value={mcpArgs}
                            onChange={(e) => setMcpArgs(e.target.value)}
                            placeholder="-y @modelcontextprotocol/server-filesystem /path/to/folder"
                            className="w-full px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div className="sm:col-span-2 space-y-1.5">
                          <label className="text-slate-300 font-semibold block">
                            Environment Variables (Opsional, baris per baris KEY=VAL atau format JSON)
                          </label>
                          <textarea
                            value={mcpEnv}
                            onChange={(e) => setMcpEnv(e.target.value)}
                            placeholder="GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxx&#10;DEBUG=1"
                            rows={2}
                            className="w-full px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="sm:col-span-2 space-y-1.5">
                        <label className="text-slate-300 font-semibold block">URL Endpoint Remote SSE</label>
                        <input
                          type="text"
                          value={mcpUrl}
                          onChange={(e) => setMcpUrl(e.target.value)}
                          placeholder="http://127.0.0.1:8000/sse atau https://mcp.company.internal/events"
                          className="w-full px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    )}

                    <div className="sm:col-span-2 space-y-1.5">
                      <label className="text-slate-300 font-semibold block">Deskripsi Singkat</label>
                      <input
                        type="text"
                        value={mcpDesc}
                        onChange={(e) => setMcpDesc(e.target.value)}
                        placeholder="Contoh: Memberikan agen akses pembacaan berkas pada direktori kode"
                        className="w-full px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsAddingMcpServer(false)}
                      className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateMcpServer}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-900/30"
                    >
                      Daftarkan Server
                    </button>
                  </div>
                </div>
              )}

              {/* Tool Inspector & Tester Modal/Drawer */}
              {inspectingServer && (
                <div className="p-4 sm:p-5 rounded-xl bg-slate-900/90 border border-cyan-500/40 space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                        <Code2 className="w-4 h-4 text-cyan-400" />
                        <span>Katalog Tools: {inspectingServer.name}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800/50">
                          {inspectingServer.toolsCache?.length || 0} Tools
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Tool ini otomatis dikenali dan dapat dipanggil langsung oleh agen dalam reasoning loop.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setInspectingServer(null);
                        setSelectedToolForTest(null);
                        setToolTestResult(null);
                      }}
                      className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                      title="Tutup Inspektor"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {(!inspectingServer.toolsCache || inspectingServer.toolsCache.length === 0) ? (
                    <div className="p-6 text-center text-xs text-slate-400 space-y-2">
                      <p>Belum ada tool yang ditemukan pada server ini.</p>
                      <p className="text-[11px] text-slate-500">
                        Klik tombol <strong>"Uji & Refresh Tools"</strong> pada kartu server untuk menjalankan handshake <code className="text-cyan-400">tools/list</code>.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleTestMcpServer(inspectingServer)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                      >
                        Uji & Ambil Tools Sekarang
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Left: Tools List */}
                      <div className="space-y-2 max-h-[360px] overflow-y-auto no-scrollbar pr-1">
                        {inspectingServer.toolsCache.map((tool) => {
                          const isSelected = selectedToolForTest?.name === tool.name;
                          return (
                            <div
                              key={tool.name}
                              onClick={() => {
                                setSelectedToolForTest(tool);
                                setToolTestResult(null);
                                const sampleParams: Record<string, any> = {};
                                if (tool.inputSchema?.properties) {
                                  for (const key of Object.keys(tool.inputSchema.properties)) {
                                    sampleParams[key] = tool.inputSchema.properties[key].default ?? '';
                                  }
                                }
                                setToolTestArgs(JSON.stringify(sampleParams, null, 2));
                              }}
                              className={`p-3 rounded-lg border text-left cursor-pointer transition space-y-1.5 ${
                                isSelected
                                  ? 'bg-cyan-950/40 border-cyan-500/60 shadow-md shadow-cyan-950/50'
                                  : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                                  {tool.name}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {Object.keys(tool.inputSchema?.properties || {}).length} params
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 line-clamp-2">
                                {tool.description || 'Tidak ada deskripsi tool'}
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      {/* Right: Interactive Tool Execution Tester */}
                      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between gap-3">
                        {selectedToolForTest ? (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                <Play className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Uji Eksekusi: <code className="text-cyan-300 font-mono">{selectedToolForTest.name}</code></span>
                              </span>
                            </div>

                            <div className="space-y-1">
                              <label className="text-[11px] font-semibold text-slate-400 block">
                                Argumen Tool (JSON Payload)
                              </label>
                              <textarea
                                value={toolTestArgs}
                                onChange={(e) => setToolTestArgs(e.target.value)}
                                rows={4}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={handleExecuteToolTest}
                              disabled={executingToolTest}
                              className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950/50 flex items-center justify-center gap-2 transition disabled:opacity-50"
                            >
                              {executingToolTest ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span>Mengeksekusi Tool MCP...</span>
                                </>
                              ) : (
                                <>
                                  <Play className="w-3.5 h-3.5" />
                                  <span>Jalankan Eksekusi Tool</span>
                                </>
                              )}
                            </button>

                            {toolTestResult && (
                              <div className="space-y-1 pt-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  Hasil Output Tool
                                </span>
                                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-200 max-h-[140px] overflow-y-auto whitespace-pre-wrap break-words">
                                  {toolTestResult.content ? (
                                    toolTestResult.content.map((c: any, i: number) => c.text || JSON.stringify(c, null, 2)).join('\n')
                                  ) : (
                                    JSON.stringify(toolTestResult, null, 2)
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="p-8 text-center text-xs text-slate-500 my-auto">
                            Pilih salah satu tool di sebelah kiri untuk melihat skema parameter dan menjalankan pengujian langsung.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Registered Servers Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Daftar MCP Server Terdaftar ({mcpServers.length})
                  </span>
                </div>

                {loadingMcpServers ? (
                  <div className="p-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>Memuat server MCP...</span>
                  </div>
                ) : mcpServers.length === 0 ? (
                  <div className="p-8 rounded-xl bg-slate-900/40 border border-slate-800 text-center space-y-2">
                    <Plug className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-xs text-slate-400 font-semibold">
                      Belum ada MCP Server yang terdaftar.
                    </p>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      Gunakan template populer di atas atau klik "Tambah Server MCP" untuk menghubungkan Filesystem atau Database MCP.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {mcpServers.map((server) => {
                      const isTesting = testingServerId === server.id;
                      const toolCount = server.toolsCache?.length || 0;

                      return (
                        <div
                          key={server.id}
                          className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between gap-3"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="p-1.5 rounded-lg bg-emerald-950/60 border border-emerald-800/40 text-emerald-400 shrink-0">
                                  <Plug className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-xs font-bold text-white truncate">
                                    {server.name}
                                  </h4>
                                  <span className="text-[10px] text-slate-500 font-mono block truncate">
                                    {server.transport === 'stdio'
                                      ? `${server.command || 'npx'} ${(server.args || []).join(' ')}`
                                      : server.url}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 font-mono ${
                                    server.status === 'CONNECTED'
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                      : server.status === 'ERROR'
                                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      server.status === 'CONNECTED'
                                        ? 'bg-emerald-400 animate-pulse'
                                        : server.status === 'ERROR'
                                        ? 'bg-rose-400'
                                        : 'bg-slate-400'
                                    }`}
                                  />
                                  <span>{server.status}</span>
                                </span>
                              </div>
                            </div>

                            {server.description && (
                              <p className="text-[11px] text-slate-400 line-clamp-2">
                                {server.description}
                              </p>
                            )}

                            <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400 border-t border-slate-800/60">
                              <span>Tools Terdeteksi:</span>
                              <span className="font-mono font-bold text-cyan-300">
                                {toolCount} Tools
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleTestMcpServer(server)}
                                disabled={isTesting}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition disabled:opacity-50"
                                title="Lakukan handshake initialize dan refresh daftar tools"
                              >
                                <RefreshCw className={`w-3 h-3 ${isTesting ? 'animate-spin' : ''}`} />
                                <span>{isTesting ? 'Menguji...' : 'Uji & Refresh'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setInspectingServer(inspectingServer?.id === server.id ? null : server)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition"
                              >
                                <Code2 className="w-3 h-3 text-cyan-400" />
                                <span>Tools ({toolCount})</span>
                              </button>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleToggleMcpServer(server)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
                                  server.enabled
                                    ? 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                                }`}
                              >
                                {server.enabled ? 'Nonaktifkan' : 'Aktifkan'}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteMcpServer(server)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 border border-slate-700 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 transition"
                                title="Hapus MCP Server"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            type="button"
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
