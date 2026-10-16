import React, { useState } from 'react';
import {
  ShieldAlert,
  Lock,
  Mail,
  User,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { api } from '../../services/api.js';

interface ForcePasswordChangeModalProps {
  currentUser: { email: string; displayName: string };
  onSuccess: (updatedUser: any) => void;
  onLogout?: () => void;
}

export const ForcePasswordChangeModal: React.FC<ForcePasswordChangeModalProps> = ({
  currentUser,
  onSuccess,
  onLogout
}) => {
  const [email, setEmail] = useState(currentUser.email === 'operator@ai-center.local' ? '' : currentUser.email);
  const [displayName, setDisplayName] = useState(currentUser.displayName || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Email operator wajib diisi.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password baru minimal 8 karakter.');
      return;
    }
    if (newPassword === 'Admin#AiCenter2026!') {
      setError('Password baru tidak boleh sama dengan password default inisialisasi.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await api.updateCredentials({
        newEmail: email.trim(),
        newDisplayName: displayName.trim() || 'Command Operator',
        newPassword
      });
      onSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Gagal memperbarui kredensial.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg rounded-2xl bg-[#0E1522] border border-amber-500/40 shadow-[0_0_60px_-15px_rgba(245,158,11,0.3)] overflow-hidden">
        {/* Top Warning Ribbon */}
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 px-6 py-2.5 text-black font-extrabold text-xs tracking-wider uppercase flex items-center justify-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          <span>Wajib: Pengamanan Kredensial Perdana</span>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 space-y-5">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Tentukan Kredensial Pribadi Anda</h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Anda baru saja masuk menggunakan akun default inisialisasi. Demi mencegah akses tidak sah dari internet publik, Anda wajib menetapkan email dan password pribadi sekarang.
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                <span>Email Pribadi Operator</span>
                <span className="text-[10px] text-cyan-400 font-mono">Digunakan untuk login berikutnya</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama.anda@gmail.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition font-mono"
                />
              </div>
            </div>

            {/* Display Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                Nama Panggilan / Operator Call-Sign
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Commander Alex"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                />
              </div>
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                <span>Password Baru (Min. 8 Karakter)</span>
                <span className="text-[10px] text-slate-400 font-mono">Kuat & Rahasia</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="PasswordBaruKuat#2026!"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition font-mono"
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

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                Ulangi Password Baru
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi password baru Anda"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-extrabold py-3 px-4 shadow-[0_0_25px_rgba(245,158,11,0.4)] focus:outline-none focus:ring-2 focus:ring-amber-400 transition text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                  <span>Menyimpan & Mengunci Kredensial...</span>
                </>
              ) : (
                <>
                  <span>SIMPAN & KUNCI SISTEM PERMANEN</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                disabled={isLoading}
                className="w-full text-xs text-slate-400 hover:text-slate-200 py-1 transition"
              >
                Batalkan & Keluar dari Sesi
              </button>
            )}
          </form>

          <p className="text-[11px] text-slate-500 text-center leading-normal">
            Setelah disimpan, tombol auto-fill pada halaman depan akan hilang selamanya.
          </p>
        </div>
      </div>
    </div>
  );
};
