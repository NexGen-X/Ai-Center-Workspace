/**
 * Live System Telemetry & Terminal Console Drawer — AI Agent Command Center
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  ChevronUp,
  ChevronDown,
  X,
  Play,
  RotateCcw,
  Download,
  Copy,
  Trash2,
  Filter,
  Check,
  Search,
  Activity,
  Zap,
  ShieldAlert,
  Server
} from 'lucide-react';
import { SystemLogEntry, OrchestratorStatus } from '../../../../shared/types.js';
import { api } from '../../services/api.js';
import { useFeedback } from '../common/FeedbackContext.js';
import { CustomCheckbox } from '../common/CustomCheckbox.js';

interface ConsoleDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  orchestratorStatus?: OrchestratorStatus;
  onRefreshOrchestrator?: () => void;
}

export const ConsoleDrawer: React.FC<ConsoleDrawerProps> = ({
  isOpen,
  onClose,
  orchestratorStatus,
  onRefreshOrchestrator
}) => {
  const { toast } = useFeedback();
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [activeLevel, setActiveLevel] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [runningCycle, setRunningCycle] = useState<boolean>(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch initial logs
  const fetchLogs = async () => {
    try {
      const res = await api.getSystemLogs(200);
      setLogs(res.logs || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Connect to SSE for realtime logs
  useEffect(() => {
    if (!isOpen) return;

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/realtime');
      eventSource.addEventListener('system.log', (e: MessageEvent) => {
        try {
          const entry: SystemLogEntry = JSON.parse(e.data);
          setLogs(prev => {
            const next = [...prev, entry];
            return next.slice(-300); // keep max 300 logs
          });
        } catch {
          // ignore
        }
      });
    } catch {
      // SSE not available
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [isOpen]);

  // Auto-scroll effect
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll, activeCategory, activeLevel]);

  if (!isOpen) return null;

  // Filtered logs
  const filteredLogs = logs.filter(log => {
    if (activeCategory !== 'ALL' && log.category !== activeCategory) return false;
    if (activeLevel !== 'ALL' && log.level !== activeLevel) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return (
        log.message.toLowerCase().includes(q) ||
        log.category.toLowerCase().includes(q) ||
        (log.meta && JSON.stringify(log.meta).toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleClear = async () => {
    try {
      await api.clearSystemLogs();
      setLogs([]);
      toast.info('Buffer log konsol dibersihkan.');
    } catch (err: any) {
      toast.error(err.message || 'Gagal membersihkan log.');
    }
  };

  const handleCopyAll = () => {
    const text = filteredLogs
      .map(l => `[${l.timestamp}] [${l.level}] [${l.category}] ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Log berhasil disalin ke clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const text = filteredLogs
      .map(l => `[${l.timestamp}] [${l.level}] [${l.category}] ${l.message}${l.meta ? ' ' + JSON.stringify(l.meta) : ''}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-center-telemetry-${new Date().toISOString().slice(0, 19)}.log`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('File log berhasil diunduh.');
  };

  const handleRunCycle = async () => {
    setRunningCycle(true);
    try {
      const res = await api.runOrchestratorNow();
      toast.success(res.message || 'Siklus orkestrasi dijalankan.');
      if (onRefreshOrchestrator) onRefreshOrchestrator();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menjalankan siklus.');
    } finally {
      setRunningCycle(false);
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      case 'WARN':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'DEBUG':
        return 'text-slate-400 bg-slate-800 border-slate-700';
      default:
        return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'ORCHESTRATOR':
        return 'text-emerald-400';
      case 'INFERENCE':
        return 'text-purple-400';
      case 'API':
        return 'text-blue-400';
      case 'SECURITY':
        return 'text-red-400';
      default:
        return 'text-slate-400';
    }
  };

  return (
    <aside
      aria-label="Konsol Telemetri Sistem"
      className={`fixed bottom-0 left-0 right-0 z-40 bg-[#080C14]/95 border-t border-cyan-500/30 backdrop-blur-xl shadow-2xl transition-all duration-300 flex flex-col font-mono ${
        isExpanded ? 'h-[420px]' : 'h-[250px]'
      }`}
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-slate-800 bg-[#0B101D] select-none text-xs">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span className="tracking-wider">SYS.TELEMETRY</span>
          </div>

          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            {filteredLogs.length} events
          </span>

          {orchestratorStatus && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold flex items-center gap-1 ${
              orchestratorStatus.enabled
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}>
              <Zap className="w-3 h-3" />
              AUTO: {orchestratorStatus.enabled ? 'RUNNING' : 'STANDBY'}
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Force Dispatch Cycle */}
          <button
            type="button"
            onClick={handleRunCycle}
            disabled={runningCycle}
            className="flex items-center gap-1 px-2 py-1 rounded bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/40 text-[11px] font-sans font-semibold transition disabled:opacity-50"
            title="Paksa Eksekusi Siklus Auto-Orchestrator Sekarang"
          >
            <Play className={`w-3 h-3 ${runningCycle ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Run Cycle</span>
          </button>

          {/* Copy Logs */}
          <button
            type="button"
            onClick={handleCopyAll}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Salin Semua Log"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Download Logs */}
          <button
            type="button"
            onClick={handleDownload}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Unduh Log (.log)"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Clear Buffer */}
          <button
            type="button"
            onClick={handleClear}
            className="p-1 rounded bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-400 border border-slate-700 transition"
            title="Bersihkan Log"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Expand / Minimize Toggle */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title={isExpanded ? 'Perkecil Konsol' : 'Perbesar Konsol'}
          >
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>

          {/* Close Console */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup konsol telemetri"
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition"
            title="Tutup Konsol"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Filter & Subheader Row */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-800/80 bg-slate-950/70 text-[11px] flex-wrap gap-2">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {['ALL', 'ORCHESTRATOR', 'INFERENCE', 'API', 'SYSTEM', 'SECURITY'].map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition ${
                activeCategory === cat
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 font-bold'
                  : 'text-slate-400 hover:text-white bg-slate-900 border border-transparent'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Level Filters & Search */}
        <div className="flex items-center gap-2">
          {/* Level Filter */}
          <div className="flex items-center gap-1">
            {['ALL', 'INFO', 'WARN', 'ERROR'].map(lvl => (
              <button
                key={lvl}
                type="button"
                onClick={() => setActiveLevel(lvl)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition ${
                  activeLevel === lvl
                    ? 'bg-slate-700 text-white font-bold'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari log..."
              className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 pl-6 text-[10px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-24 sm:w-36"
            />
            <Search className="w-3 h-3 text-slate-500 absolute left-1.5 top-1.5" />
          </div>

          {/* Auto-scroll toggle */}
          <CustomCheckbox
            variant="checkbox"
            label={<span className="text-[10px] text-slate-400">Auto-scroll</span>}
            checked={autoScroll}
            onChange={checked => setAutoScroll(checked)}
          />
        </div>
      </div>

      {/* Log Output Area */}
      <div
        ref={scrollRef}
        tabIndex={0}
        aria-label="Daftar Log Konsol"
        className="flex-1 overflow-y-auto p-2 space-y-1 text-[11px] leading-relaxed select-text"
      >
        {filteredLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-500 text-xs italic">
            Belum ada aktivitas log yang cocok dengan filter.
          </div>
        ) : (
          filteredLogs.map(log => (
            <div
              key={log.id}
              className="group flex items-start gap-2 py-0.5 px-1 rounded hover:bg-slate-900/60 font-mono transition"
            >
              {/* Timestamp */}
              <span className="text-slate-500 text-[10px] shrink-0 font-mono">
                {new Date(log.timestamp).toLocaleTimeString('id-ID', { hour12: false })}
              </span>

              {/* Level Badge */}
              <span
                className={`px-1 py-0.2 text-[9px] font-bold rounded border shrink-0 ${getLevelColor(
                  log.level
                )}`}
              >
                {log.level}
              </span>

              {/* Category */}
              <span
                className={`text-[10px] font-semibold shrink-0 ${getCategoryColor(
                  log.category
                )}`}
              >
                [{log.category}]
              </span>

              {/* Message */}
              <span className="text-slate-200 flex-1 break-all">
                {log.message}
                {log.meta && (
                  <span className="text-slate-400 text-[10px] ml-2">
                    {JSON.stringify(log.meta)}
                  </span>
                )}
              </span>
            </div>
          ))
        )}
      </div>
    </aside>
  );
};
