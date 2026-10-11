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
  CheckCircle2
} from 'lucide-react';
import { NotificationDropdown } from './NotificationDropdown.js';

interface NavbarProps {
  onOpenAddAgent: () => void;
  onOpenManageTeam: () => void;
  onOpenTasks: () => void;
  onOpenCreateTask: () => void;
  onOpenCalendar: () => void;
  onOpenReports: () => void;
  onOpenDocuments: () => void;
  onOpenProjects: () => void;
  onOpenSettings: () => void;
  onOpenLogin: () => void;
  onLogout: () => void;
  currentUser: { displayName: string; email: string; role: string } | null;
  isRealtimeConnected: boolean;
  systemStatus: 'OPERATIONAL' | 'DEGRADED' | 'MAINTENANCE';
  unreadActivityCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenAddAgent,
  onOpenManageTeam,
  onOpenTasks,
  onOpenCreateTask,
  onOpenCalendar,
  onOpenReports,
  onOpenDocuments,
  onOpenProjects,
  onOpenSettings,
  onOpenLogin,
  onLogout,
  currentUser,
  isRealtimeConnected,
  systemStatus,
  unreadActivityCount = 0
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
          {/* Brand: [M] Command Center */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 p-0.5 shadow-md shadow-blue-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-[#0B0F17] rounded-[10px] flex items-center justify-center">
                <span className="font-black text-sm text-cyan-400">M</span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm tracking-tight text-white">
                  Command Center
                </span>
                <span className={`w-2 h-2 rounded-full ${isRealtimeConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              </div>
            </div>
          </div>

          {/* Mobile Right Quick Action Icons (Visible only on < lg) */}
          <div className="flex lg:hidden items-center gap-1.5 shrink-0">
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

          {/* Proyek */}
          <button
            onClick={onOpenProjects}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 text-xs font-medium transition shrink-0 whitespace-nowrap"
          >
            <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Proyek</span>
          </button>

          {/* Kalender */}
          <button
            onClick={onOpenCalendar}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/80 text-xs font-medium transition shrink-0 whitespace-nowrap"
          >
            <Calendar className="w-3.5 h-3.5 text-pink-400 shrink-0" />
            <span>Kalender</span>
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
        </nav>

        {/* Right Section: Time, Notifications, Settings & Operator Profile (Desktop lg:flex) */}
        <div className="hidden lg:flex items-center gap-2 shrink-0">
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
              <div
                onClick={onOpenLogin}
                className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs cursor-pointer hover:border-slate-700 transition"
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-500 to-rose-400 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                  Y
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white">Yulian</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-[10px] text-emerald-400 font-semibold hidden xl:inline">Online</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
