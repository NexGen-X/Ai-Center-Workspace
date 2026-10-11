import React, { useState } from 'react';
import {
  X,
  Users,
  Bot,
  Plus,
  Search,
  Activity,
  Play,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Radio,
  Zap,
  Server,
  Layers,
  LayoutGrid,
  List,
  RefreshCw,
  Power,
  ShieldCheck,
  Check,
  Clock
} from 'lucide-react';
import { AIAgent, AgentStatus, AgentRole } from '../../../../shared/types.js';
import { api } from '../../services/api.js';

interface ManageTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  agents: AIAgent[];
  onAgentsUpdated: () => void;
  onOpenAddAgent: () => void;
  onSelectAgent: (agent: AIAgent) => void;
}

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Orchestrator: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  Planner: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  Executor: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  'QA / Reviewer': { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  DevOps: { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/30' },
  'Domain Specialist': { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30' }
};

const STATUS_CONFIG: Record<AgentStatus, { label: string; dot: string; text: string; bg: string }> = {
  READY: { label: 'Ready', dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  IDLE: { label: 'Idle', dot: 'bg-blue-400', text: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  BUSY: { label: 'Busy / Executing', dot: 'bg-amber-400 animate-ping', text: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  UNAVAILABLE: { label: 'Offline / Error', dot: 'bg-red-400', text: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  DISABLED: { label: 'Non-Aktif', dot: 'bg-slate-500', text: 'text-slate-400', bg: 'bg-slate-800 border-slate-700' }
};

export const ManageTeamModal: React.FC<ManageTeamModalProps> = ({
  isOpen,
  onClose,
  agents,
  onAgentsUpdated,
  onOpenAddAgent,
  onSelectAgent
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [pingingAgentId, setPingingAgentId] = useState<string | null>(null);
  const [pingResults, setPingResults] = useState<Record<string, { success: boolean; latencyMs: number; message?: string }>>({});
  const [togglingAgentId, setTogglingAgentId] = useState<string | null>(null);
  const [deletingAgentId, setDeletingAgentId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filter agents
  const filteredAgents = agents.filter((ag) => {
    if (statusFilter !== 'ALL' && ag.status !== statusFilter) return false;
    if (roleFilter !== 'ALL' && ag.role !== roleFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = ag.name.toLowerCase().includes(q);
      const matchRole = ag.role.toLowerCase().includes(q);
      const matchModel = ag.modelId.toLowerCase().includes(q);
      const matchDesc = ag.description?.toLowerCase().includes(q);
      const matchProvider = ag.providerName?.toLowerCase().includes(q) || ag.providerType?.toLowerCase().includes(q);
      if (!matchName && !matchRole && !matchModel && !matchDesc && !matchProvider) return false;
    }
    return true;
  });

  // Calculate live statistics
  const totalAgents = agents.length;
  const readyAgents = agents.filter((a) => a.status === 'READY' || a.status === 'IDLE').length;
  const busyAgents = agents.filter((a) => a.status === 'BUSY').length;
  const offlineOrDisabled = agents.filter((a) => a.status === 'UNAVAILABLE' || a.status === 'DISABLED').length;
  const totalCompletedTasks = agents.reduce((acc, a) => acc + (a.completedTasks || 0), 0);

  // Toggle active/inactive state
  const handleToggleEnable = async (agent: AIAgent, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setTogglingAgentId(agent.id);
      await api.toggleAgentEnabled(agent.id, !agent.enabled);
      onAgentsUpdated();
    } catch (err: any) {
      alert(`Gagal mengubah status aktif agen: ${err.message}`);
    } finally {
      setTogglingAgentId(null);
    }
  };

  // Test live connection / ping
  const handlePing = async (agent: AIAgent, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setPingingAgentId(agent.id);
      const res = await api.pingAgent(agent.id);
      setPingResults((prev) => ({
        ...prev,
        [agent.id]: {
          success: res.success,
          latencyMs: res.latencyMs,
          message: res.message
        }
      }));
      onAgentsUpdated();
    } catch (err: any) {
      setPingResults((prev) => ({
        ...prev,
        [agent.id]: {
          success: false,
          latencyMs: 0,
          message: err.message
        }
      }));
    } finally {
      setPingingAgentId(null);
    }
  };

  // Delete agent
  const handleDelete = async (agent: AIAgent, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Apakah Anda yakin ingin menghapus AI Agent "${agent.name}"?`)) return;

    try {
      setDeletingAgentId(agent.id);
      await api.deleteAgent(agent.id);
      onAgentsUpdated();
    } catch (err: any) {
      alert(`Gagal menghapus agen: ${err.message}`);
    } finally {
      setDeletingAgentId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0B0F17] border border-slate-800 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl shadow-blue-950/40 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Kelola AI Team Registry</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold font-mono">
                  {filteredAgents.length} / {totalAgents} Anggota
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Pusat manajemen orkestrasi seluruh agen AI (LLM / Agent Runtimes) dalam workspace.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                onClose();
                onOpenAddAgent();
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold shadow-lg shadow-blue-600/25 transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tambah Anggota</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Tutup (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Top Summary Metrics Banner */}
        <div className="px-6 py-3.5 bg-slate-950/60 border-b border-slate-800/60 grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-900/40 border border-slate-800/60">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Total Anggota</span>
              <span className="text-base font-bold text-white font-mono">{totalAgents}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-900/40 border border-slate-800/60">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Ready / Online</span>
              <span className="text-base font-bold text-emerald-400 font-mono">{readyAgents}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-900/40 border border-slate-800/60">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Sedang Bekerja</span>
              <span className="text-base font-bold text-amber-400 font-mono">{busyAgents}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-900/40 border border-slate-800/60">
            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 shrink-0">
              <Power className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Offline / Nonaktif</span>
              <span className="text-base font-bold text-slate-400 font-mono">{offlineOrDisabled}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-900/40 border border-slate-800/60 col-span-2 sm:col-span-1">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">Tugas Sukses</span>
              <span className="text-base font-bold text-purple-400 font-mono">{totalCompletedTasks}</span>
            </div>
          </div>
        </div>

        {/* Filter and Control Bar */}
        <div className="p-4 px-6 border-b border-slate-800/60 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-[240px]">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Cari nama, peran, model ID, atau provider..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">Semua Peran</option>
              <option value="Orchestrator">Orchestrator</option>
              <option value="Planner">Planner</option>
              <option value="Executor">Executor</option>
              <option value="QA / Reviewer">QA / Reviewer</option>
              <option value="DevOps">DevOps</option>
              <option value="Domain Specialist">Domain Specialist</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
              {[
                { id: 'ALL', label: 'Semua' },
                { id: 'READY', label: 'Ready' },
                { id: 'BUSY', label: 'Busy' },
                { id: 'UNAVAILABLE', label: 'Offline' },
                { id: 'DISABLED', label: 'Non-Aktif' }
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => setStatusFilter(st.id)}
                  className={`px-2.5 py-1 rounded-md font-semibold transition text-[11px] ${
                    statusFilter === st.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* View Mode Switch */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md transition ${viewMode === 'table' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                title="Tampilan Tabel"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition ${viewMode === 'grid' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                title="Tampilan Grid Card"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Body: Agents List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {filteredAgents.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-slate-800 rounded-2xl bg-slate-950/30">
              <Bot className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-white mb-1">Tidak ada anggota AI ditemukan</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                Tidak ada agen yang cocok dengan kriteria pencarian atau filter yang dipilih.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                  setRoleFilter('ALL');
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition"
              >
                Reset Filter
              </button>
            </div>
          ) : viewMode === 'table' ? (
            /* Table View */
            <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-slate-950/40">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Nama & Model</th>
                    <th className="py-3 px-3">Peran & Provider</th>
                    <th className="py-3 px-3">Status Operasional</th>
                    <th className="py-3 px-3 text-center">Sakelar Aktif</th>
                    <th className="py-3 px-3 text-center">Beban Kerja (Tasks)</th>
                    <th className="py-3 px-3">Tes Koneksi</th>
                    <th className="py-3 px-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredAgents.map((agent) => {
                    const roleStyle = ROLE_COLORS[agent.role] || ROLE_COLORS.Orchestrator;
                    const statusStyle = STATUS_CONFIG[agent.status] || STATUS_CONFIG.READY;
                    const pingInfo = pingResults[agent.id];
                    const isPinging = pingingAgentId === agent.id;
                    const isToggling = togglingAgentId === agent.id;

                    return (
                      <tr
                        key={agent.id}
                        onClick={() => onSelectAgent(agent)}
                        className="hover:bg-slate-900/50 transition cursor-pointer group"
                      >
                        {/* Name & Model */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-slate-300 group-hover:text-blue-400 group-hover:border-blue-500/40 transition">
                              <Bot className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-bold text-white group-hover:text-cyan-300 transition block truncate">
                                {agent.name}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400 block truncate">
                                {agent.modelId}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Role & Provider */}
                        <td className="py-3.5 px-3">
                          <div className="space-y-1">
                            <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}>
                              {agent.role}
                            </span>
                            <span className="text-[10px] text-slate-500 block truncate">
                              via {agent.providerName || agent.providerType || 'Custom'}
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-3">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
                            <span className={`text-[11px] font-bold ${statusStyle.text}`}>
                              {statusStyle.label}
                            </span>
                          </div>
                        </td>

                        {/* Enable/Disable Toggle */}
                        <td className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => handleToggleEnable(agent, e)}
                            disabled={isToggling}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              agent.enabled ? 'bg-blue-600' : 'bg-slate-800'
                            }`}
                            title={agent.enabled ? 'Klik untuk menonaktifkan agen' : 'Klik untuk mengaktifkan agen'}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                agent.enabled ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </td>

                        {/* Workload */}
                        <td className="py-3.5 px-3 text-center font-mono">
                          <span className="text-white font-bold">{agent.completedTasks || 0}</span>
                          <span className="text-slate-500 text-[11px]"> / {agent.totalTasks || 0}</span>
                          <span className="block text-[9px] text-slate-500">
                            {agent.totalRuns || 0} runs
                          </span>
                        </td>

                        {/* Ping / Connection Test */}
                        <td className="py-3.5 px-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => handlePing(agent, e)}
                              disabled={isPinging}
                              className="px-2 py-1 rounded-md bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 font-medium flex items-center gap-1 transition"
                              title="Tes koneksi live ke provider"
                            >
                              <Radio className={`w-3 h-3 ${isPinging ? 'animate-spin text-blue-400' : 'text-cyan-400'}`} />
                              <span>{isPinging ? 'Ping...' : 'Tes Ping'}</span>
                            </button>
                            {pingInfo && (
                              <span
                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                                  pingInfo.success
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                }`}
                                title={pingInfo.message || (pingInfo.success ? 'Koneksi normal' : 'Koneksi gagal')}
                              >
                                {pingInfo.success ? `${pingInfo.latencyMs}ms` : 'Gagal'}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => onSelectAgent(agent)}
                              className="p-1.5 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 transition"
                              title="Buka panel eksekusi prompt"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => onSelectAgent(agent)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                              title="Edit konfigurasi"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={(e) => handleDelete(agent, e)}
                              disabled={deletingAgentId === agent.id}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-400 transition"
                              title="Hapus agen"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Grid Card View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAgents.map((agent) => {
                const roleStyle = ROLE_COLORS[agent.role] || ROLE_COLORS.Orchestrator;
                const statusStyle = STATUS_CONFIG[agent.status] || STATUS_CONFIG.READY;
                const pingInfo = pingResults[agent.id];
                const isPinging = pingingAgentId === agent.id;
                const isToggling = togglingAgentId === agent.id;

                return (
                  <div
                    key={agent.id}
                    onClick={() => onSelectAgent(agent)}
                    className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-blue-500/50 hover:bg-slate-900/40 transition cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      {/* Top Bar: Role badge, Status & Toggle */}
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}>
                          {agent.role}
                        </span>

                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
                            <span className={`text-[11px] font-bold ${statusStyle.text}`}>{statusStyle.label}</span>
                          </div>

                          <button
                            onClick={(e) => handleToggleEnable(agent, e)}
                            disabled={isToggling}
                            className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              agent.enabled ? 'bg-blue-600' : 'bg-slate-800'
                            }`}
                            title={agent.enabled ? 'Nonaktifkan agen' : 'Aktifkan agen'}
                          >
                            <span
                              className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                agent.enabled ? 'translate-x-3' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Bot Info */}
                      <div className="flex items-start gap-3 mb-2.5">
                        <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-slate-300 group-hover:text-blue-400 group-hover:border-blue-500/40 transition">
                          <Bot className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-white group-hover:text-cyan-300 transition truncate">
                            {agent.name}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 truncate max-w-[130px]">
                              {agent.modelId}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              via {agent.providerName || agent.providerType || 'Custom'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-slate-400 line-clamp-2 mb-3 leading-relaxed">
                        {agent.description || 'Tidak ada deskripsi spesifik.'}
                      </p>
                    </div>

                    {/* Footer: Stats, Ping & Action buttons */}
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => handlePing(agent, e)}
                          disabled={isPinging}
                          className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-300 font-medium flex items-center gap-1 transition"
                        >
                          <Radio className={`w-3 h-3 ${isPinging ? 'animate-spin text-blue-400' : 'text-cyan-400'}`} />
                          <span>{isPinging ? '...' : pingInfo ? `${pingInfo.latencyMs}ms` : 'Ping'}</span>
                        </button>

                        <span className="text-[10px] font-mono text-slate-500">
                          {agent.completedTasks || 0} / {agent.totalTasks || 0} tasks
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onSelectAgent(agent)}
                          className="p-1.5 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 transition"
                          title="Jalankan tugas / prompt"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onSelectAgent(agent)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                          title="Edit agen"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(agent, e)}
                          disabled={deletingAgentId === agent.id}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-400 transition"
                          title="Hapus agen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800/80 bg-slate-900/40 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Semua kredensial API Key dienkripsi aman dengan AES-256-GCM di backend server.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
