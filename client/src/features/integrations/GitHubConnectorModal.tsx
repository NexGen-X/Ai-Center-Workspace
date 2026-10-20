import React, { useState } from 'react';
import {
  X,
  GitPullRequest,
  Check,
  Copy,
  ExternalLink,
  ShieldCheck,
  Zap,
  Play,
  RotateCw,
  Sliders,
  CheckCircle2,
  AlertCircle,
  GitBranch,
  Terminal
} from 'lucide-react';
import { api } from '../../services/api.js';

interface GitHubConnectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTestTriggered?: () => void;
}

export const GitHubConnectorModal: React.FC<GitHubConnectorModalProps> = ({
  isOpen,
  onClose,
  onTestTriggered
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Settings
  const [autoReview, setAutoReview] = useState(true);
  const [securityScan, setSecurityScan] = useState(true);
  const [inlineSuggestions, setInlineSuggestions] = useState(true);
  const [blockOnCritical, setBlockOnCritical] = useState(false);

  if (!isOpen) return null;

  const webhookUrl = `${window.location.origin}/api/webhooks/github`;
  const webhookSecret = 'idtech_whsec_7f9a2b8e3c1d4a0f8e';

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(webhookSecret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const handleTestWebhook = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/webhooks/test-github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        setTestResult(data.message);
        if (onTestTriggered) onTestTriggered();
      } else {
        setTestResult(`Gagal: ${data.error || 'Server menolak'}`);
      }
    } catch (err: any) {
      setTestResult(`Error: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/85 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Box */}
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl shadow-2xl shadow-black/90 flex flex-col max-h-[92vh] overflow-hidden z-10">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/20">
              <GitPullRequest className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">GitHub & GitLab PR Bot Connector</h3>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  CI/CD Swarm Bot
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Otomatiskan review pull-request dan pemindaian keamanan repositori langsung dari alur kerja git tim Anda
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-7 overflow-y-auto space-y-6 flex-1 text-sm text-slate-300">
          {/* Step 1: Webhook URL Configuration */}
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">1</span>
                  <span>Konfigurasi Webhook Repositori (GitHub / GitLab)</span>
                </h4>
                <p className="text-xs text-slate-400">
                  Buka <strong>Repository Settings → Webhooks → Add Webhook</strong> di GitHub atau GitLab Anda.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              {/* Payload URL */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">Payload URL</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={webhookUrl}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-cyan-400 font-mono text-xs focus:outline-none"
                  />
                  <button
                    onClick={handleCopyUrl}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shrink-0"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUrl ? 'Tersalin' : 'Salin URL'}</span>
                  </button>
                </div>
              </div>

              {/* Secret Key & Content Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Content Type</label>
                  <input
                    type="text"
                    readOnly
                    value="application/json"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-mono text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">Secret Token</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={webhookSecret}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 font-mono text-xs"
                    />
                    <button
                      onClick={handleCopySecret}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition shrink-0"
                    >
                      {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2: PR Audit Rules */}
          <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">2</span>
              <span>Kebijakan Audit & Otonomi Swarm Bot</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <label className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3 cursor-pointer hover:border-slate-700 transition">
                <input
                  type="checkbox"
                  checked={autoReview}
                  onChange={(e) => setAutoReview(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-0"
                />
                <div>
                  <span className="font-bold text-white block">Auto-Review Code Diff</span>
                  <span className="text-slate-400 text-[11px] block mt-0.5">
                    Agen Coder menganalisis perubahan kode untuk bug logika, anti-pattern, dan race-condition.
                  </span>
                </div>
              </label>

              <label className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3 cursor-pointer hover:border-slate-700 transition">
                <input
                  type="checkbox"
                  checked={securityScan}
                  onChange={(e) => setSecurityScan(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-0"
                />
                <div>
                  <span className="font-bold text-white block">Pemindaian Kerentanan OWASP</span>
                  <span className="text-slate-400 text-[11px] block mt-0.5">
                    Deteksi otomatis SQL injection, XSS, sanitasi input, dan kebocoran credential token.
                  </span>
                </div>
              </label>

              <label className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3 cursor-pointer hover:border-slate-700 transition">
                <input
                  type="checkbox"
                  checked={inlineSuggestions}
                  onChange={(e) => setInlineSuggestions(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-0"
                />
                <div>
                  <span className="font-bold text-white block">Komentar Refactoring In-Line</span>
                  <span className="text-slate-400 text-[11px] block mt-0.5">
                    Memberikan usulan perbaikan baris kode langsung pada komentar Pull Request GitHub.
                  </span>
                </div>
              </label>

              <label className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3 cursor-pointer hover:border-slate-700 transition">
                <input
                  type="checkbox"
                  checked={blockOnCritical}
                  onChange={(e) => setBlockOnCritical(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-0"
                />
                <div>
                  <span className="font-bold text-rose-400 block">Blokir Merge saat Temuan Kritis (P1)</span>
                  <span className="text-slate-400 text-[11px] block mt-0.5">
                    Set commit status GitHub ke FAILED jika terdeteksi kebocoran API key atau celah RCE.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Step 3: Test Webhook Simulation */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-slate-950/70 border border-blue-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <h4 className="text-sm font-bold text-white flex items-center justify-center sm:justify-start gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                <span>Uji Konektivitas Webhook (Simulasi PR #42)</span>
              </h4>
              <p className="text-xs text-slate-400">
                Kirim payload tiruan event Pull Request untuk memverifikasi kesiapan antrean orkestrasi task.
              </p>
            </div>

            <button
              onClick={handleTestWebhook}
              disabled={testing}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/25 flex items-center gap-2 transition shrink-0 disabled:opacity-50"
            >
              {testing ? <RotateCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
              <span>{testing ? 'Mengirim Uji Coba...' : 'Kirim Uji Coba Webhook'}</span>
            </button>
          </div>

          {testResult && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{testResult}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div>
            <span>Kompatibel dengan GitHub Enterprise, GitHub Cloud, dan GitLab Self-Hosted</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors"
            >
              Tutup Connector
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
