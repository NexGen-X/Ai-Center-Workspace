import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  Terminal,
  Check,
  Play,
  RotateCcw,
  Clock,
  Bot,
  AlertTriangle,
  FileCode,
  Globe,
  Database,
  Search,
  ExternalLink,
  Sliders,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { AgentAction, ToolDefinition } from '../../../../shared/types.js';
import { api } from '../../services/api.js';
import { useFeedback } from '../../components/common/FeedbackContext.js';

interface ActionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActionApprove?: (action: AgentAction) => void;
}

export const ActionHistoryModal: React.FC<ActionHistoryModalProps> = ({
  isOpen,
  onClose,
  onActionApprove
}) => {
  const { toast } = useFeedback();
  const [activeTab, setActiveTab] = useState<'pending' | 'history' | 'tools' | 'test'>('pending');
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Sandbox Test Runner state
  const [testTool, setTestTool] = useState('bash_exec');
  const [testCommand, setTestCommand] = useState('ls -la');
  const [testOutput, setTestOutput] = useState<string | null>(null);
  const [testRunning, setTestRunning] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [actionsRes, toolsRes] = await Promise.all([
        api.getActions(),
        api.getTools()
      ]);
      setActions(actionsRes.actions);
      setTools(toolsRes.tools);
    } catch (err: any) {
      toast.error(err.message || 'Gagal memuat data aksi dan tools sandbox.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const pendingActions = actions.filter((a) => a.status === 'PENDING');
  const historyActions = actions.filter((a) => a.status !== 'PENDING');

  const filteredHistory = historyActions.filter((a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      a.toolName.toLowerCase().includes(q) ||
      (a.agentName && a.agentName.toLowerCase().includes(q)) ||
      (a.taskTitle && a.taskTitle.toLowerCase().includes(q)) ||
      (a.outputResult && a.outputResult.toLowerCase().includes(q))
    );
  });

  const handleQuickApprove = async (action: AgentAction) => {
    try {
      await api.approveAction(action.id);
      toast.success(`Aksi ${action.toolName} berhasil disetujui & dieksekusi.`);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menyetujui aksi.');
    }
  };

  const handleQuickReject = async (action: AgentAction) => {
    try {
      await api.rejectAction(action.id, 'lead-operator', 'Ditolak via Action Manager');
      toast.info(`Aksi ${action.toolName} ditolak.`);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menolak aksi.');
    }
  };

  const handleRunTest = async () => {
    try {
      setTestRunning(true);
      setTestOutput(null);

      let toolInput: Record<string, any> = {};
      if (testTool === 'bash_exec') {
        toolInput = { command: testCommand };
      } else if (testTool === 'system_inspect') {
        toolInput = { query: 'metrics' };
      } else if (testTool === 'file_read') {
        toolInput = { filePath: 'package.json' };
      }

      const res = await api.requestAction({
        agentId: 'agent-executor',
        toolName: testTool,
        toolInput,
        autoApprove: true
      });

      setTestOutput(res.outputResult || res.errorMessage || '(Selesai tanpa output)');
      await loadData();
    } catch (err: any) {
      setTestOutput(`[ERROR] ${err.message}`);
    } finally {
      setTestRunning(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-800 bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                <span>Agent Tool Calling & Action Sandbox</span>
                {pendingActions.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-bold animate-pulse">
                    {pendingActions.length} Pending
                  </span>
                )}
              </h2>
              <p className="text-[10px] text-slate-400">
                Pusat kendali eksekusi tool nyata, otorisasi Human-in-the-Loop, dan sandbox isolasi.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              title="Refresh Data"
            >
              <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              title="Tutup (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-800 bg-slate-900 px-4 sm:px-6 gap-2 pt-2">
          <button
            onClick={() => setActiveTab('pending')}
            className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 ${
              activeTab === 'pending'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Menunggu Izin ({pendingActions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Riwayat Eksekusi ({historyActions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('tools')}
            className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 ${
              activeTab === 'tools'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Katalog Tools ({tools.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('test')}
            className={`pb-2.5 px-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 ${
              activeTab === 'test'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>Sandbox Test Runner</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* TAB 1: PENDING APPROVALS */}
          {activeTab === 'pending' && (
            <div className="space-y-3">
              {pendingActions.length === 0 ? (
                <div className="text-center py-12 text-slate-500 space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500/40 mx-auto" />
                  <p className="text-xs font-semibold text-slate-300">Tidak ada aksi yang menunggu persetujuan.</p>
                  <p className="text-[11px] text-slate-500">Semua eksekusi tool terkendali dan berstatus aman.</p>
                </div>
              ) : (
                pendingActions.map((action) => (
                  <div
                    key={action.id}
                    className="p-4 rounded-xl bg-slate-950/80 border border-amber-500/40 space-y-3 animate-in fade-in"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                        <span className="font-bold text-xs text-white font-mono">{action.toolName}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 uppercase font-bold">
                          {action.riskLevel} Risk
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(action.createdAt).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <Bot className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="font-semibold text-cyan-300">{action.agentName || 'Agent'}</span>
                      </div>
                      {action.taskTitle && (
                        <div className="text-slate-400 truncate max-w-md">
                          Task: <span className="text-slate-200">{action.taskTitle}</span>
                        </div>
                      )}
                    </div>

                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-amber-200/90 whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {action.toolName === 'bash_exec' && action.toolInput.command
                        ? `$ ${action.toolInput.command}`
                        : JSON.stringify(action.toolInput, null, 2)}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/80">
                      <button
                        onClick={() => handleQuickReject(action)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/40 hover:text-rose-400 text-slate-400 text-xs font-semibold border border-slate-700 transition"
                      >
                        Tolak
                      </button>
                      <button
                        onClick={() => handleQuickApprove(action)}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950/40 transition active:scale-95"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Izinkan Eksekusi</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: EXECUTION HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari riwayat tool, agen, output..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-2.5">
                {filteredHistory.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs">Belum ada riwayat aksi eksekusi.</div>
                ) : (
                  filteredHistory.map((a) => (
                    <div key={a.id} className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white">{a.toolName}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              a.status === 'EXECUTED'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : a.status === 'REJECTED'
                                ? 'bg-rose-500/10 text-rose-400'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {a.status}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(a.createdAt).toLocaleTimeString()}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 flex items-center gap-2">
                        <span>Oleh: <strong className="text-cyan-300">{a.agentName || 'Agent'}</strong></span>
                        {a.approvedBy && <span>• Disetujui: <strong className="text-slate-300">{a.approvedBy}</strong></span>}
                      </div>

                      {a.outputResult && (
                        <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/80 font-mono text-[11px] text-slate-200 whitespace-pre-wrap max-h-32 overflow-y-auto">
                          {a.outputResult}
                        </div>
                      )}

                      {a.errorMessage && (
                        <div className="p-2 rounded-lg bg-rose-950/20 border border-rose-500/30 text-[11px] text-rose-300 font-mono">
                          {a.errorMessage}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: TOOLS REGISTRY */}
          {activeTab === 'tools' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {tools.map((t) => (
                <div key={t.name} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm text-cyan-300">{t.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        t.riskLevel === 'LOW'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : t.riskLevel === 'MEDIUM'
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-rose-500/10 text-rose-400'
                      }`}
                    >
                      {t.riskLevel} Risk
                    </span>
                  </div>

                  <p className="text-slate-300 text-[11px] leading-relaxed">{t.description}</p>

                  <div className="pt-2 border-t border-slate-800/80 space-y-1">
                    <span className="text-[10px] text-slate-500 font-semibold block uppercase">Parameter:</span>
                    <div className="bg-slate-900 p-2 rounded border border-slate-800/60 font-mono text-[10px] text-slate-300 max-h-24 overflow-y-auto">
                      {JSON.stringify(t.parameters, null, 2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: SANDBOX TEST RUNNER */}
          {activeTab === 'test' && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-500/30 text-blue-200 space-y-1">
                <span className="font-bold flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-blue-400" />
                  <span>Sandbox Tool Tester</span>
                </span>
                <p className="text-[11px] text-blue-300/80">
                  Uji coba eksekusi tool secara aman di dalam folder /sandbox terisolasi sebelum digunakan oleh agen otomatis.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Pilih Tool:</label>
                  <select
                    value={testTool}
                    onChange={(e) => setTestTool(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none"
                  >
                    <option value="bash_exec">bash_exec (Terminal Shell)</option>
                    <option value="system_inspect">system_inspect (Diagnostik Telemetri)</option>
                    <option value="file_read">file_read (Baca package.json)</option>
                  </select>
                </div>

                {testTool === 'bash_exec' && (
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">Perintah Shell:</label>
                    <input
                      type="text"
                      value={testCommand}
                      onChange={(e) => setTestCommand(e.target.value)}
                      placeholder="ls -la, node -v, uname -a..."
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}
              </div>

              <button
                onClick={handleRunTest}
                disabled={testRunning}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition active:scale-95 disabled:opacity-50"
              >
                <Play className={`w-3.5 h-3.5 ${testRunning ? 'animate-spin' : ''}`} />
                <span>{testRunning ? 'Menjalankan...' : 'Eksekusi di Sandbox Sekarang'}</span>
              </button>

              {testOutput && (
                <div className="space-y-1.5 pt-2">
                  <span className="text-[11px] font-bold text-slate-400 font-mono">Output Hasil Eksekusi:</span>
                  <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-400 whitespace-pre-wrap max-h-60 overflow-y-auto leading-relaxed shadow-inner">
                    {testOutput}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
