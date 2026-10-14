import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Terminal,
  Check,
  X,
  AlertTriangle,
  Play,
  Clock,
  Bot,
  Layers,
  Sparkles,
  FileCode,
  Globe,
  Database
} from 'lucide-react';
import { AgentAction, ToolRiskLevel } from '../../../../shared/types.js';
import { api } from '../../services/api.js';
import { useFeedback } from '../../components/common/FeedbackContext.js';
import { audioService } from '../../services/audio.js';

interface ActionApprovalModalProps {
  action: AgentAction | null;
  onClose: () => void;
  onActionHandled: () => void;
}

const RISK_BADGES: Record<ToolRiskLevel, { bg: string; text: string; border: string; label: string }> = {
  LOW: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'Rendah (Low Risk)' },
  MEDIUM: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', label: 'Sedang (Medium Risk)' },
  HIGH: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30', label: 'Tinggi (High Risk)' },
  CRITICAL: { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/40', label: 'Kritis (Critical Risk)' }
};

export const ActionApprovalModal: React.FC<ActionApprovalModalProps> = ({
  action,
  onClose,
  onActionHandled
}) => {
  const { toast } = useFeedback();
  const [submitting, setSubmitting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Play alert sound when approval request pops up
  useEffect(() => {
    if (action) {
      audioService.playAlert();
    }
  }, [action?.id]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) {
        onClose();
      }
    };
    if (action) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [action, onClose, submitting]);

  if (!action) return null;

  const risk = RISK_BADGES[action.riskLevel] || RISK_BADGES.MEDIUM;

  const handleApprove = async () => {
    try {
      setSubmitting(true);
      await api.approveAction(action.id);
      audioService.playSuccess();
      toast.success(`Aksi "${action.toolName}" berhasil diizinkan dan dieksekusi di sandbox.`);
      onActionHandled();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengeksekusi aksi.', 'Eksekusi Ditolak');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    try {
      setSubmitting(true);
      await api.rejectAction(action.id, 'lead-operator', rejectReason.trim() || undefined);
      toast.info(`Aksi "${action.toolName}" ditolak oleh operator.`);
      onActionHandled();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menolak aksi.');
    } finally {
      setSubmitting(false);
      setIsRejecting(false);
    }
  };

  const getToolIcon = (name: string) => {
    switch (name) {
      case 'bash_exec':
        return <Terminal className="w-4 h-4 text-amber-400" />;
      case 'file_read':
      case 'file_write':
        return <FileCode className="w-4 h-4 text-cyan-400" />;
      case 'http_fetch':
        return <Globe className="w-4 h-4 text-blue-400" />;
      default:
        return <Sparkles className="w-4 h-4 text-purple-400" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-amber-500/50 rounded-2xl w-full max-w-xl shadow-2xl shadow-amber-950/40 flex flex-col overflow-hidden animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-800 bg-amber-950/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-white tracking-wide flex items-center gap-2">
                <span>Otorisasi Aksi Agen</span>
                <span className="text-[10px] text-amber-400 font-mono font-normal">Human-in-the-Loop</span>
              </h2>
              <p className="text-[10px] text-slate-400">
                Persetujuan operator diperlukan sebelum aksi dijalankan di sandbox.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            title="Tutup (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          {/* Metadata Card */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
            <div>
              <span className="text-[10px] text-slate-400 block mb-0.5">Agen Pengaju:</span>
              <div className="flex items-center gap-1.5 font-bold text-cyan-300">
                <Bot className="w-3.5 h-3.5 text-cyan-400" />
                <span className="truncate">{action.agentName || 'AI Agent'}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block mb-0.5">Tingkat Risiko:</span>
              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${risk.bg} ${risk.text} ${risk.border}`}>
                {risk.label}
              </span>
            </div>

            {action.taskTitle && (
              <div className="col-span-2 pt-1 border-t border-slate-800/80">
                <span className="text-[10px] text-slate-400 block mb-0.5">Konteks Tugas:</span>
                <span className="font-medium text-slate-200 truncate block">{action.taskTitle}</span>
              </div>
            )}
          </div>

          {/* Tool Details Card */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                {getToolIcon(action.toolName)}
                <span className="font-mono text-white font-bold">{action.toolName}</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">Target: /sandbox</span>
            </div>

            {/* Input Arguments Code block */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-amber-200/90 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed shadow-inner">
              {action.toolName === 'bash_exec' && action.toolInput.command ? (
                <div>
                  <span className="text-slate-500 select-none">$ </span>
                  <span className="text-emerald-400 font-bold">{action.toolInput.command}</span>
                </div>
              ) : (
                JSON.stringify(action.toolInput, null, 2)
              )}
            </div>
          </div>

          {/* Rejection reason input form if requested */}
          {isRejecting && (
            <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-2 animate-in fade-in">
              <label className="block text-[11px] font-semibold text-rose-300">
                Alasan Penolakan (Opsional, akan dikirim ke memori agen):
              </label>
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Contoh: Perintah ini berpotensi merusak dependensi..."
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-rose-500/40 text-xs text-white focus:outline-none focus:border-rose-400"
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-t border-slate-800 bg-slate-950/60 gap-3">
          {!isRejecting ? (
            <button
              type="button"
              onClick={() => setIsRejecting(true)}
              disabled={submitting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 hover:text-rose-400 text-slate-400 text-xs font-semibold border border-slate-700 transition"
            >
              <X className="w-3.5 h-3.5" />
              <span>Tolak Aksi</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReject}
                disabled={submitting}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-900/30 transition"
              >
                <X className="w-3.5 h-3.5" />
                <span>Konfirmasi Tolak</span>
              </button>
              <button
                type="button"
                onClick={() => setIsRejecting(false)}
                className="px-2.5 py-2 text-slate-400 hover:text-white text-xs"
              >
                Batal
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleApprove}
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-950/50 transition active:scale-95 disabled:opacity-50"
          >
            {submitting ? (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span>{submitting ? 'Mengeksekusi Sandbox...' : 'Izinkan Eksekusi (Approve)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
