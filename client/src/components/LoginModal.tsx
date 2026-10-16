import React, { useState, useEffect } from 'react';
import { X, Lock, Key, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { api } from '../services/api.js';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: any) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupHint, setSetupHint] = useState<{ defaultEmail?: string; hint?: string; available?: boolean } | null>(null);

  useEffect(() => {
    if (isOpen) {
      api.getSetupHint().then((res) => {
        if (res && res.available) {
          setSetupHint(res);
        } else {
          setSetupHint(null);
        }
      }).catch(() => setSetupHint(null));
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await api.login(email.trim(), password);
      localStorage.setItem('ai_center_token', res.token);
      onLoginSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Login gagal.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseHint = () => {
    if (setupHint && setupHint.defaultEmail) {
      setEmail(setupHint.defaultEmail);
      setPassword('Admin#AiCenter2026!');
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0B0F17]/60">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white">Login Operator AI Command Center</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup form login"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {setupHint && (
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  <span>Kredensial Default Awal</span>
                </span>
                <button
                  type="button"
                  onClick={handleUseHint}
                  className="text-[10px] bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 px-2 py-0.5 rounded border border-blue-500/30"
                >
                  Isi Otomatis
                </button>
              </div>
              <p className="text-[11px] text-blue-200/80 font-mono">
                {setupHint.defaultEmail} • {setupHint.hint}
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Email Operator</label>
            <input
              type="email"
              required
              placeholder="operator@ai-center.local"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
            <input
              type="password"
              required
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 text-xs font-semibold text-slate-300 hover:bg-slate-700"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold transition shadow-lg shadow-blue-600/25 disabled:opacity-50"
            >
              {isLoading ? 'Masuk...' : 'Masuk ke Command Center'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
