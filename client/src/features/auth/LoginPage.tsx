import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Lock,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  Sparkles,
  Cpu,
  ArrowRight,
  Terminal,
  CheckCircle2,
  Info,
  Crown
} from 'lucide-react';
import { api } from '../../services/api.js';

interface LoginPageProps {
  onLoginSuccess: (user: any) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupHint, setSetupHint] = useState<{ available?: boolean; defaultEmail?: string; hint?: string } | null>(null);

  useEffect(() => {
    api.getSetupHint()
      .then((res) => {
        if (res.available) {
          setSetupHint(res);
        } else {
          setSetupHint(null);
        }
      })
      .catch(() => {
        setSetupHint(null);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Harap masukkan email dan password operator.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await api.login(email.trim(), password);
      localStorage.setItem('ai_center_token', res.token);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Otentikasi gagal. Periksa kembali email dan password Anda.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseDefaultCredentials = () => {
    setEmail(setupHint?.defaultEmail || 'operator@ai-center.local');
    setPassword('Admin#AiCenter2026!');
    setError(null);
  };

  const isFounderPortal = typeof window !== 'undefined' && (
    window.location.hostname.toLowerCase().startsWith('founder.') ||
    window.location.hostname.toLowerCase().startsWith('admin.') ||
    new URLSearchParams(window.location.search).get('mode') === 'founder'
  );

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 bg-[#070A0F] text-slate-100 overflow-hidden font-sans select-none">
      {/* Background Cyber Grid & Ambient Glowing Orbs */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />
      <div className={`absolute top-1/4 -left-32 w-96 h-96 ${isFounderPortal ? 'bg-amber-500/15' : 'bg-cyan-500/10'} rounded-full blur-[128px] pointer-events-none`} />
      <div className={`absolute bottom-1/4 -right-32 w-96 h-96 ${isFounderPortal ? 'bg-orange-500/15' : 'bg-purple-500/10'} rounded-full blur-[128px] pointer-events-none`} />

      {/* Main Login Card */}
      <div className="relative z-10 w-full max-w-md">
        {/* Holographic Header Badge */}
        <div className="flex flex-col items-center mb-8 text-center space-y-3">
          <div className={`relative flex items-center justify-center w-16 h-16 rounded-2xl ${
            isFounderPortal
              ? 'bg-gradient-to-tr from-amber-500/25 via-yellow-500/20 to-orange-500/25 border border-amber-500/40 shadow-[0_0_30px_rgba(245,158,11,0.3)]'
              : 'bg-gradient-to-tr from-cyan-500/20 via-blue-500/10 to-purple-500/20 border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.3)]'
          } backdrop-blur-md`}>
            {isFounderPortal ? (
              <Crown className="w-8 h-8 text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
            ) : (
              <ShieldCheck className="w-8 h-8 text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
            )}
            <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full ${isFounderPortal ? 'bg-amber-400' : 'bg-emerald-400'} ring-4 ring-[#070A0F] animate-pulse`} />
          </div>

          <div>
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${
              isFounderPortal
                ? 'bg-amber-950/50 border border-amber-500/40 text-[10px] font-mono tracking-widest uppercase text-amber-300'
                : 'bg-cyan-950/40 border border-cyan-500/30 text-[10px] font-mono tracking-widest uppercase text-cyan-300'
            } mb-2`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isFounderPortal ? 'bg-amber-400' : 'bg-cyan-400'} animate-ping`} />
              {isFounderPortal ? 'Founder Security Clearance Level 5' : 'Security Clearance Level 4 Required'}
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
              <span>{isFounderPortal ? 'Founder & CEO Executive Suite' : 'AI Agent Command Center'}</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              {isFounderPortal
                ? 'Portal Masuk Khusus Pemilik Startup PT NexGen Digital Nusantara'
                : 'Autonomous Swarm OS & 3D Spatial Holographic Orchestration Bridge'}
            </p>
          </div>
        </div>

        {/* Form Container */}
        <div className={`relative rounded-2xl bg-[#0E1522]/90 border ${
          isFounderPortal ? 'border-amber-500/30 shadow-[0_0_50px_-10px_rgba(245,158,11,0.2)]' : 'border-slate-800/80 shadow-[0_0_50px_-10px_rgba(6,182,212,0.15)]'
        } backdrop-blur-xl p-6 sm:p-8`}>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Header info inside card */}
            <div className="border-b border-slate-800/80 pb-4">
              <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                {isFounderPortal ? (
                  <>
                    <Crown className="w-4 h-4 text-amber-400" />
                    <span>Founder Credential Clearance</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 text-cyan-400" />
                    <span>Operator Authentication</span>
                  </>
                )}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isFounderPortal
                  ? 'Masukkan kredensial akun pemilik untuk membuka panel metrik finansial dan tata kelola platform.'
                  : 'Masukkan kredensial operator untuk mendekripsi antarmuka dan kontrol swarm.'}
              </p>
            </div>

            {/* Error Message Alert */}
            {error && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2.5 animate-in fade-in zoom-in-95 duration-200">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                <span>Email Operator / ID</span>
                <span className="text-[10px] font-mono text-slate-500">SEC-ID</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  autoFocus
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@ai-center.local"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all font-mono"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                <span>Cryptographic Key / Password</span>
                <span className="text-[10px] font-mono text-slate-500">E2EE-KEY</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Quick Default Credentials Card (Ephemeral: only on uninitialized system) */}
            {setupHint?.available && (
              <div className="p-3 rounded-xl bg-slate-900/60 border border-cyan-500/20 text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="flex items-center gap-1.5 font-medium text-[11px] text-cyan-400">
                    <Info className="w-3.5 h-3.5" />
                    Inisialisasi Pertama (Ephemeral)
                  </span>
                  <button
                    type="button"
                    onClick={handleUseDefaultCredentials}
                    className="px-2 py-0.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-[10px] font-semibold border border-cyan-500/30 transition flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    Auto-Fill 1x
                  </button>
                </div>
                <div className="font-mono text-[11px] text-slate-400 bg-black/40 px-2 py-1.5 rounded-lg border border-slate-800/60 flex flex-col gap-0.5">
                  <div><span className="text-slate-500">Email:</span> {setupHint.defaultEmail || 'operator@ai-center.local'}</div>
                  <div><span className="text-slate-500">Pass :</span> Admin#AiCenter2026!</div>
                </div>
                <p className="text-[10px] text-amber-400/90 italic">
                  *Kredensial awal ini wajib diperbarui setelah masuk & tombol ini akan hilang permanen.
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full relative group overflow-hidden rounded-xl ${
                isFounderPortal
                  ? 'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold shadow-[0_0_25px_rgba(245,158,11,0.5)]'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)]'
              } py-3 px-4 focus:outline-none transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none text-sm flex items-center justify-center gap-2`}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  <span>Memverifikasi Otorisasi Founder...</span>
                </>
              ) : (
                <>
                  <span>{isFounderPortal ? 'AUTHORIZE & ENTER FOUNDER SUITE' : 'AUTHORIZE & ENTER COMMAND BRIDGE'}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Footer Security Badge */}
          <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-500">
            <span className="flex items-center gap-1">
              <Cpu className="w-3 h-3 text-cyan-500" />
              AES-256 ZERO-TRUST
            </span>
            <span className="flex items-center gap-1">
              <Terminal className="w-3 h-3 text-emerald-500" />
              SESSION ENCRYPTED
            </span>
          </div>
        </div>

        {/* Version info */}
        <div className="text-center mt-6 text-[11px] font-mono text-slate-600">
          AI Agent Command Center • Production v1.0.1
        </div>
      </div>
    </div>
  );
};
