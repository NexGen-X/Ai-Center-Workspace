import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Play,
  RotateCcw,
  CheckCircle2,
  Clock,
  Bot,
  Terminal,
  ShieldCheck,
  Zap,
  Layers,
  FileCode,
  Copy,
  Check,
  Download,
  ArrowRight,
  HelpCircle,
  Activity,
  Cpu,
  Compass
} from 'lucide-react';

interface GuidedTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToFeature?: (feature: string) => void;
}

interface DemoStep {
  agentName: string;
  agentRole: string;
  agentAvatar: string;
  actionTitle: string;
  actionDetails: string;
  codeSnippet?: string;
  tokensUsed: number;
  latencyMs: number;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED';
}

const DEMO_PRESETS = [
  {
    id: 'ecommerce-concurrency',
    title: 'E-Commerce Flash Sale API: Race-Condition & Deadlock Audit',
    category: 'Backend & High-Concurrency',
    description:
      'Simulasi swarm mendeteksi race condition pada stok inventaris saat 10.000 transaksi bersamaan dan mengusulkan perbaikan locking transaksi PostgreSQL.',
    steps: [
      {
        agentName: 'Athena',
        agentRole: 'Lead System Architect',
        agentAvatar: 'AT',
        actionTitle: 'Menganalisis AST Codebase & Pola Locking Transaksi',
        actionDetails:
          'Memindai checkout_service.ts. Ditemukan pembacaan stok tanpa kuncian baris (SELECT tanpa FOR UPDATE) yang rentan overselling.',
        codeSnippet: `// VULNERABLE CODE DETECTED:
const item = await db.query('SELECT stock FROM products WHERE id = $1', [productId]);
if (item.stock >= qty) {
  await db.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [qty, productId]);
}`,
        tokensUsed: 340,
        latencyMs: 145,
        status: 'PENDING' as const
      },
      {
        agentName: 'Vanguard',
        agentRole: 'Senior Code Reviewer',
        agentAvatar: 'VG',
        actionTitle: 'Menyusun Refactoring Pessimistic Locking & Idempotensi',
        actionDetails:
          'Mengganti alur checkout dengan locking atomik PostgreSQL row-level lock dan penanganan rollback otomatis.',
        codeSnippet: `// AUTO-CORRECTED VIA ID-TECH SWARM:
await db.query('BEGIN');
const item = await db.query('SELECT stock FROM products WHERE id = $1 FOR UPDATE', [productId]);
if (item.stock < qty) throw new InsufficientStockError();
await db.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [qty, productId]);
await db.query('COMMIT');`,
        tokensUsed: 420,
        latencyMs: 168,
        status: 'PENDING' as const
      },
      {
        agentName: 'Sentinel',
        agentRole: 'Security & Penetration Auditor',
        agentAvatar: 'SN',
        actionTitle: 'Memverifikasi Sanitasi Input & Parameter Tampering',
        actionDetails:
          'Audit OWASP Top 10 tuntas. Parameter kuantitas diverifikasi integer positif non-zero untuk mencegah manipulasi minus balance.',
        codeSnippet: `// SECURITY RULE VERIFICATION:
const validatedQty = Math.floor(Number(req.body.quantity));
if (isNaN(validatedQty) || validatedQty <= 0) {
  return res.status(400).json({ error: 'INVALID_QUANTITY_PAYLOAD' });
}`,
        tokensUsed: 280,
        latencyMs: 120,
        status: 'PENDING' as const
      },
      {
        agentName: 'Prometheus',
        agentRole: 'Autonomous SRE Agent',
        agentAvatar: 'PR',
        actionTitle: 'Simulasi Benchmark Beban & Rekomendasi Indexing DB',
        actionDetails:
          'Rekomendasi indeks komposit B-Tree pada tabel products(id, stock) untuk menurunkan latensi eksekusi dari 120ms ke 4.2ms.',
        codeSnippet: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_products_id_stock 
ON products(id, stock) WHERE stock > 0;`,
        tokensUsed: 250,
        latencyMs: 110,
        status: 'PENDING' as const
      }
    ]
  },
  {
    id: 'payment-webhook',
    title: 'Fintech Payment Gateway: Signature Verification & Idempotency',
    category: 'Security & Fintech',
    description:
      'Audit otomatis webhook Midtrans/Stripe untuk memastikan pencegahan replay attack dan verifikasi hash SHA512 signature.',
    steps: [
      {
        agentName: 'Sentinel',
        agentRole: 'Security & Penetration Auditor',
        agentAvatar: 'SN',
        actionTitle: 'Audit Validasi Signature Webhook',
        actionDetails:
          'Memeriksa SHA-512 signature kalkulasi pada header x-callback-signature untuk mencegah spoofing transaksi palsu.',
        codeSnippet: `const expectedSignature = crypto
  .createHash('sha512')
  .update(orderId + statusCode + grossAmount + serverKey)
  .digest('hex');
if (signature !== expectedSignature) throw new UnauthorizedError();`,
        tokensUsed: 310,
        latencyMs: 130,
        status: 'PENDING' as const
      },
      {
        agentName: 'Vanguard',
        agentRole: 'Senior Code Reviewer',
        agentAvatar: 'VG',
        actionTitle: 'Penerapan Kunci Idempotensi Mutex di Redis',
        actionDetails:
          'Mencegah eksekusi ganda jika gateway pembayaran mengirimkan 2 kali notifikasi HTTP bersamaan.',
        codeSnippet: `const lockAcquired = await redis.set(\`webhook:lock:\${orderId}\`, '1', 'NX', 'EX', 60);
if (!lockAcquired) return res.status(200).json({ status: 'ALREADY_PROCESSING' });`,
        tokensUsed: 390,
        latencyMs: 155,
        status: 'PENDING' as const
      }
    ]
  }
];

export const GuidedTourModal: React.FC<GuidedTourModalProps> = ({
  isOpen,
  onClose,
  onNavigateToFeature
}) => {
  const [activeTab, setActiveTab] = useState<'simulator' | 'guide'>('simulator');
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const preset = DEMO_PRESETS[selectedPresetIndex];

  // Auto-scroll log container
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Handle simulation run
  useEffect(() => {
    if (!isRunning) return;

    let timer: NodeJS.Timeout;

    if (currentStepIndex < preset.steps.length) {
      const step = preset.steps[currentStepIndex];

      // Add log
      setLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] 🚀 Agen [${step.agentName} - ${step.agentRole}] memulai: ${step.actionTitle}`,
        `[${new Date().toLocaleTimeString()}] ⚡ Inference via Azure OpenAI (GPT-4o) • Latency: ${step.latencyMs}ms • Token: ${step.tokensUsed}`
      ]);

      timer = setTimeout(() => {
        setLogs((prev) => [
          ...prev,
          `[${new Date().toLocaleTimeString()}] ✅ ${step.agentName} berhasil menyelesaikan task.`
        ]);
        setCurrentStepIndex((prev) => prev + 1);
      }, 2200);
    } else {
      setIsRunning(false);
      setLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] 🏆 MISI SWARM SELESAI DENGAN SUKSES! Seluruh kode telah diaudit, diamankan, dan siap dimerge.`
      ]);
    }

    return () => clearTimeout(timer);
  }, [isRunning, currentStepIndex, preset]);

  if (!isOpen) return null;

  const handleStartSimulation = () => {
    setCurrentStepIndex(0);
    setLogs([
      `[${new Date().toLocaleTimeString()}] 🎯 Memulai Misi Simulasi Swarm: "${preset.title}"`,
      `[${new Date().toLocaleTimeString()}] 🧠 Memuat Codebase Memory Graph & Mengorkestrasi ${preset.steps.length} Agen AI...`
    ]);
    setIsRunning(true);
  };

  const handleReset = () => {
    setIsRunning(false);
    setCurrentStepIndex(0);
    setLogs([]);
  };

  const totalTokens = preset.steps
    .slice(0, currentStepIndex)
    .reduce((sum, s) => sum + s.tokensUsed, 0);

  const avgLatency =
    currentStepIndex > 0
      ? Math.round(
          preset.steps.slice(0, currentStepIndex).reduce((sum, s) => sum + s.latencyMs, 0) /
            currentStepIndex
        )
      : 0;

  const progressPercent = Math.round((currentStepIndex / preset.steps.length) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/85 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Box */}
      <div className="relative w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl shadow-2xl shadow-black/90 flex flex-col max-h-[92vh] overflow-hidden z-10">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-500/20">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">Panduan & Simulasi Demo Swarm</h3>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  Interactive Live v2.4
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Saksikan kolaborasi nyata autonomous multi-agent swarm menyelesaikan audit rekayasa software dalam &lt;60 detik
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

        {/* Tab Selector */}
        <div className="px-6 py-2.5 bg-slate-950/40 border-b border-slate-800/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('simulator')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'simulator'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Simulasi Swarm 1-Click</span>
            </button>

            <button
              onClick={() => setActiveTab('guide')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                activeTab === 'guide'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Peta Panduan Fitur Platform</span>
            </button>
          </div>

          {/* Quick Metrics */}
          {activeTab === 'simulator' && (
            <div className="hidden sm:flex items-center gap-4 text-xs font-mono">
              <span className="text-slate-400">
                Tokens: <strong className="text-cyan-400">{totalTokens}</strong>
              </span>
              <span className="text-slate-400">
                Avg Latency: <strong className="text-emerald-400">{avgLatency}ms</strong>
              </span>
              <span className="text-slate-400">
                Engine: <strong className="text-indigo-400">Azure GPT-4o</strong>
              </span>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-7 overflow-y-auto space-y-6 flex-1 text-sm text-slate-300">
          {activeTab === 'simulator' ? (
            <div className="space-y-6">
              {/* Preset Selector & Action Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-950/70 border border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wide">
                      {preset.category}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="text-xs text-slate-400">
                      {preset.steps.length} Langkah Agen AI
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-white">{preset.title}</h4>
                  <p className="text-xs text-slate-400 max-w-2xl">{preset.description}</p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto">
                  {!isRunning && currentStepIndex === 0 && (
                    <button
                      onClick={handleStartSimulation}
                      className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-xs shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      <span>Jalankan Simulasi Demo</span>
                    </button>
                  )}

                  {isRunning && (
                    <div className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold flex items-center justify-center gap-2 animate-pulse">
                      <Activity className="w-4 h-4 animate-spin" />
                      <span>Swarm Sedang Bekerja ({progressPercent}%)...</span>
                    </div>
                  )}

                  {(currentStepIndex > 0 || isRunning) && (
                    <button
                      onClick={handleReset}
                      className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition flex items-center gap-1.5"
                      title="Reset Simulasi"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Ulang</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>Progres Orkestrasi Swarm</span>
                  <span className="text-white font-bold">{progressPercent}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Agent Timeline Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {preset.steps.map((step, idx) => {
                  const isDone = idx < currentStepIndex;
                  const isCurrent = idx === currentStepIndex && isRunning;
                  const isWaiting = idx > currentStepIndex || (idx === currentStepIndex && !isRunning && currentStepIndex === 0);

                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-2xl border transition-all duration-300 ${
                        isDone
                          ? 'bg-slate-950/80 border-emerald-500/30 shadow-md shadow-emerald-500/5'
                          : isCurrent
                          ? 'bg-slate-950 border-cyan-500/60 shadow-lg shadow-cyan-500/15 ring-1 ring-cyan-500/40'
                          : 'bg-slate-950/40 border-slate-800/80 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-mono ${
                              isDone
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : isCurrent
                                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 animate-pulse'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {step.agentAvatar}
                          </div>
                          <div>
                            <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                              <span>{step.agentName}</span>
                              <span className="text-[10px] text-slate-400 font-normal">
                                • {step.agentRole}
                              </span>
                            </h5>
                          </div>
                        </div>

                        <div>
                          {isDone && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Selesai</span>
                            </span>
                          )}
                          {isCurrent && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-400 animate-pulse">
                              <Activity className="w-3.5 h-3.5 animate-spin" />
                              <span>Memproses...</span>
                            </span>
                          )}
                          {isWaiting && (
                            <span className="text-[11px] text-slate-500 font-mono">Menunggu</span>
                          )}
                        </div>
                      </div>

                      <p className="text-xs font-semibold text-slate-200 mb-1">{step.actionTitle}</p>
                      <p className="text-xs text-slate-400 leading-relaxed mb-2.5">{step.actionDetails}</p>

                      {step.codeSnippet && (isDone || isCurrent) && (
                        <div className="rounded-xl bg-slate-900 border border-slate-800 p-2.5 font-mono text-[11px] text-cyan-300 overflow-x-auto leading-relaxed">
                          <pre>{step.codeSnippet}</pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Real-time Streaming Terminal */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-cyan-400" />
                    <span className="font-mono font-bold text-white">Live Telemetry & Execution Log</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">
                    Realtime Event Stream (SSE)
                  </span>
                </div>

                <div
                  ref={logContainerRef}
                  className="p-3.5 rounded-2xl bg-black/90 border border-slate-800 font-mono text-[11px] text-slate-300 h-44 overflow-y-auto space-y-1 leading-relaxed shadow-inner"
                >
                  {logs.length === 0 ? (
                    <p className="text-slate-600 italic">
                      Klik "Jalankan Simulasi Demo" di atas untuk melihat log orkestrasi real-time.
                    </p>
                  ) : (
                    logs.map((log, idx) => (
                      <p
                        key={idx}
                        className={
                          log.includes('🚀')
                            ? 'text-cyan-400 font-semibold'
                            : log.includes('✅')
                            ? 'text-emerald-400'
                            : log.includes('🏆')
                            ? 'text-amber-300 font-bold'
                            : 'text-slate-300'
                        }
                      >
                        {log}
                      </p>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* TAB 2: PLATFORM FEATURE GUIDE */
            <div className="space-y-6">
              <div className="text-center max-w-2xl mx-auto space-y-2">
                <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest">
                  Navigasi & Kemampuan Inti AI Center
                </span>
                <h4 className="text-xl font-black text-white">
                  Semua yang Dibutuhkan untuk Rekayasa Software Otomatis
                </h4>
                <p className="text-xs text-slate-400">
                  Setiap fitur dirancang khusus untuk tim enterprise agar dapat mendelegasikan tugas
                  teknis yang repetitif secara aman.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2.5">
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 w-fit border border-blue-500/20">
                    <Bot className="w-5 h-5" />
                  </div>
                  <h5 className="text-sm font-bold text-white">Multi-Agent Swarm</h5>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Orkestrasi dinamis berbasis Directed Acyclic Graph (DAG) di mana agen AI berdiskusi
                    dan mereview hasil kerja satu sama lain secara otonom.
                  </p>
                  {onNavigateToFeature && (
                    <button
                      onClick={() => {
                        onClose();
                        onNavigateToFeature('swarm');
                      }}
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 pt-1"
                    >
                      <span>Buka Swarm Misi</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2.5">
                  <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 w-fit border border-rose-500/20">
                    <Activity className="w-5 h-5" />
                  </div>
                  <h5 className="text-sm font-bold text-white">Realtime War Room</h5>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Pusat komando insiden produksi langsung. Agen SRE mendiagnosis anomali database,
                    lonjakan error HTTP 500, dan latency bottleneck secara otomatis.
                  </p>
                  {onNavigateToFeature && (
                    <button
                      onClick={() => {
                        onClose();
                        onNavigateToFeature('warroom');
                      }}
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 pt-1"
                    >
                      <span>Buka War Room</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2.5">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 w-fit border border-indigo-500/20">
                    <Layers className="w-5 h-5" />
                  </div>
                  <h5 className="text-sm font-bold text-white">Codebase Memory Graph</h5>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Indeks semantik berbasis Tree-sitter AST yang memetakan hubungan fungsi, kelas,
                    dan type definition lintas repositori sehingga agen tidak pernah halusinasi.
                  </p>
                  {onNavigateToFeature && (
                    <button
                      onClick={() => {
                        onClose();
                        onNavigateToFeature('memory');
                      }}
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 pt-1"
                    >
                      <span>Buka Memory Graph</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 w-fit border border-emerald-500/20">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <h5 className="text-sm font-bold text-white">Action Risk Gate (Human-in-Loop)</h5>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Mekanisme verifikasi keamanan di mana aksi destruktif (seperti drop table atau deploy prod)
                    memerlukan persetujuan bertanda tangan digital dari Lead Engineer.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 w-fit border border-amber-500/20">
                    <Zap className="w-5 h-5" />
                  </div>
                  <h5 className="text-sm font-bold text-white">Pipeline DAG Designer</h5>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Rancang alur kerja rekayasa bertingkat secara visual dengan logika kondisi,
                    percabangan paralel, dan failover model cerdas.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2.5">
                  <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 w-fit border border-cyan-500/20">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <h5 className="text-sm font-bold text-white">Three.js 3D Virtual Twin</h5>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Visualisasi spasial 3D interaktif yang menggambarkan beban kerja agen AI dan koneksi
                    telemetri server dalam tampilan futuristik.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>ID-Tech Autonomous Swarm Core • Ready for Production & Benchmarks</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors"
            >
              Tutup Panduan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
