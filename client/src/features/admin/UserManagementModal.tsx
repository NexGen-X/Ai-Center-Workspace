import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  Search,
  Filter,
  Download,
  RotateCw,
  Building,
  Shield,
  Crown,
  Sparkles,
  KeyRound,
  CheckCircle2,
  Clock,
  Layers,
  DollarSign,
  TrendingUp,
  MoreVertical,
  Check,
  Copy,
  Edit,
  AlertCircle
} from 'lucide-react';
import { api } from '../../services/api.js';

interface UserData {
  id: string;
  email: string;
  displayName: string;
  role: string;
  createdAt: string;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
  workspaceId: string;
  workspaceName: string;
  plan: string;
  planStatus: string;
  taskQuotaLimit: number;
  tasksUsedThisMonth: number;
  workspaceRole: string;
}

interface AdminMetrics {
  totalUsers: number;
  totalWorkspaces: number;
  activeUsers24h: number;
  planCounts: Record<string, number>;
  totalRevenueIdr: number;
  totalTasksDone: number;
  paidSubscribers: number;
  freeTrialUsers: number;
}

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({ isOpen, onClose }) => {
  const [users, setUsers] = useState<UserData[]>([]);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('ALL');
  const [copiedEmailId, setCopiedEmailId] = useState<string | null>(null);

  // Edit Plan State
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [selectedPlan, setSelectedPlan] = useState('BUSINESS');
  const [customQuota, setCustomQuota] = useState(2500);
  const [savingPlan, setSavingPlan] = useState(false);

  // Reset Password State
  const [resettingUser, setResettingUser] = useState<UserData | null>(null);
  const [tempPassword, setTempPassword] = useState('IdTech2026!');
  const [resettingPwd, setResettingPwd] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [metRes, usersRes] = await Promise.all([
        api.getAdminMetrics().catch(() => null),
        api.getAdminUsers({ search, plan: planFilter }).catch(() => null)
      ]);

      if (metRes?.metrics) setMetrics(metRes.metrics);
      if (usersRes?.users) setUsers(usersRes.users);
    } catch (err: any) {
      console.error('Error fetching admin user data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, planFilter]);

  if (!isOpen) return null;

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  const handleCopyEmail = (id: string, email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmailId(id);
    setTimeout(() => setCopiedEmailId(null), 2000);
  };

  const handleSavePlan = async () => {
    if (!editingUser) return;
    setSavingPlan(true);
    try {
      const res = await api.updateUserPlan(editingUser.id, selectedPlan, customQuota);
      setToastMessage(res.message);
      setEditingUser(null);
      fetchData();
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Gagal mengubah paket');
    } finally {
      setSavingPlan(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resettingUser) return;
    setResettingPwd(true);
    try {
      const res = await api.resetUserPassword(resettingUser.id, tempPassword);
      setToastMessage(res.message);
      setResettingUser(null);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Gagal mereset kata sandi');
    } finally {
      setResettingPwd(false);
    }
  };

  const handleExportCsv = () => {
    if (users.length === 0) return;
    const headers = ['ID', 'Nama', 'Email', 'Workspace', 'Paket', 'Status Paket', 'Kuota Dipakai', 'Batas Kuota', 'Role', 'Tanggal Daftar', 'Login Terakhir'];
    const rows = users.map((u) => [
      u.id,
      `"${u.displayName}"`,
      u.email,
      `"${u.workspaceName || ''}"`,
      u.plan,
      u.planStatus,
      u.tasksUsedThisMonth || 0,
      u.taskQuotaLimit || 0,
      u.role,
      u.createdAt ? new Date(u.createdAt).toLocaleDateString('id-ID') : '',
      u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('id-ID') : 'Belum pernah'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `idtech-users-export-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/85 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Box */}
      <div className="relative w-full max-w-6xl bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl shadow-2xl shadow-black/90 flex flex-col max-h-[92vh] overflow-hidden z-10">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">Founder User Management & Analytics</h3>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  SuperAdmin Portal
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Pusat kontrol data seluruh pengguna terdaftar, lisensi paket pelanggan, dan metrik pertumbuhan startup ID-Tech
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

        {/* Toast Banner */}
        {toastMessage && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 sm:p-7 overflow-y-auto space-y-6 flex-1 text-sm text-slate-300">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span>Total Pengguna Terdaftar</span>
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-white font-mono">
                  {metrics?.totalUsers || users.length}
                </span>
                <span className="text-xs text-blue-400 font-semibold">User</span>
              </div>
              <p className="text-[11px] text-slate-500">Mendaftar dari landing page & console</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-purple-400" />
                <span>Organisasi / Workspace</span>
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-cyan-400 font-mono">
                  {metrics?.totalWorkspaces || 1}
                </span>
                <span className="text-xs text-slate-400 font-semibold">Tim</span>
              </div>
              <p className="text-[11px] text-slate-500">Workspace multi-tenant aktif</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Pengguna Berbayar vs Free</span>
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-amber-300 font-mono">
                  {metrics?.paidSubscribers || 0}
                </span>
                <span className="text-xs text-slate-400">
                  / {metrics?.freeTrialUsers || users.length} Free
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Starter, Business & Enterprise</p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-1">
              <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>Total Omzet Midtrans (IDR)</span>
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-emerald-400 font-mono">
                  Rp {(metrics?.totalRevenueIdr || 0).toLocaleString('id-ID')}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Transaksi terbayar lunas</p>
            </div>
          </div>

          {/* Action Bar & Search & Filters */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama, email, perusahaan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </form>

            {/* Filter Plan Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto scrollbar-none text-xs">
              <button
                onClick={() => setPlanFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl font-medium transition whitespace-nowrap ${
                  planFilter === 'ALL' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white bg-slate-900'
                }`}
              >
                Semua ({users.length})
              </button>
              <button
                onClick={() => setPlanFilter('FREE')}
                className={`px-3 py-1.5 rounded-xl font-medium transition whitespace-nowrap ${
                  planFilter === 'FREE' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white bg-slate-900'
                }`}
              >
                Free ({metrics?.planCounts?.FREE || 0})
              </button>
              <button
                onClick={() => setPlanFilter('STARTER')}
                className={`px-3 py-1.5 rounded-xl font-medium transition whitespace-nowrap ${
                  planFilter === 'STARTER' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white bg-slate-900'
                }`}
              >
                Starter ({metrics?.planCounts?.STARTER || 0})
              </button>
              <button
                onClick={() => setPlanFilter('BUSINESS')}
                className={`px-3 py-1.5 rounded-xl font-medium transition whitespace-nowrap ${
                  planFilter === 'BUSINESS' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white bg-slate-900'
                }`}
              >
                Business ({metrics?.planCounts?.BUSINESS || 0})
              </button>
              <button
                onClick={() => setPlanFilter('ENTERPRISE')}
                className={`px-3 py-1.5 rounded-xl font-medium transition whitespace-nowrap ${
                  planFilter === 'ENTERPRISE' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white bg-slate-900'
                }`}
              >
                Enterprise ({metrics?.planCounts?.ENTERPRISE || 0})
              </button>
            </div>

            {/* Actions: Refresh & Export */}
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
              <button
                onClick={fetchData}
                disabled={loading}
                className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition"
                title="Muat Ulang Data"
              >
                <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={handleExportCsv}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5"
                title="Unduh data dalam format CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Ekspor CSV</span>
              </button>
            </div>
          </div>

          {/* Master User Table */}
          <div className="overflow-x-auto border border-slate-800 rounded-2xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[11px]">
                <tr>
                  <th className="py-3 px-4">Pengguna</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Workspace / Perusahaan</th>
                  <th className="py-3 px-4">Paket Langganan</th>
                  <th className="py-3 px-4">Kuota Tugas</th>
                  <th className="py-3 px-4">Terdaftar & Terakhir Login</th>
                  <th className="py-3 px-4 text-right">Aksi Founder</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 bg-slate-950/40 text-slate-300">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 italic">
                      Tidak ada pengguna yang sesuai dengan filter pencarian.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const initials = u.displayName
                      ? u.displayName
                          .split(' ')
                          .map((w) => w[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()
                      : 'U';

                    const planColor =
                      u.plan === 'ENTERPRISE'
                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                        : u.plan === 'BUSINESS'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : u.plan === 'STARTER'
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        : 'bg-slate-800 text-slate-400 border-slate-700';

                    const usedPercent = Math.min(
                      100,
                      Math.round(((u.tasksUsedThisMonth || 0) / (u.taskQuotaLimit || 50)) * 100)
                    );

                    return (
                      <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                        {/* Name */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-xs text-white shrink-0">
                              {initials}
                            </div>
                            <div>
                              <span className="font-bold text-white block">{u.displayName}</span>
                              <span className="text-[10px] text-slate-500 font-mono">{u.id}</span>
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-slate-300">{u.email}</span>
                            <button
                              onClick={() => handleCopyEmail(u.id, u.email)}
                              className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-white transition"
                              title="Salin Email"
                            >
                              {copiedEmailId === u.id ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Workspace */}
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-white block">
                            {u.workspaceName || 'Default Workspace'}
                          </span>
                          <span className="text-[10px] text-slate-500 uppercase">{u.workspaceRole || 'OWNER'}</span>
                        </td>

                        {/* Plan */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide inline-block ${planColor}`}
                          >
                            {u.plan || 'FREE'}
                          </span>
                        </td>

                        {/* Quota */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1 w-32">
                            <div className="flex justify-between text-[10px] font-mono text-slate-400">
                              <span>{u.tasksUsedThisMonth || 0} dipakai</span>
                              <span>{u.taskQuotaLimit || 50} limit</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full ${usedPercent > 80 ? 'bg-rose-500' : 'bg-blue-500'}`}
                                style={{ width: `${usedPercent}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Dates */}
                        <td className="py-3.5 px-4 text-[11px] text-slate-400 space-y-0.5">
                          <div className="flex items-center gap-1 text-slate-300">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>
                              {u.createdAt ? new Date(u.createdAt).toLocaleDateString('id-ID') : '-'}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 block">
                            Login: {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleTimeString('id-ID') : 'Belum pernah'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                setEditingUser(u);
                                setSelectedPlan(u.plan || 'BUSINESS');
                                setCustomQuota(u.taskQuotaLimit || 2500);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/30 text-xs font-semibold transition flex items-center gap-1"
                              title="Ubah Paket / Berikan Lisensi"
                            >
                              <Edit className="w-3 h-3" />
                              <span>Paket</span>
                            </button>

                            <button
                              onClick={() => {
                                setResettingUser(u);
                                setTempPassword('IdTech2026!');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition flex items-center gap-1"
                              title="Reset Password Pengguna"
                            >
                              <KeyRound className="w-3 h-3" />
                              <span>Reset</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div>
            <span>Data tersinkronisasi langsung dengan tabel PostgreSQL `human_users` dan `workspaces`</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors"
            >
              Tutup Panel Founder
            </button>
          </div>
        </div>
      </div>

      {/* Edit Plan Sub-Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-white text-base">Ubah Lisensi Paket Pengguna</h4>
              <button
                onClick={() => setEditingUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Pengguna: <strong className="text-white">{editingUser.displayName}</strong> ({editingUser.email})
            </p>

            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-300 block">Pilih Paket Lisensi</label>
              <select
                value={selectedPlan}
                onChange={(e) => {
                  setSelectedPlan(e.target.value);
                  if (e.target.value === 'STARTER') setCustomQuota(500);
                  if (e.target.value === 'BUSINESS') setCustomQuota(2500);
                  if (e.target.value === 'ENTERPRISE') setCustomQuota(999999);
                  if (e.target.value === 'FREE') setCustomQuota(50);
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="FREE">Free Trial (50 tugas/bln)</option>
                <option value="STARTER">Starter Tim (500 tugas/bln)</option>
                <option value="BUSINESS">Business Scale (2.500 tugas/bln)</option>
                <option value="ENTERPRISE">Enterprise Custom (Akses Tak Terbatas)</option>
              </select>

              <label className="text-xs font-semibold text-slate-300 block pt-1">Batas Kuota Tugas Manual</label>
              <input
                type="number"
                value={customQuota}
                onChange={(e) => setCustomQuota(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-cyan-400 font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
              >
                Batal
              </button>
              <button
                onClick={handleSavePlan}
                disabled={savingPlan}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1.5"
              >
                {savingPlan ? 'Menyimpan...' : 'Terapkan Paket'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Sub-Modal */}
      {resettingUser && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-white text-base">Reset Kata Sandi Pengguna</h4>
              <button
                onClick={() => setResettingUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Reset sandi untuk: <strong className="text-white">{resettingUser.email}</strong>. Pengguna akan diwajibkan mengganti kata sandi setelah login pertama kali.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">Kata Sandi Sementara</label>
              <input
                type="text"
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setResettingUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
              >
                Batal
              </button>
              <button
                onClick={handleResetPassword}
                disabled={resettingPwd}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1.5"
              >
                {resettingPwd ? 'Mereset...' : 'Reset Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
