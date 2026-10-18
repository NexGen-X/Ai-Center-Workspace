import React, { useState, useEffect } from 'react';
import {
  X,
  Building2,
  Plus,
  Users,
  Bot,
  CheckCircle2,
  ShieldCheck,
  Check,
  ChevronRight,
  UserPlus,
  Trash2,
  Layers,
  ArrowRight
} from 'lucide-react';
import { Workspace, WorkspaceMember, WorkspaceRole } from '../../../../shared/types.js';
import { api } from '../../services/api.js';
import { useFeedback } from '../../components/common/FeedbackContext.js';

interface WorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeWorkspaceId: string;
  onWorkspaceSwitched: (newWorkspaceId: string, newWorkspaceName: string) => void;
}

export const WorkspaceModal: React.FC<WorkspaceModalProps> = ({
  isOpen,
  onClose,
  activeWorkspaceId,
  onWorkspaceSwitched
}) => {
  const { toast } = useFeedback();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'members'>('list');
  const [selectedWs, setSelectedWs] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [newWsName, setNewWsName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('OPERATOR');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadWorkspaces = async () => {
    try {
      setLoading(true);
      const list = await api.getWorkspaces();
      setWorkspaces(list);
    } catch (err: any) {
      toast.error(err.message || 'Gagal memuat daftar workspace.', 'Error');
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async (wsId: string) => {
    try {
      setLoading(true);
      const res = await api.getWorkspace(wsId);
      setSelectedWs(res.workspace);
      setMembers(res.members);
    } catch (err: any) {
      toast.error(err.message || 'Gagal memuat anggota workspace.', 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadWorkspaces();
      setActiveTab('list');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;

    try {
      setIsSubmitting(true);
      const res = await api.createWorkspace(newWsName.trim());
      toast.success(`Workspace "${newWsName.trim()}" berhasil dibuat!`, 'Workspace Dibuat');
      setNewWsName('');
      await loadWorkspaces();
      setActiveTab('list');
      // Automatically switch to the newly created tenant workspace
      onWorkspaceSwitched(res.workspace.id, res.workspace.name);
    } catch (err: any) {
      toast.error(err.message || 'Gagal membuat workspace.', 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWs || !inviteEmail.trim()) return;

    try {
      setIsSubmitting(true);
      await api.addWorkspaceMember(selectedWs.id, inviteEmail.trim(), inviteRole);
      toast.success(`Pengguna "${inviteEmail.trim()}" berhasil ditambahkan sebagai ${inviteRole}.`, 'Anggota Ditambahkan');
      setInviteEmail('');
      await loadMembers(selectedWs.id);
    } catch (err: any) {
      toast.error(err.message || 'Gagal menambahkan anggota ke workspace.', 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!selectedWs) return;
    try {
      await api.removeWorkspaceMember(selectedWs.id, userId);
      toast.success('Anggota berhasil dihapus dari workspace.');
      await loadMembers(selectedWs.id);
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus anggota.', 'Error');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Multi-Tenant Workspaces & Organisasi</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono font-bold uppercase">
                  B2B Isolated
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">Kelola ruang kerja terisolasi dan izin akses tim antar-organisasi</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-slate-800/80 text-xs">
          <button
            onClick={() => setActiveTab('list')}
            className={`pb-2.5 px-2 font-semibold transition border-b-2 flex items-center gap-1.5 ${
              activeTab === 'list'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Daftar Workspace ({workspaces.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('create')}
            className={`pb-2.5 px-2 font-semibold transition border-b-2 flex items-center gap-1.5 ${
              activeTab === 'create'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Buat Workspace Klien Baru</span>
          </button>

          {selectedWs && (
            <button
              onClick={() => setActiveTab('members')}
              className={`pb-2.5 px-2 font-semibold transition border-b-2 flex items-center gap-1.5 ${
                activeTab === 'members'
                  ? 'border-cyan-400 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Kelola Tim ({selectedWs.name})</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'list' && (
            <div className="space-y-3">
              {loading && workspaces.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 font-mono">Memuat workspace...</div>
              ) : workspaces.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">Belum ada workspace lain.</div>
              ) : (
                workspaces.map((ws) => {
                  const isActive = ws.id === activeWorkspaceId;
                  return (
                    <div
                      key={ws.id}
                      className={`p-3.5 rounded-xl border transition flex items-center justify-between gap-3 ${
                        isActive
                          ? 'bg-cyan-950/20 border-cyan-500/50 shadow-lg shadow-cyan-500/5'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                            isActive
                              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {ws.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{ws.name}</span>
                            {isActive && (
                              <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/30 text-cyan-400">
                                <Check className="w-3 h-3" />
                                <span>Aktif</span>
                              </span>
                            )}
                            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                              {ws.role || 'MEMBER'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1 font-mono">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3 text-slate-500" />
                              {ws.memberCount || 1} Anggota
                            </span>
                            <span className="flex items-center gap-1">
                              <Bot className="w-3 h-3 text-slate-500" />
                              {ws.agentCount || 0} Agen
                            </span>
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-slate-500" />
                              {ws.taskCount || 0} Tugas
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedWs(ws);
                            loadMembers(ws.id);
                            setActiveTab('members');
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition"
                          title="Kelola Anggota & Role"
                        >
                          Kelola Tim
                        </button>

                        {!isActive ? (
                          <button
                            type="button"
                            onClick={() => {
                              onWorkspaceSwitched(ws.id, ws.name);
                              onClose();
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition shadow-sm"
                          >
                            <span>Beralih</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'create' && (
            <form onSubmit={handleCreateWorkspace} className="space-y-4 max-w-md mx-auto py-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nama Workspace / Klien Baru <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: PT Fintek Digital Indonesia"
                  value={newWsName}
                  onChange={(e) => setNewWsName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Workspace baru akan mendapatkan isolasi basis data total untuk seluruh tugas, model AI, dan agen.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newWsName.trim()}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Membuat...' : 'Buat Workspace'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'members' && selectedWs && (
            <div className="space-y-4">
              {/* Add Member Form */}
              <form onSubmit={handleAddMember} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Tambah / Undang Anggota ke Workspace "{selectedWs.name}"</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <input
                      type="email"
                      required
                      placeholder="Email pengguna terdaftar..."
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="OPERATOR">OPERATOR</option>
                      <option value="VIEWER">VIEWER</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting || !inviteEmail.trim()}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition disabled:opacity-50"
                  >
                    {isSubmitting ? 'Menambahkan...' : 'Tambah Anggota'}
                  </button>
                </div>
              </form>

              {/* Members List */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-400">Daftar Anggota ({members.length})</h4>
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <div className="text-xs font-bold text-white">{m.displayName || m.email}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{m.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-cyan-400 border border-slate-700">
                        {m.role}
                      </span>
                      {m.role !== 'OWNER' && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m.userId)}
                          className="p-1 rounded text-slate-500 hover:text-red-400 transition"
                          title="Hapus anggota"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
