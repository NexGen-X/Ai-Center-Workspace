import React, { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Trash2,
  ArrowRight,
  Lock,
  Cloud,
  Server,
  Info,
  Radio,
  Sparkles
} from 'lucide-react';
import { api } from '../../services/api.js';
import { useFeedback } from '../../components/common/FeedbackContext.js';
import {
  DomainManagerInfoResponse,
  CheckDomainDnsResponse,
  CustomDomain
} from '../../../../shared/types.js';

interface DomainSettingsTabProps {
  workspaceId?: string;
}

export const DomainSettingsTab: React.FC<DomainSettingsTabProps> = ({
  workspaceId = 'ws-default-command-center'
}) => {
  const { toast, confirm } = useFeedback();

  const [info, setInfo] = useState<DomainManagerInfoResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [domainInput, setDomainInput] = useState('');
  const [checkingDns, setCheckingDns] = useState(false);
  const [dnsResult, setDnsResult] = useState<CheckDomainDnsResponse | null>(null);
  const [provisioning, setProvisioning] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [copiedIp, setCopiedIp] = useState(false);

  // Fetch current domain status
  const loadDomainInfo = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getDomainInfo(workspaceId);
      setInfo(res);
    } catch (err: any) {
      toast.error(err?.message || 'Gagal mengambil informasi domain');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, toast]);

  useEffect(() => {
    loadDomainInfo();
  }, [loadDomainInfo]);

  // Copy IP Helper
  const handleCopyIp = (ip: string) => {
    navigator.clipboard.writeText(ip);
    setCopiedIp(true);
    toast.success(`IP Server ${ip} disalin ke clipboard.`);
    setTimeout(() => setCopiedIp(false), 2500);
  };

  // Test DNS
  const handleCheckDns = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = domainInput.trim().toLowerCase().replace(/^https?:\/\//, '');
    if (!clean) {
      toast.warning('Masukkan nama domain terlebih dahulu.');
      return;
    }

    try {
      setCheckingDns(true);
      setDnsResult(null);
      const res = await api.checkDomainDns(clean);
      setDnsResult(res);

      if (res.isMatch) {
        toast.success(res.message);
      } else {
        toast.warning(res.message);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Gagal memeriksa DNS domain');
    } finally {
      setCheckingDns(false);
    }
  };

  // Provision domain
  const handleProvision = async () => {
    const clean = domainInput.trim().toLowerCase().replace(/^https?:\/\//, '');
    if (!clean) {
      toast.warning('Masukkan nama domain terlebih dahulu.');
      return;
    }

    try {
      setProvisioning(true);
      const res = await api.provisionDomain(clean, workspaceId);
      toast.success(res.message);
      setDomainInput('');
      setDnsResult(null);
      await loadDomainInfo();
    } catch (err: any) {
      toast.error(err?.message || 'Gagal mengonfigurasi domain dan SSL');
    } finally {
      setProvisioning(false);
    }
  };

  // Remove domain
  const handleRemoveDomain = async (domain: CustomDomain) => {
    const confirmed = await confirm({
      title: 'Hapus Custom Domain?',
      message: `Apakah Anda yakin ingin melepas domain "${domain.domainName}"? Sistem akan dikembalikan menggunakan IP publik default.`,
      confirmText: 'Lepas Domain',
      cancelText: 'Batal',
      variant: 'danger'
    });

    if (!confirmed) return;

    try {
      setRemovingId(domain.id);
      const res = await api.removeDomain(domain.id, workspaceId);
      toast.success(res.message);
      await loadDomainInfo();
    } catch (err: any) {
      toast.error(err?.message || 'Gagal menghapus domain');
    } finally {
      setRemovingId(null);
    }
  };

  const serverIp = info?.serverPublicIp || '13.212.164.108';

  return (
    <div className="space-y-6 text-slate-200">
      {/* Header Info Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-gradient-to-r from-cyan-950/40 via-slate-900 to-indigo-950/40 border border-cyan-800/40 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400 shrink-0">
            <Globe className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-wide">
                Pengaturan Domain & SSL Otomatis
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full">
                Auto-HTTPS Ready
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Hubungkan domain kustom dari <strong>Hostinger</strong>, <strong>Cloudflare</strong>, atau penyedia DNS mana pun.
              Sertifikat SSL/TLS diurus secara otomatis tanpa perlu setup certbot manual.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadDomainInfo}
          disabled={loading}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-700 transition shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* Cloudflare + Hostinger Integration Guide */}
      <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
        <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider">
          <Cloud className="w-4 h-4" />
          <span>Petunjuk Integrasi DNS (Hostinger &amp; Cloudflare)</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          {/* Step 1 */}
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1.5">
            <div className="flex items-center gap-2 text-slate-300 font-semibold">
              <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 text-center leading-5 text-[11px] font-bold">1</span>
              <span>Buat DNS A Record</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Di dashboard <strong>Cloudflare</strong> atau <strong>Hostinger</strong>, tambahkan record baru:
            </p>
            <div className="bg-slate-900 p-2 rounded text-[11px] font-mono border border-slate-800 space-y-0.5 text-slate-300">
              <div>Type: <strong className="text-cyan-400">A</strong></div>
              <div>Name: <strong className="text-amber-400">@</strong> atau <strong className="text-amber-400">ai</strong></div>
              <div>Target: <strong className="text-emerald-400">{serverIp}</strong></div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1.5">
            <div className="flex items-center gap-2 text-slate-300 font-semibold">
              <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 text-center leading-5 text-[11px] font-bold">2</span>
              <span>Pilih Mode Cloudflare</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Keduanya didukung 100%:
            </p>
            <ul className="list-disc list-inside text-[11px] text-slate-400 space-y-1">
              <li><strong className="text-amber-300">Proxied (Orange Cloud)</strong>: Dilindungi CDN &amp; WAF Cloudflare.</li>
              <li><strong className="text-slate-300">DNS Only (Gray Cloud)</strong>: SSL Let&apos;s Encrypt langsung diurus server.</li>
            </ul>
          </div>

          {/* Step 3 */}
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-1.5">
            <div className="flex items-center gap-2 text-slate-300 font-semibold">
              <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 text-center leading-5 text-[11px] font-bold">3</span>
              <span>Ketik &amp; Aktifkan di UI</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Ketik nama domain di form bawah, klik <strong>Cek DNS</strong>, lalu klik <strong>Pasang &amp; Aktifkan HTTPS</strong>.
            </p>
            <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-semibold pt-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Otomatis aktif dalam hitungan detik!</span>
            </div>
          </div>
        </div>
      </div>

      {/* Server IP Card */}
      <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex items-center gap-3">
          <Server className="w-5 h-5 text-indigo-400 shrink-0" />
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              IP Publik Server Tujuan (A Record Target)
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono font-bold text-white text-sm sm:text-base tracking-wide">
                {serverIp}
              </span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Port 80 &amp; 443
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleCopyIp(serverIp)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
        >
          {copiedIp ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Tersalin!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-cyan-400" />
              <span>Salin IP</span>
            </>
          )}
        </button>
      </div>

      {/* Active Domains List */}
      {info && info.domains.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Domain Terpasang &amp; Berfungsi ({info.domains.length})</span>
            </h4>
          </div>

          <div className="space-y-2">
            {info.domains.map(dom => (
              <div
                key={dom.id}
                className="p-4 rounded-xl bg-slate-900 border border-emerald-500/30 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shrink-0">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <a
                        href={`https://${dom.domainName}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-base font-bold text-white hover:text-cyan-300 transition flex items-center gap-1.5"
                      >
                        <span>https://{dom.domainName}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                      </a>
                      <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" />
                        SSL Aktif
                      </span>
                      {dom.dnsMode === 'CLOUDFLARE_PROXY' && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-full flex items-center gap-1">
                          <Cloud className="w-2.5 h-2.5" />
                          Cloudflare Proxy
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Target IP: <strong className="text-slate-300">{dom.targetIp}</strong> • Terdeteksi IP: <strong className="text-slate-300">{dom.detectedIp || serverIp}</strong> • Status: <strong className="text-emerald-400">{dom.status}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <a
                    href={`https://${dom.domainName}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition flex items-center gap-1"
                  >
                    <span>Buka Situs</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleRemoveDomain(dom)}
                    disabled={removingId === dom.id}
                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition"
                    title="Lepas Domain"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Setup / Add New Domain Form */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <div>
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Pasang Domain Baru / Ganti Domain</span>
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Masukkan domain atau subdomain yang sudah Anda arahkan ke IP server di Cloudflare / Hostinger.
          </p>
        </div>

        <form onSubmit={handleCheckDns} className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Globe className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="contoh: ai.domainanda.com atau command.center.id"
                value={domainInput}
                onChange={e => {
                  setDomainInput(e.target.value);
                  setDnsResult(null);
                }}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2.5 text-white text-xs sm:text-sm focus:outline-none focus:border-cyan-500 transition placeholder:text-slate-600"
              />
            </div>
            <button
              type="submit"
              disabled={checkingDns || !domainInput.trim()}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingDns ? 'animate-spin text-cyan-400' : ''}`} />
              <span>{checkingDns ? 'Memeriksa DNS...' : 'Cek DNS'}</span>
            </button>
          </div>
        </form>

        {/* DNS Pre-flight Result Box */}
        {dnsResult && (
          <div
            className={`p-4 rounded-xl border text-xs space-y-2 animate-fadeIn ${
              dnsResult.isMatch
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                : 'bg-amber-950/30 border-amber-500/40 text-amber-200'
            }`}
          >
            <div className="flex items-center gap-2 font-bold">
              {dnsResult.isMatch ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300">DNS Terhubung Sempurna!</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <span className="text-amber-300">Perhatian DNS</span>
                </>
              )}
            </div>

            <p className="leading-relaxed">{dnsResult.message}</p>

            <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] opacity-90">
              <div>Domain: <strong className="text-white">{dnsResult.domainName}</strong></div>
              <div>IP Terdeteksi: <strong className="text-white font-mono">{dnsResult.detectedIps.join(', ') || 'Belum ada'}</strong></div>
              <div>Mode: <strong className="text-white">{dnsResult.dnsMode}</strong></div>
            </div>

            {/* Action to Apply */}
            {dnsResult.isMatch && (
              <div className="pt-2 border-t border-emerald-500/20 flex justify-end">
                <button
                  type="button"
                  onClick={handleProvision}
                  disabled={provisioning}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-900/40 transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{provisioning ? 'Mengonfigurasi Caddy & SSL...' : 'Pasang & Aktifkan HTTPS Sekarang'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
