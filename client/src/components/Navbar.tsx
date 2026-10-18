import React, { useState, useEffect } from 'react';
import {
  Bot,
  Plus,
  ShieldCheck,
  Clock,
  Radio,
  Calendar,
  User,
  LogOut,
  BarChart2,
  BookOpen,
  Layers,
  Settings,
  Users,
  CheckSquare,
  Home,
  CheckCircle2,
  Cpu,
  Terminal,
  Zap,
  FlaskConical,
  Workflow,
  Network,
  Swords,
  ShieldAlert,
  LineChart,
  Wrench,
  Brain,
  Building2,
  ChevronDown,
  Sparkles
} from 'lucide-react';
import { NotificationDropdown } from './NotificationDropdown.js';
import { OrchestratorStatus } from '../../../shared/types.js';

interface NavbarProps {
  onOpenAddAgent: () => void;
  onOpenManageTeam: () => void;
  onOpenProviders: () => void;
  onOpenTasks: () => void;
  onOpenCreateTask: () => void;
  onOpenCalendar: () => void;
  onOpenReports: () => void;
  onOpenDocuments: () => void;
  onOpenProjects: () => void;
  onOpenSettings: () => void;
  onOpenPlayground: () => void;
  onOpenPipeline?: () => void;
  onOpenSwarm?: () => void;
  onOpenWarRoom?: () => void;
  onOpenSre?: () => void;
  onOpenDataAnalyst?: () => void;
  onOpenSkills?: () => void;
  onOpenMemoryGraph?: () => void;
  onOpenActions?: () => void;
  pendingActionCount?: number;
  onOpenLogin: () => void;
  onLogout: () => void;
  currentUser: { displayName: string; email: string; role: string } | null;
  isRealtimeConnected: boolean;
  systemStatus: 'OPERATIONAL' | 'DEGRADED' | 'MAINTENANCE';
  unreadActivityCount?: number;
  orchestratorStatus?: OrchestratorStatus;
  onToggleOrchestrator?: () => void;
  onToggleConsole?: () => void;
  isConsoleOpen?: boolean;
  activeWorkspaceName?: string;
  onOpenWorkspaces?: () => void;
  currentPlan?: string;
  onOpenPricing?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenAddAgent,
  onOpenManageTeam,
  onOpenProviders,
  onOpenTasks,
  onOpenCreateTask,
  onOpenCalendar,
  onOpenReports,
  onOpenDocuments,
  onOpenProjects,
  onOpenSettings,
  onOpenPlayground,
  onOpenPipeline,
  onOpenSwarm,
  onOpenWarRoom,
  onOpenSre,
  onOpenDataAnalyst,
  onOpenSkills,
  onOpenMemoryGraph,
  onOpenActions,
  pendingActionCount = 0,
  onOpenLogin,
  onLogout,
  currentUser,
  isRealtimeConnected,
  systemStatus,
  unreadActivityCount = 0,
  orchestratorStatus,
  onToggleOrchestrator,
  onToggleConsole,
  isConsoleOpen,
  activeWorkspaceName = 'Default Workspace',
  onOpenWorkspaces,
  currentPlan = 'FREE',
  onOpenPricing
}) => {
  const [dateStr, setDateStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const dayName = days[now.getDay()];
      const dayNum = String(now.getDate()).padStart(2, '0');
      const monthName = months[now.getMonth()];
      const year = now.getFullYear();
      const time = now.toLocaleTimeString('id-ID', { hour12: false });
      setDateStr(`${dayName}, ${dayNum} ${monthName} ${year} • ${time}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const operatorName = currentUser?.displayName || 'Yulian';

  return (
    <header className="sticky top-0 z-40 w-full bg-[#0B0F17]/95 backdrop-blur-md border-b border-slate-800/80 px-3 lg:px-6 py-2 sm:py-2.5">
      <div className="max-w-[1720px] mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-2 lg:gap-3">
        {/* Top Row for Mobile / Left Brand for Desktop */}
        <div className="flex items-center justify-between w-full lg:w-auto gap-2 shrink-0">
          {/* Brand: [M] Command Center & Workspace Selector */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 p-0.5 shadow-md shadow-blue-500/20 flex items-center justify-center">
                <div className="w-full h-full bg-[#0B0F17] rounded-[10px] flex items-center justify-center">
                  <span className="font-black text-sm text-cyan-400">M</span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-sm tracking-tight text-white hidden sm:inline">
                    Command Center
                  </span>
                  <span className={`w-2 h-2 rounded-full ${isRealtimeConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                </div>
              </div>
            </div>

            {/* Workspace Selector Badge */}
            {onOpenWorkspaces && (
              <button
                type="button"
                onClick={onOpenWorkspaces}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/60 hover:border-cyan-500/50 text-xs text-slate-300 hover:text-white transition group shadow-sm"
                title="Ganti atau Kelola Organisasi / Workspace"
              >
                <Building2 className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform shrink-0" />
                <span className="max-w-[100px] sm:max-w-[140px] truncate font-semibold text-slate-200">
                  {activeWorkspaceName}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-500 group-hover:text-cyan-400 transition-colors shrink-0" />
              </button>
            )}

            {/* SaaS Plan Badge & Upgrade Button */}
            {onOpenPricing && (
              <button
                type="button"
                onClick={onOpenPricing}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 hover:from-amber-500/20 hover:to-orange-500/20 border border-amber-500/30 text-xs text-amber-300 font-semibold transition shadow-sm group shrink-0"
                title="Kelola Paket Langganan & Kuota AI"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
                <span className="uppercase font-mono text-[11px] font-bold">
                  {currentPlan || 'FREE'}
                </span>
                <span className="text-[10px] text-amber-400/80 font-normal">Upgrade</span>
              </button>
            )}
          </div>

          {/* Mobile Right Quick Action Icons (Visible only on < lg) */}
          <div className="flex lg:hidden items-center gap-1.5 shrink-0">
            {/* Mobile Pricing / Upgrade */}
            {onOpenPricing && (
              <button
                onClick={onOpenPricing}
                className="p-1.5 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 text-amber-400 hover:text-amber-300 transition"
                title="Paket Langganan & Kuota AI"
                aria-label="Pricing"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            )}
            {/* Mobile Auto Orchestrator Toggle */}
            {onToggleOrchestrator && (
              <button
                onClick={onToggleOrchestrator}
                className={`p-1.5 rounded-xl border transition ${
                  orchestratorStatus?.enabled
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
                title={orchestratorStatus?.enabled ? 'Auto-Orchestrator Aktif' : 'Auto-Orchestrator Standby'}
                aria-label="Auto Orchestrator"
              >
                <Zap className={`w-4 h-4 ${orchestratorStatus?.enabled ? 'fill-emerald-400 text-emerald-400 animate-pulse' : ''}`} />
              </button>
            )}

            {/* Mobile Terminal Console */}
            {onToggleConsole && (
              <button
                onClick={onToggleConsole}
                className={`p-1.5 rounded-xl border transition ${
                  isConsoleOpen
                    ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
                title="Buka Konsol Telemetri"
                aria-label="Terminal Console"
              >
                <Terminal className="w-4 h-4" />
              </button>
            )}

            {/* Mobile Playground */}
            <button
              onClick={onOpenPlayground}
              className="p-1.5 rounded-xl bg-slate-900 border border-slate-800 text-amber-400 hover:text-amber-300 transition"
              title="AI Playground & Benchmark"
              aria-label="AI Playground"
            >
              <FlaskConical className="w-4 h-4" />
            </button>

            {/* Settings */}
            <button
              onClick={onOpenSettings}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800/60 transition"
              title="Pengaturan Workspace"
              aria-label="Pengaturan"
            >
              <Settings className="w-4 h-4 text-slate-400" />
            </button>

            {/* Notifications */}
            <NotificationDropdown />

            {/* User Profile Avatar */}
            {currentUser ? (
              <div className="flex items-center gap-1 pl-1">
                <div
                  className="w-7 h-7 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center"
                  title={`${operatorName} (Online)`}
                >
                  <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-500 to-rose-400 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                    {operatorName.charAt(0)}
                  </div>
                </div>
                <button
                  onClick={onLogout}
                  className="p-1.5 rounded-xl bg-slate-900 hover:bg-red-500/20 hover:text-red-400 text-slate-400 border border-slate-800 transition"
                  title="Keluar"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div
                onClick={onOpenLogin}
                className="w-7 h-7 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center cursor-pointer hover:border-slate-700 transition"
                title="Masuk sebagai Operator"
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-500 to-rose-400 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                  Y
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Sleek Pill Navigation Bar (Matching Screenshot & Swipeable on Mobile) */}
        <nav className="flex items-center bg-slate-900/90 border border-slate-800/90 rounded-2xl p-1 shadow-inner gap-0.5 overflow-x-auto no-scrollbar scroll-smooth w-full lg:w-auto justify-start lg:justify-center">
          {/* Beranda (Active Tab) */}
          <button
            className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-md shadow-blue-600/30 transition shrink-0 whitespace-nowrap"
          >
            <Home className="w-3.5 h-3.5 shrink-0" />
            <span>Beranda</span>
          </button>

          {/* Tugas */}
          <button
            onClick={onOpenTasks}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 text-xs font-medium transition shrink-0 whitespace-nowrap"
          >
            <CheckSquare className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>Tugas</span>
          </button>

          {/* Tim */}
          <button
            onClick={onOpenManageTeam}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 text-xs font-medium transition shrink-0 whitespace-nowrap"
          >
            <Users className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span>Tim</span>
          </button>

          {/* Provider */}
          <button
            onClick={onOpenProviders}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 text-xs font-medium transition shrink-0 whitespace-nowrap"
          >
            <Cpu className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Provider</span>
          </button>

          {/* Proyek */}
          <button
            onClick={onOpenProjects}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 text-xs font-medium transition shrink-0 whitespace-nowrap"
          >
            <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Proyek</span>
          </button>

          {/* Kalender & Jadwal Rutin */}
          <button
            onClick={onOpenCalendar}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 text-xs font-medium transition shrink-0 whitespace-nowrap"
          >
            <Calendar className="w-3.5 h-3.5 text-pink-400 shrink-0" />
            <span>Jadwal & Kalender</span>
          </button>

          {/* Dokumen */}
          <button
            onClick={onOpenDocuments}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 text-xs font-medium transition shrink-0 whitespace-nowrap"
          >
            <BookOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>Dokumen</span>
          </button>

          {/* Laporan */}
          <button
            onClick={onOpenReports}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 text-xs font-medium transition shrink-0 whitespace-nowrap"
          >
            <BarChart2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Laporan</span>
          </button>

          {/* Playground & Benchmark */}
          <button
            onClick={onOpenPlayground}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 text-xs font-medium transition shrink-0 whitespace-nowrap"
          >
            <FlaskConical className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Playground</span>
          </button>

          {/* Swarm Pipeline */}
          {onOpenPipeline && (
            <button
              onClick={onOpenPipeline}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 text-xs font-medium transition shrink-0 whitespace-nowrap"
            >
              <Workflow className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span>Pipeline</span>
            </button>
          )}

          {/* Autonomous Swarm Mesh */}
          {onOpenSwarm && (
            <button
              onClick={onOpenSwarm}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold shadow-sm transition shrink-0 whitespace-nowrap"
              title="Autonomous Multi-Agent Swarm & Hierarchical Delegation Mesh"
            >
              <Network className="w-3.5 h-3.5 text-indigo-400 shrink-0 animate-pulse" />
              <span>Swarm Mesh</span>
            </button>
          )}

          {/* Multi-Agent War Room */}
          {onOpenWarRoom && (
            <button
              type="button"
              onClick={onOpenWarRoom}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold shadow-sm transition shrink-0 whitespace-nowrap"
              title="Multi-Agent War Room & Live Debate Studio"
            >
              <Swords className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>War Room</span>
            </button>
          )}

          {/* Autonomous SRE Self-Healing */}
          {onOpenSre && (
            <button
              type="button"
              onClick={onOpenSre}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-semibold shadow-sm transition shrink-0 whitespace-nowrap"
              title="Autonomous SRE & Server Self-Healing Agent"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span>SRE Agent</span>
            </button>
          )}

          {/* Autonomous Data Analyst */}
          {onOpenDataAnalyst && (
            <button
              type="button"
              onClick={onOpenDataAnalyst}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-semibold shadow-sm transition shrink-0 whitespace-nowrap"
              title="Autonomous Data Analyst & Interactive Visualizer Studio"
            >
              <LineChart className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span>Data Analyst</span>
            </button>
          )}

          {/* No-Code Agent Skill Builder */}
          {onOpenSkills && (
            <button
              type="button"
              onClick={onOpenSkills}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-semibold shadow-sm transition shrink-0 whitespace-nowrap"
              title="No-Code Agent Skill Builder & Dynamic Tool Studio"
            >
              <Wrench className="w-3.5 h-3.5 text-purple-400 shrink-0" />
              <span>Skill Studio</span>
            </button>
          )}

          {/* Cognitive Memory Graph Explorer */}
          {onOpenMemoryGraph && (
            <button
              type="button"
              onClick={onOpenMemoryGraph}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold shadow-sm transition shrink-0 whitespace-nowrap"
              title="Agent Mind Map & Cognitive Memory Graph Explorer"
            >
              <Brain className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Memory Graph</span>
            </button>
          )}


          {/* Aksi Sandbox & Human-in-the-Loop */}
          {onOpenActions && (
            <button
              onClick={onOpenActions}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition shrink-0 whitespace-nowrap ${
                pendingActionCount > 0
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-md shadow-amber-950/40 animate-pulse font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
              title="Agent Tool Calling & Action Sandbox"
            >
              <Terminal className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Aksi Sandbox</span>
              {pendingActionCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-amber-400 text-slate-950 text-[10px] font-extrabold flex items-center justify-center">
                  {pendingActionCount}
                </span>
              )}
            </button>
          )}
        </nav>

        {/* Right Section: Time, Notifications, Settings & Operator Profile (Desktop lg:flex) */}
        <div className="hidden lg:flex items-center gap-2 shrink-0">
          {/* Auto-Orchestrator Toggle Badge */}
          {onToggleOrchestrator && (
            <button
              onClick={onToggleOrchestrator}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-mono font-bold transition ${
                orchestratorStatus?.enabled
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 shadow-sm shadow-emerald-500/20'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title={orchestratorStatus?.enabled ? 'Auto-Orchestrator Aktif. Klik untuk beralih ke Standby.' : 'Auto-Orchestrator Standby. Klik untuk aktifkan pemrosesan otomatis.'}
            >
              <Zap className={`w-3.5 h-3.5 ${orchestratorStatus?.enabled ? 'text-emerald-400 fill-emerald-400 animate-pulse' : 'text-slate-500'}`} />
              <span className="text-[11px]">
                AUTO: {orchestratorStatus?.enabled ? 'AKTIF' : 'STANDBY'}
              </span>
            </button>
          )}

          {/* Console Drawer Button */}
          {onToggleConsole && (
            <button
              onClick={onToggleConsole}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs transition ${
                isConsoleOpen
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 font-bold'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
              }`}
              title="Buka / Tutup Konsol Telemetri Sistem"
            >
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[11px] font-mono">Console</span>
            </button>
          )}

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-800 transition"
            title="Pengaturan Workspace"
          >
            <Settings className="w-4 h-4 text-slate-400" />
          </button>

          {/* Notifications */}
          <NotificationDropdown />

          {/* Live Clock / Date format: Rab, 07 Okt 2026 • 14:46:33 */}
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900/80 border border-slate-800 text-[11px] font-mono text-slate-300">
            <Clock className="w-3 h-3 text-slate-500" />
            <span>{dateStr || 'Memuat...'}</span>
          </div>

          {/* User Profile Chip: Yulian • Online */}
          {currentUser ? (
            <div className="flex items-center gap-1.5 pl-1.5">
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs">
                <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-500 to-rose-400 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                  {operatorName.charAt(0)}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white">{operatorName}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[10px] text-emerald-400 font-semibold hidden xl:inline">Online</span>
                </div>
              </div>
              <button
                onClick={onLogout}
                className="p-1.5 rounded-xl bg-slate-900 hover:bg-red-500/20 hover:text-red-400 text-slate-400 border border-slate-800 transition"
                title="Keluar"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 pl-1.5">
              <button
                onClick={onOpenLogin}
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-semibold transition"
              >
                <User className="w-3.5 h-3.5" />
                <span>Masuk</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
