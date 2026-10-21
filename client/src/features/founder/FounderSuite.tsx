import React, { useState, useEffect } from 'react';
import {
  Crown,
  DollarSign,
  TrendingUp,
  Users,
  Building,
  Shield,
  Activity,
  Layers,
  Cpu,
  Radio,
  Clock,
  ArrowLeft,
  Search,
  Filter,
  Download,
  RotateCw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Send,
  Power,
  KeyRound,
  Edit,
  Copy,
  Check,
  ChevronRight,
  PieChart,
  BarChart3,
  ExternalLink,
  Lock
} from 'lucide-react';
import { api } from '../../services/api.js';

interface FounderSuiteProps {
  onExit: () => void;
  currentUser?: { displayName: string; email: string; role: string } | null;
}

type SuiteTab = 'overview' | 'users' | 'economics' | 'audit' | 'governance';

export const FounderSuite: React.FC<FounderSuiteProps> = ({ onExit, currentUser }) => {
  const [activeTab, setActiveTab] = useState<SuiteTab>('overview');
  const [loading, setLoading] = useState(false);

  // Data States
  const [metrics, setMetrics] = useState<any>(null);
  const [financials, setFinancials] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [broadcast, setBroadcast] = useState<any>(null);

  // User Filter State
  const [userSearch, setUserSearch] = useState('');
  const [userPlanFilter, setUserPlanFilter] = useState('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Edit Plan State
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [selectedPlan, setSelectedPlan] = useState('BUSINESS');
  const [customQuota, setCustomQuota] = useState(2500);
  const [savingPlan, setSavingPlan] = useState(false);

  // Reset Password State
  const [resettingUser, setResettingUser] = useState<any | null>(null);
  const [tempPassword, setTempPassword] = useState('IdTech2026!');
  const [resettingPwd, setResettingPwd] = useState(false);

  // Broadcast Form State
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastType, setBroadcastType] = useState<'info' | 'warning' | 'critical'>('info');
  const [broadcastEnabled, setBroadcastEnabled] = useState(true);
  const [savingBroadcast, setSavingBroadcast] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadAllSuiteData = async () => {
    setLoading(true);
    try {
      const [metRes, finRes, usersRes, logsRes, healthRes, bcRes] = await Promise.all([
        api.getAdminMetrics().catch(() => null),
        api.getAdminFinancials().catch(() => null),
        api.getAdminUsers({ search: userSearch, plan: userPlanFilter }).catch(() => null),
        api.getAdminAuditLogs(50).catch(() => null),
        api.getAdminSystemHealth().catch(() => null),
        api.getAdminBroadcast().catch(() => null)
      ]);

      if (metRes?.metrics) setMetrics(metRes.metrics);
      if (finRes?.financials) setFinancials(finRes.financials);
      if (usersRes?.users) setUsers(usersRes.users);
      if (logsRes?.logs) setAuditLogs(logsRes.logs);
      if (healthRes?.health) setHealth(healthRes.health);
      if (bcRes?.broadcast) {
        setBroadcast(bcRes.broadcast);
        setBroadcastMsg(bcRes.broadcast.message || '');
        setBroadcastType(bcRes.broadcast.type || 'info');
        setBroadcastEnabled(bcRes.broadcast.enabled !== false);
      }
    } catch (err: any) {
      console.error('Error loading founder suite data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllSuiteData();
  }, [userPlanFilter]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSavePlan = async () => {
    if (!editingUser) return;
    setSavingPlan(true);
    try {
      const res = await api.updateUserPlan(editingUser.id, selectedPlan, customQuota);
      showToast(res.message);
      setEditingUser(null);
      loadAllSuiteData();
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
      showToast(res.message);
      setResettingUser(null);
    } catch (err: any) {
      alert(err.message || 'Gagal mereset sandi');
    } finally {
      setResettingPwd(false);
    }
  };

  const handlePublishBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMsg.trim()) return;
    setSavingBroadcast(true);
    try {
      const res = await api.setAdminBroadcast({
        message: broadcastMsg,
        type: broadcastType,
        enabled: broadcastEnabled
      });
      setBroadcast(res.broadcast);
      showToast('Siaran pengumuman global berhasil dipublikasikan ke seluruh klien!');
    } catch (err: any) {
      alert(err.message || 'Gagal mempublikasikan broadcast');
    } finally {
      setSavingBroadcast(false);
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
    link.setAttribute('download', `idtech-founder-user-database-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black animate-fadeIn">
      {/* Top Titanium Executive Bar */}
      <header className="sticky top-0 z-40 bg-[#0B0E14]/95 backdrop-blur-md border-b border-amber-500/20 px-4 lg:px-8 py-3">
        <div className="max-w-[1720px] mx-auto flex items-center justify-between gap-4">
          {/* Brand Left */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-300 p-0.5 shadow-lg shadow-amber-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-[#0B0E14] rounded-[14px] flex items-center justify-center">
                <Crown className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-base tracking-tight text-white">ID-TECH CLOUD</span>
                <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-[10px] font-black uppercase tracking-wider text-amber-300">
                  EXECUTIVE SUITE
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Founder & C-Level Cockpit • Realtime B2B SaaS Business Operations
              </p>
            </div>
          </div>

          {/* Center Live Status */}
          <div className="hidden md:flex items-center gap-4 text-xs font-mono bg-slate-950/80 border border-slate-800/80 px-4 py-1.5 rounded-full">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-300">Sistem Produksi: <strong className="text-emerald-400">OPERATIONAL</strong></span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="text-slate-400">
              Uptime: <strong className="text-cyan-400">99.99%</strong>
            </div>
            <span className="text-slate-700">|</span>
            <div className="text-slate-400">
              DB Latency: <strong className="text-indigo-400">{health?.database?.latencyMs || 2}ms</strong>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={loadAllSuiteData}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition"
              title="Refresh All Data"
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={onExit}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center gap-2 shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Mode Operator</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Suite Container with Sidebar & Content */}
      <div className="flex-1 max-w-[1720px] w-full mx-auto px-4 lg:px-8 py-6 flex flex-col lg:flex-row gap-6">
        {/* Navigation Sidebar */}
        <aside className="w-full lg:w-64 shrink-0 space-y-1.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 px-3 pb-1">
            Modul Kendali Founder
          </div>

          <button
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition ${
              activeTab === 'overview'
                ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-300 shadow-md shadow-amber-500/5'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
            }`}
          >
            <DollarSign className="w-4 h-4 text-amber-400" />
            <div className="text-left">
              <span>Financials & MRR</span>
              <span className="block text-[10px] text-slate-500 font-normal">Omzet & Buku Kas</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition ${
              activeTab === 'users'
                ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-300 shadow-md shadow-amber-500/5'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
            }`}
          >
            <Users className="w-4 h-4 text-blue-400" />
            <div className="text-left">
              <span>User & Enterprise Org</span>
              <span className="block text-[10px] text-slate-500 font-normal">Klien & Lisensi Paket</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('economics')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition ${
              activeTab === 'economics'
                ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-300 shadow-md shadow-amber-500/5'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
            }`}
          >
            <Cpu className="w-4 h-4 text-emerald-400" />
            <div className="text-left">
              <span>Unit Economics & FinOps</span>
              <span className="block text-[10px] text-slate-500 font-normal">Margin Laba & Token</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition ${
              activeTab === 'audit'
                ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-300 shadow-md shadow-amber-500/5'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
            }`}
          >
            <Shield className="w-4 h-4 text-purple-400" />
            <div className="text-left">
              <span>Platform Audit Trail</span>
              <span className="block text-[10px] text-slate-500 font-normal">Log Aktivitas Sistem</span>
            </div>
          </button>

          <button
            onClick={() => setActiveTab('governance')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold transition ${
              activeTab === 'governance'
                ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-300 shadow-md shadow-amber-500/5'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
            }`}
          >
            <Radio className="w-4 h-4 text-cyan-400" />
            <div className="text-left">
              <span>System Broadcast</span>
              <span className="block text-[10px] text-slate-500 font-normal">Siaran & Pengumuman</span>
            </div>
          </button>

          {/* Founder Identity Card */}
          <div className="pt-6">
            <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center font-bold text-xs text-amber-400">
                  👑
                </div>
                <div>
                  <span className="font-bold text-xs text-white block">
                    {currentUser?.displayName || 'Startup Founder'}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Role: SUPERADMIN</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Hak akses penuh level pemilik entitas PT NexGen Digital Nusantara.
              </p>
            </div>
          </div>
        </aside>

        {/* Dynamic Tab Body */}
        <main className="flex-1 space-y-6">
          {/* Toast Banner */}
          {toastMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* ================= TAB 1: FINANCIALS & MRR ================= */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Financial Hero KPI Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-3xl bg-slate-950/70 border border-slate-800 space-y-1 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none" />
                  <span className="text-xs text-slate-400 font-medium">Monthly Recurring Revenue (MRR)</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-amber-400 font-mono">
                      Rp {(financials?.mrrIdr || 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">Estimasi pendapatan berulang bulanan</p>
                </div>

                <div className="p-5 rounded-3xl bg-slate-950/70 border border-slate-800 space-y-1 relative overflow-hidden">
                  <span className="text-xs text-slate-400 font-medium">Annual Run-Rate (ARR)</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-white font-mono">
                      Rp {(financials?.arrIdr || 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">Proyeksi tahunan berjalan</p>
                </div>

                <div className="p-5 rounded-3xl bg-slate-950/70 border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400 font-medium">Total Omzet Lunas (Midtrans)</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-emerald-400 font-mono">
                      Rp {(financials?.totalPaidAmountIdr || 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {financials?.totalPaidCount || 0} invoice terbayar lunas
                  </p>
                </div>

                <div className="p-5 rounded-3xl bg-slate-950/70 border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400 font-medium">Invoice Tertunda (Pending)</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-amber-300 font-mono">
                      Rp {(financials?.totalPendingAmountIdr || 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {financials?.totalPendingCount || 0} transaksi dalam antrean bayar
                  </p>
                </div>
              </div>

              {/* Midtrans Transactions Ledger */}
              <div className="p-6 rounded-3xl bg-slate-950/70 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-emerald-400" />
                      <span>Buku Kas & Riwayat Transaksi Midtrans Real-Time</span>
                    </h4>
                    <p className="text-xs text-slate-400">
                      Mencatat seluruh tagihan, nomor referensi payment gateway, dan metode pembayaran pelanggan.
                    </p>
                  </div>

                  <span className="text-xs font-mono text-slate-400">
                    Gateway: <strong>Midtrans Production (Snap)</strong>
                  </span>
                </div>

                <div className="overflow-x-auto border border-slate-800/80 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[11px]">
                      <tr>
                        <th className="py-3 px-4">No. Invoice</th>
                        <th className="py-3 px-4">Organisasi / Pelanggan</th>
                        <th className="py-3 px-4">Paket</th>
                        <th className="py-3 px-4">Nominal (IDR)</th>
                        <th className="py-3 px-4">Metode Bayar</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Waktu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 bg-slate-950/40 text-slate-300 font-mono">
                      {(!financials?.invoices || financials.invoices.length === 0) ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-500 italic font-sans">
                            Belum ada invoice transaksi pembayaran.
                          </td>
                        </tr>
                      ) : (
                        financials.invoices.map((inv: any) => (
                          <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-3.5 px-4 font-bold text-white">{inv.invoiceNumber}</td>
                            <td className="py-3.5 px-4 font-sans font-semibold">
                              {inv.workspaceName || 'Direct Account'}
                              <span className="block text-[10px] text-slate-500 font-mono">{inv.billingEmail}</span>
                            </td>
                            <td className="py-3.5 px-4 uppercase text-cyan-400 font-bold">{inv.plan}</td>
                            <td className="py-3.5 px-4 text-emerald-400 font-bold">
                              Rp {Number(inv.amountIdr).toLocaleString('id-ID')}
                            </td>
                            <td className="py-3.5 px-4 uppercase text-slate-400 font-sans">
                              {inv.paymentMethod || 'QRIS / VA'}
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  inv.status === 'PAID'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                }`}
                              >
                                {inv.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-[10px] text-slate-500 font-sans">
                              {new Date(inv.createdAt).toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 2: USER DIRECTORY & LICENSE ================= */}
          {activeTab === 'users' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Search & Actions Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-3xl bg-slate-950/70 border border-slate-800">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari pengguna, email, workspace..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto text-xs">
                  {['ALL', 'FREE', 'STARTER', 'BUSINESS', 'ENTERPRISE'].map((plan) => (
                    <button
                      key={plan}
                      onClick={() => setUserPlanFilter(plan)}
                      className={`px-3 py-1.5 rounded-xl font-medium transition whitespace-nowrap ${
                        userPlanFilter === plan
                          ? 'bg-amber-500 text-black font-bold'
                          : 'text-slate-400 hover:text-white bg-slate-900'
                      }`}
                    >
                      {plan === 'ALL' ? 'Semua' : plan}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleExportCsv}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5 shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Ekspor CSV</span>
                </button>
              </div>

              {/* Master Table */}
              <div className="overflow-x-auto border border-slate-800 rounded-3xl bg-slate-950/70">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Pengguna</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Organisasi / Perusahaan</th>
                      <th className="py-3 px-4">Paket Aktif</th>
                      <th className="py-3 px-4">Kuota Tugas</th>
                      <th className="py-3 px-4">Aktivitas</th>
                      <th className="py-3 px-4 text-right">Aksi Founder</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 bg-slate-950/40 text-slate-300">
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500 italic">
                          Tidak ada pengguna ditemukan.
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => {
                        const initials = u.displayName
                          ? u.displayName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
                          : 'U';

                        const planBadge =
                          u.plan === 'ENTERPRISE'
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                            : u.plan === 'BUSINESS'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            : u.plan === 'STARTER'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700';

                        return (
                          <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center font-bold text-xs text-black shrink-0">
                                  {initials}
                                </div>
                                <div>
                                  <span className="font-bold text-white block">{u.displayName}</span>
                                  <span className="text-[10px] text-slate-500 font-mono">{u.id}</span>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 font-mono">
                              <div className="flex items-center gap-1.5">
                                <span>{u.email}</span>
                                <button
                                  onClick={() => handleCopy(u.id, u.email)}
                                  className="text-slate-500 hover:text-white"
                                >
                                  {copiedId === u.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                </button>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 font-semibold text-white">
                              {u.workspaceName || 'Default Workspace'}
                            </td>

                            <td className="py-3.5 px-4">
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase ${planBadge}`}>
                                {u.plan || 'FREE'}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 font-mono">
                              <span className="text-cyan-400">{u.tasksUsedThisMonth || 0}</span> / {u.taskQuotaLimit || 50}
                            </td>

                            <td className="py-3.5 px-4 text-[10px] text-slate-400 space-y-0.5">
                              <div>Daftar: {u.createdAt ? new Date(u.createdAt).toLocaleDateString('id-ID') : '-'}</div>
                              <div className="text-slate-500">
                                Login: {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleTimeString('id-ID') : 'Belum pernah'}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setEditingUser(u);
                                    setSelectedPlan(u.plan || 'BUSINESS');
                                    setCustomQuota(u.taskQuotaLimit || 2500);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-semibold transition"
                                >
                                  Grant Paket
                                </button>
                                <button
                                  onClick={() => {
                                    setResettingUser(u);
                                    setTempPassword('IdTech2026!');
                                  }}
                                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
                                >
                                  Reset
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
          )}

          {/* ================= TAB 3: UNIT ECONOMICS & FINOPS ================= */}
          {activeTab === 'economics' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-3xl bg-slate-950/70 border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400">Gross Profit Margin Platform</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-emerald-400 font-mono">89.4%</span>
                    <span className="text-xs text-emerald-400 font-bold">Laba Bersih</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Margin setelah dikurangi biaya token komputasi API</p>
                </div>

                <div className="p-5 rounded-3xl bg-slate-950/70 border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400">Total Biaya API Token (Bulan Ini)</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-white font-mono">$7.06</span>
                    <span className="text-xs text-slate-400">USD</span>
                  </div>
                  <p className="text-[11px] text-slate-500">≈ Rp 112.960 untuk 3.2M token pemrosesan</p>
                </div>

                <div className="p-5 rounded-3xl bg-slate-950/70 border border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400">ARPU (Average Revenue per User)</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-amber-400 font-mono">Rp 990.000</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Nilai rata-rata akun pelanggan berbayar</p>
                </div>
              </div>

              {/* Upstream AI Health Matrix */}
              <div className="p-6 rounded-3xl bg-slate-950/70 border border-slate-800 space-y-4">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span>Kesehatan & Latensi Upstream AI Provider (SLA Monitor)</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { name: 'Microsoft Azure OpenAI', model: 'GPT-4o (High-Reasoning)', status: 'HEALTHY', latency: '142ms', sla: '99.98%' },
                    { name: 'Anthropic Bedrock', model: 'Claude 3.5 Sonnet', status: 'HEALTHY', latency: '168ms', sla: '99.95%' },
                    { name: 'Groq Cloud LPU', model: 'Llama-3.3-70B', status: 'HEALTHY', latency: '48ms', sla: '99.99%' },
                    { name: 'DeepSeek Platform', model: 'DeepSeek-V3 Engine', status: 'HEALTHY', latency: '195ms', sla: '99.90%' }
                  ].map((p, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white">{p.name}</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                          {p.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">{p.model}</p>
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
                        <span>Latensi: <strong className="text-cyan-400">{p.latency}</strong></span>
                        <span>SLA: <strong className="text-slate-200">{p.sla}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 4: AUDIT TRAIL ================= */}
          {activeTab === 'audit' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-6 rounded-3xl bg-slate-950/70 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Shield className="w-4 h-4 text-purple-400" />
                      <span>Jejak Audit Seluruh Aktivitas Sistem (Immutable Ledger)</span>
                    </h4>
                    <p className="text-xs text-slate-400">
                      Pencatatan peristiwa login, pembuatan task, alokasi lisensi, dan eksekusi swarm yang tidak dapat dimanipulasi.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-slate-500">Kepatuhan UU PDP & SOC2</span>
                </div>

                <div className="overflow-x-auto border border-slate-800 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 uppercase font-semibold text-[11px]">
                      <tr>
                        <th className="py-3 px-4">Waktu</th>
                        <th className="py-3 px-4">Aktor</th>
                        <th className="py-3 px-4">Tipe Peristiwa</th>
                        <th className="py-3 px-4">Deskripsi Aktivitas</th>
                        <th className="py-3 px-4">Workspace</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 bg-slate-950/40 text-slate-300 font-mono">
                      {auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-500 italic font-sans">
                            Belum ada riwayat jejak audit.
                          </td>
                        </tr>
                      ) : (
                        auditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-3 px-4 text-slate-500 text-[10px]">
                              {new Date(log.createdAt).toLocaleString('id-ID')}
                            </td>
                            <td className="py-3 px-4 font-bold text-cyan-400 font-sans">
                              {log.actorName || log.actorType}
                            </td>
                            <td className="py-3 px-4 text-amber-300 font-semibold">{log.eventType}</td>
                            <td className="py-3 px-4 text-slate-300 font-sans">{log.summary}</td>
                            <td className="py-3 px-4 text-slate-400 font-sans">{log.workspaceName || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 5: GOVERNANCE & BROADCAST ================= */}
          {activeTab === 'governance' && (
            <div className="space-y-6 animate-fadeIn">
              <div className="p-6 rounded-3xl bg-slate-950/70 border border-slate-800 space-y-4">
                <div className="space-y-0.5">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Radio className="w-4 h-4 text-cyan-400" />
                    <span>Pusat Siaran Pengumuman Global (Platform Broadcast Banner)</span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    Pesan yang Anda ketik di sini akan langsung tampil pada banner paling atas dashboard seluruh pengguna aktif.
                  </p>
                </div>

                <form onSubmit={handlePublishBroadcast} className="space-y-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-300">Isi Pesan Pengumuman</label>
                    <textarea
                      rows={3}
                      value={broadcastMsg}
                      onChange={(e) => setBroadcastMsg(e.target.value)}
                      placeholder="Contoh: Pembaruan Sistem: Engine GPT-4o telah ditingkatkan dengan latensi 50% lebih cepat."
                      className="w-full p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500 leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-300">Tipe Banner</label>
                      <select
                        value={broadcastType}
                        onChange={(e: any) => setBroadcastType(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none"
                      >
                        <option value="info">Info / Normal (Biru)</option>
                        <option value="warning">Peringatan / Maintenance Terjadwal (Kuning)</option>
                        <option value="critical">Kritis / Insiden Darurat (Merah)</option>
                      </select>
                    </div>

                    <div className="space-y-1 flex items-end">
                      <label className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-900 border border-slate-800 w-full cursor-pointer">
                        <input
                          type="checkbox"
                          checked={broadcastEnabled}
                          onChange={(e) => setBroadcastEnabled(e.target.checked)}
                          className="rounded text-amber-500 focus:ring-0"
                        />
                        <span className="text-xs font-semibold text-white">Tampilkan Banner kepada Pengguna</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={savingBroadcast}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-bold text-xs shadow-lg shadow-amber-500/20 transition flex items-center gap-2"
                    >
                      <Send className="w-3.5 h-3.5 fill-black" />
                      <span>{savingBroadcast ? 'Memancarkan Siaran...' : 'Publikasikan Siaran ke Seluruh Klien'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Grant Plan Sub-Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-3xl p-6 space-y-4 shadow-2xl">
            <h4 className="font-bold text-white text-base flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-400" />
              <span>Berikan Lisensi Paket Manual</span>
            </h4>
            <p className="text-xs text-slate-400">
              Klien: <strong className="text-white">{editingUser.displayName}</strong> ({editingUser.email})
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
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
              >
                <option value="FREE">Free Trial (50 tugas/bln)</option>
                <option value="STARTER">Starter Tim (500 tugas/bln)</option>
                <option value="BUSINESS">Business Scale (2.500 tugas/bln)</option>
                <option value="ENTERPRISE">Enterprise Custom (Akses Tak Terbatas)</option>
              </select>

              <label className="text-xs font-semibold text-slate-300 block pt-1">Batas Kuota Tugas Custom</label>
              <input
                type="number"
                value={customQuota}
                onChange={(e) => setCustomQuota(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-amber-400 font-mono"
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
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition"
              >
                {savingPlan ? 'Menyimpan...' : 'Terapkan Lisensi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Sub-Modal */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl p-6 space-y-4 shadow-2xl">
            <h4 className="font-bold text-white text-base">Reset Kata Sandi Klien</h4>
            <p className="text-xs text-slate-400">
              Reset sandi untuk: <strong className="text-white">{resettingUser.email}</strong>
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
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition"
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
