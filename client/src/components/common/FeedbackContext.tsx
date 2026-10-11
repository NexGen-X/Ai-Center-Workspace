import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  Trash2,
  HelpCircle
} from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration?: number;
}

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
}

interface FeedbackContextValue {
  toast: {
    success: (message: string, title?: string, duration?: number) => void;
    error: (message: string, title?: string, duration?: number) => void;
    warning: (message: string, title?: string, duration?: number) => void;
    info: (message: string, title?: string, duration?: number) => void;
  };
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  // Remove a toast by id
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Add toast
  const addToast = useCallback(
    (type: ToastType, message: string, title?: string, duration = 4000) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newToast: ToastItem = { id, type, message, title, duration };

      setToasts((prev) => [...prev.slice(-4), newToast]); // keep max 5 toasts

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const toast = {
    success: useCallback((msg: string, title?: string, dur?: number) => addToast('success', msg, title, dur), [addToast]),
    error: useCallback((msg: string, title?: string, dur?: number) => addToast('error', msg, title, dur), [addToast]),
    warning: useCallback((msg: string, title?: string, dur?: number) => addToast('warning', msg, title, dur), [addToast]),
    info: useCallback((msg: string, title?: string, dur?: number) => addToast('info', msg, title, dur), [addToast])
  };

  // Custom confirmation dialog returning a Promise
  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        options,
        resolve
      });
    });
  }, []);

  const handleConfirmClose = (result: boolean) => {
    if (confirmState) {
      confirmState.resolve(result);
      setConfirmState(null);
    }
  };

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Floating In-App Toast Container */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-3 sm:px-0">
        {toasts.map((t) => {
          let bgClass = 'bg-[#0E1524] border-slate-700 text-slate-100 shadow-xl shadow-black/60';
          let icon = <Info className="w-4 h-4 text-cyan-400 shrink-0" />;
          let accentBar = 'bg-cyan-500';

          if (t.type === 'success') {
            bgClass = 'bg-[#0C1E1A] border-emerald-500/40 text-emerald-50 shadow-xl shadow-emerald-950/40';
            icon = <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
            accentBar = 'bg-emerald-400';
          } else if (t.type === 'error') {
            bgClass = 'bg-[#1E1117] border-rose-500/40 text-rose-50 shadow-xl shadow-rose-950/40';
            icon = <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />;
            accentBar = 'bg-rose-400';
          } else if (t.type === 'warning') {
            bgClass = 'bg-[#1F1A10] border-amber-500/40 text-amber-50 shadow-xl shadow-amber-950/40';
            icon = <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
            accentBar = 'bg-amber-400';
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto relative overflow-hidden rounded-xl border p-3.5 flex items-start gap-3 backdrop-blur-md animate-in slide-in-from-bottom-4 fade-in duration-200 ${bgClass}`}
            >
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentBar}`} />
              <div className="mt-0.5">{icon}</div>
              <div className="flex-1 min-w-0 pr-1">
                {t.title && <div className="text-xs font-bold leading-tight mb-0.5">{t.title}</div>}
                <div className="text-xs text-slate-200 leading-snug break-words">{t.message}</div>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="text-slate-400 hover:text-white p-0.5 rounded-lg hover:bg-white/10 transition shrink-0"
                aria-label="Tutup"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* In-App Custom Confirmation Dialog */}
      {confirmState && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-[#0D121F] border border-slate-700 rounded-2xl shadow-2xl p-5 sm:p-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3.5 mb-4">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  confirmState.options.variant === 'primary'
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                    : confirmState.options.variant === 'warning'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                }`}
              >
                {confirmState.options.variant === 'primary' ? (
                  <HelpCircle className="w-5 h-5" />
                ) : confirmState.options.variant === 'warning' ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <Trash2 className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-white">
                  {confirmState.options.title || 'Konfirmasi Tindakan'}
                </h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  {confirmState.options.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => handleConfirmClose(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                {confirmState.options.cancelText || 'Batal'}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmClose(true)}
                className={`px-4 py-2 rounded-xl text-white text-xs font-bold transition shadow-md ${
                  confirmState.options.variant === 'primary'
                    ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'
                    : confirmState.options.variant === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
                    : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                }`}
              >
                {confirmState.options.confirmText || 'Ya, Lanjutkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
};

export const useFeedback = (): FeedbackContextValue => {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within a FeedbackProvider');
  }
  return context;
};
