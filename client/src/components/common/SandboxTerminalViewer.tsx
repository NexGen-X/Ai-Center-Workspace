import React, { useState } from 'react';
import { Terminal, Copy, Check, RotateCw, X, AlertCircle, CheckCircle2, Clock, Code2 } from 'lucide-react';

export interface SandboxExecutionResult {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  language: string;
  executedAt: string;
}

interface SandboxTerminalViewerProps {
  result: SandboxExecutionResult | null;
  loading?: boolean;
  title?: string;
  onClose?: () => void;
  onReRun?: () => void;
  initialCode?: string;
}

export const SandboxTerminalViewer: React.FC<SandboxTerminalViewerProps> = ({
  result,
  loading = false,
  title = 'AI Sandbox Runtime Terminal',
  onClose,
  onReRun,
  initialCode
}) => {
  const [copied, setCopied] = useState(false);
  const [showSourceCode, setShowSourceCode] = useState(false);

  const handleCopy = () => {
    const textToCopy = [
      result?.stdout ? `--- STDOUT ---\n${result.stdout}` : '',
      result?.stderr ? `--- STDERR ---\n${result.stderr}` : ''
    ].filter(Boolean).join('\n\n');

    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-[#09090b] shadow-2xl overflow-hidden font-mono text-xs animate-in fade-in duration-200">
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-zinc-950 border-b border-zinc-800/90 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          {/* Mac/Linux terminal window dots */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block"></span>
          </div>

          <div className="flex items-center gap-1.5 text-zinc-300 font-semibold tracking-tight text-[11px]">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span className="truncate max-w-[200px] sm:max-w-none">{title}</span>
          </div>

          {result?.language && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-zinc-800 text-zinc-300 border border-zinc-700/60 hidden sm:inline-block">
              {result.language}
            </span>
          )}
        </div>

        {/* Status Indicators & Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {loading ? (
            <span className="flex items-center gap-1 text-[10px] text-cyan-400 bg-cyan-950/40 border border-cyan-800/60 px-2 py-0.5 rounded">
              <RotateCw className="w-3 h-3 animate-spin" />
              <span>Mengeksekusi...</span>
            </span>
          ) : result ? (
            <>
              {/* Duration */}
              <span className="flex items-center gap-1 text-[10px] text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                <Clock className="w-3 h-3 text-zinc-500" />
                <span>{result.durationMs}ms</span>
              </span>

              {/* Exit Code */}
              <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-bold uppercase border ${
                result.success
                  ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/70'
                  : 'bg-rose-950/50 text-rose-400 border-rose-800/70'
              }`}>
                {result.success ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                <span>Exit: {result.exitCode}</span>
              </span>
            </>
          ) : null}

          {initialCode && (
            <button
              type="button"
              onClick={() => setShowSourceCode(!showSourceCode)}
              className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded transition"
              title={showSourceCode ? 'Sembunyikan Kode Sumber' : 'Lihat Kode Sumber'}
            >
              <Code2 className="w-3.5 h-3.5" />
            </button>
          )}

          {result && (
            <button
              type="button"
              onClick={handleCopy}
              className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition"
              title="Salin Output Terminal"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          )}

          {onReRun && (
            <button
              type="button"
              onClick={onReRun}
              disabled={loading}
              className="p-1 text-zinc-400 hover:text-cyan-400 hover:bg-zinc-800 rounded transition disabled:opacity-40"
              title="Jalankan Ulang Script"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition ml-1"
              title="Tutup Terminal"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Source Code Drawer (Optional preview of executed script) */}
      {showSourceCode && initialCode && (
        <div className="bg-[#050505] p-3 border-b border-zinc-800/80 text-[11px] text-zinc-300 max-h-40 overflow-y-auto space-y-1">
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Skrip Kode Terisolasi:</div>
          <pre className="whitespace-pre-wrap">{initialCode}</pre>
        </div>
      )}

      {/* Terminal Screen Body */}
      <div className="p-3.5 bg-[#000000] text-zinc-100 max-h-64 sm:max-h-80 overflow-y-auto space-y-2 leading-relaxed selection:bg-cyan-500/30 selection:text-white">
        {/* Command line prompt header */}
        <div className="flex items-center gap-2 text-zinc-500 text-[11px]">
          <span className="text-emerald-400 font-bold">sandbox@id-tech-agent</span>
          <span className="text-zinc-600">:</span>
          <span className="text-cyan-400">~/workspace</span>
          <span className="text-zinc-400">$</span>
          <span className="text-zinc-300">{result?.language || 'run'} script</span>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="text-cyan-400/90 flex items-center gap-2 pt-1 animate-pulse">
            <span>&gt; Mempersiapkan runtime container terisolasi...</span>
            <span className="inline-block w-2 h-4 bg-cyan-400 animate-ping"></span>
          </div>
        )}

        {/* Output streams */}
        {!loading && result && (
          <div className="space-y-2 pt-1">
            {/* STDOUT */}
            {result.stdout && (
              <div className="text-emerald-300/90 whitespace-pre-wrap font-mono">
                {result.stdout}
              </div>
            )}

            {/* STDERR */}
            {result.stderr && (
              <div className="text-rose-400 whitespace-pre-wrap font-mono bg-rose-950/20 border-l-2 border-rose-500/60 pl-2.5 py-1 rounded-r">
                <div className="text-[10px] font-bold uppercase text-rose-500/80 mb-0.5">Runtime Errors / Traceback:</div>
                {result.stderr}
              </div>
            )}

            {/* Empty result */}
            {!result.stdout && !result.stderr && (
              <div className="text-zinc-500 italic">
                (Program selesai dieksekusi dengan kode keluar {result.exitCode} tanpa output teks)
              </div>
            )}
          </div>
        )}

        {/* Bottom prompt line */}
        {!loading && (
          <div className="flex items-center gap-2 text-zinc-600 text-[10px] pt-2 border-t border-zinc-900">
            <span>[Status: {result?.success ? 'Success 200' : 'Failed'}]</span>
            <span>•</span>
            <span>Waktu: {result ? new Date(result.executedAt).toLocaleTimeString('id-ID') : '-'}</span>
          </div>
        )}
      </div>
    </div>
  );
};
