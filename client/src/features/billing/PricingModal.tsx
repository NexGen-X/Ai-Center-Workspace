import React, { useState, useEffect } from 'react';
import {
  X,
  Check,
  Zap,
  ShieldCheck,
  Sparkles,
  Layers,
  ArrowRight,
  CreditCard,
  FileText,
  Clock,
  TrendingUp,
  Building2,
  ChevronRight,
  HelpCircle,
  AlertCircle,
  QrCode,
  Wallet,
  Lock,
  CheckCircle2,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import {
  WorkspacePlan,
  WorkspacePlanDetails,
  WorkspaceUsageStats,
  WorkspaceInvoice
} from '../../../../shared/types.js';
import { api } from '../../services/api.js';
import { useFeedback } from '../../components/common/FeedbackContext.js';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlanUpgraded?: () => void;
}

function loadMidtransSnap(clientKey: string, isProduction: boolean): Promise<void> {
  return new Promise((resolve) => {
    if ((window as any).snap && typeof (window as any).snap.pay === 'function') {
      resolve();
      return;
    }
    const scriptId = 'midtrans-snap-script';
    const existing = document.getElementById(scriptId);
    if (existing) {
      existing.remove();
    }
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = isProduction
      ? 'https://app.midtrans.com/snap/snap.js'
      : 'https://app.sandbox.midtrans.com/snap/snap.js';
    script.setAttribute('data-client-key', clientKey);
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

export const PricingModal: React.FC<PricingModalProps> = ({
  isOpen,
  onClose,
  onPlanUpgraded
}) => {
  const { toast } = useFeedback();
  const [plans, setPlans] = useState<WorkspacePlanDetails[]>([]);
  const [usage, setUsage] = useState<WorkspaceUsageStats | null>(null);
  const [invoices, setInvoices] = useState<WorkspaceInvoice[]>([]);
  const [billingInterval, setBillingInterval] = useState<'MONTHLY' | 'ANNUALLY'>('MONTHLY');
  const [activeTab, setActiveTab] = useState<'plans' | 'invoices'>('plans');
  const [loading, setLoading] = useState(false);
  const [upgradingPlan, setUpgradingPlan] = useState<WorkspacePlan | null>(null);
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<WorkspacePlanDetails | null>(null);
  const [lastCheckoutToken, setLastCheckoutToken] = useState<string | null>(null);

  const loadBillingData = async () => {
    try {
      setLoading(true);
      const [plansData, usageData, invData] = await Promise.all([
        api.getBillingPlans().catch(() => []),
        api.getBillingUsage().catch(() => null),
        api.getInvoices().catch(() => [])
      ]);
      setPlans(plansData);
      setUsage(usageData);
      setInvoices(invData);
    } catch (err: any) {
      toast.error(err.message || 'Gagal memuat data paket langganan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadBillingData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleUpgrade = async (targetPlan: WorkspacePlan) => {
    try {
      setUpgradingPlan(targetPlan);
      toast.info('Menyiapkan pembayaran Midtrans...');

      const checkout = await api.createBillingCheckout(targetPlan, billingInterval);
      setLastCheckoutToken(checkout.snapToken);

      await loadMidtransSnap(checkout.clientKey, checkout.isProduction);

      // Close pre-checkout sheet so Snap popup is centered cleanly
      setSelectedPlanForCheckout(null);

      if ((window as any).snap && typeof (window as any).snap.pay === 'function') {
        (window as any).snap.pay(checkout.snapToken, {
          onSuccess: async () => {
            toast.success('Pembayaran berhasil dikonfirmasi! Mengaktifkan kuota paket baru...');
            await loadBillingData();
            if (onPlanUpgraded) onPlanUpgraded();
          },
          onPending: async () => {
            toast.info('Kode pembayaran (QRIS / Virtual Account) aktif. Silakan selesaikan pembayaran.');
            await loadBillingData();
          },
          onError: () => {
            toast.error('Pembayaran gagal atau dibatalkan.');
          },
          onClose: async () => {
            await loadBillingData();
          }
        });
      } else if (checkout.redirectUrl) {
        window.open(checkout.redirectUrl, '_blank');
      }
    } catch (err: any) {
      toast.error(err.message || 'Gagal memulai checkout Midtrans.');
    } finally {
      setUpgradingPlan(null);
    }
  };

  const reopenSnapPayment = async (token: string) => {
    if ((window as any).snap && typeof (window as any).snap.pay === 'function') {
      (window as any).snap.pay(token, {
        onSuccess: async () => {
          toast.success('Pembayaran berhasil!');
          await loadBillingData();
          if (onPlanUpgraded) onPlanUpgraded();
        },
        onPending: async () => {
          toast.info('Kode pembayaran masih aktif.');
          await loadBillingData();
        },
        onError: () => toast.error('Pembayaran gagal.'),
        onClose: async () => await loadBillingData()
      });
    }
  };

  const currentPlan = usage?.plan || 'FREE';

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0B0F17] border border-slate-800 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-[#111827]/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-blue-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white">Paket Langganan & Kuota AI</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  B2B SaaS Edition
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Pilih paket kapasitas tim AI yang sesuai dengan skala bisnis dan kebutuhan otomatisasi organisasi Anda.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Nav Tabs */}
            <div className="flex items-center bg-slate-900 border border-slate-800 p-0.5 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('plans')}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  activeTab === 'plans' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Paket & Harga
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('invoices')}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  activeTab === 'invoices' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Riwayat Tagihan ({invoices.length})
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Live Usage Meter Banner */}
          {usage && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-900/90 border border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-300">Penggunaan Kuota Bulan Ini:</span>
                  <span className="text-xs font-mono font-bold text-white">
                    {usage.tasksUsedThisMonth} / {usage.taskQuotaLimit} Tugas
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    usage.quotaPercentUsed >= 90
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : usage.quotaPercentUsed >= 70
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}>
                    {usage.quotaPercentUsed}% Terpakai
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full sm:w-80 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      usage.quotaPercentUsed >= 90
                        ? 'bg-red-500'
                        : usage.quotaPercentUsed >= 70
                        ? 'bg-amber-500'
                        : 'bg-cyan-500'
                    }`}
                    style={{ width: `${usage.quotaPercentUsed}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-slate-400">Sisa Kuota: </span>
                  <span className="font-bold text-emerald-400">{usage.remainingTasks} Tugas</span>
                </div>
                <div className="h-4 w-px bg-slate-800" />
                <div>
                  <span className="text-slate-400">Siklus Berakhir: </span>
                  <span className="font-semibold text-slate-200">
                    {usage.daysRemainingInCycle} hari lagi
                  </span>
                </div>
                <div className="h-4 w-px bg-slate-800" />
                <div>
                  <span className="text-slate-400">Paket: </span>
                  <span className="font-bold text-cyan-400 uppercase">{usage.plan}</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'plans' ? (
            <div className="space-y-6">
              {/* Billing Toggle (Monthly vs Annually) */}
              <div className="flex items-center justify-center gap-3">
                <span className={`text-xs font-semibold ${billingInterval === 'MONTHLY' ? 'text-white' : 'text-slate-400'}`}>
                  Bulanan
                </span>
                <button
                  type="button"
                  onClick={() => setBillingInterval(billingInterval === 'MONTHLY' ? 'ANNUALLY' : 'MONTHLY')}
                  className="w-12 h-6 rounded-full bg-slate-800 p-0.5 transition-colors duration-200 ease-in-out relative flex items-center border border-slate-700"
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-cyan-400 transition-transform duration-200 ease-in-out shadow-sm ${
                      billingInterval === 'ANNUALLY' ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-semibold ${billingInterval === 'ANNUALLY' ? 'text-white' : 'text-slate-400'}`}>
                    Tahunan
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Hemat 20%
                  </span>
                </div>
              </div>

              {/* Pricing Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {plans.map((plan) => {
                  const isCurrent = currentPlan === plan.id;
                  const isStarter = plan.id === 'STARTER';
                  const isAnnual = billingInterval === 'ANNUALLY';
                  const finalPrice = isAnnual ? Math.round(plan.priceIdr * 0.8) : plan.priceIdr;

                  return (
                    <div
                      key={plan.id}
                      className={`relative rounded-2xl p-5 flex flex-col justify-between border transition-all ${
                        isCurrent
                          ? 'bg-slate-900/90 border-cyan-500/60 shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-500/40'
                          : isStarter
                          ? 'bg-slate-900/60 border-blue-500/40 hover:border-blue-500/70 shadow-md'
                          : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Popular Badge */}
                      {plan.isPopular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-extrabold text-[10px] tracking-wider uppercase shadow-md shadow-blue-500/30">
                          Paling Populer
                        </div>
                      )}

                      <div className="space-y-4">
                        <div>
                          <div className="flex items-center justify-between">
                            <h3 className="font-extrabold text-base text-white">{plan.name}</h3>
                            {isCurrent && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                                Aktif
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2 min-h-[32px]">
                            {plan.tagline}
                          </p>
                        </div>

                        {/* Price */}
                        <div className="pt-2 border-t border-slate-800/80">
                          {plan.priceIdr === 0 ? (
                            <div className="text-2xl font-black text-white">Gratis</div>
                          ) : (
                            <div>
                              <div className="flex items-baseline gap-1">
                                <span className="text-xs text-slate-400">Rp</span>
                                <span className="text-2xl font-black text-white">
                                  {finalPrice.toLocaleString('id-ID')}
                                </span>
                                <span className="text-xs text-slate-400">/bln</span>
                              </div>
                              {isAnnual && (
                                <p className="text-[10px] text-emerald-400 font-medium">
                                  Ditagih tahunan (hemat Rp {(plan.priceIdr * 12 * 0.2).toLocaleString('id-ID')})
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Quota Highlights */}
                        <div className="space-y-1.5 py-2 px-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Batas Tugas:</span>
                            <span className="font-bold text-white font-mono">{plan.taskQuotaLimit.toLocaleString('id-ID')} /bln</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Maks. Agen AI:</span>
                            <span className="font-bold text-cyan-300 font-mono">
                              {plan.agentLimit >= 900 ? 'Unlimited' : `${plan.agentLimit} Agen`}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Anggota Tim:</span>
                            <span className="font-bold text-slate-200 font-mono">
                              {plan.memberLimit >= 900 ? 'Unlimited' : `${plan.memberLimit} Pengguna`}
                            </span>
                          </div>
                        </div>

                        {/* Feature List */}
                        <div className="space-y-2 pt-1">
                          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Fitur Utama</div>
                          <ul className="space-y-2 text-xs">
                            {plan.features.map((feat, idx) => (
                              <li key={idx} className="flex items-start gap-2 text-slate-300">
                                <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                                <span className="leading-tight">{feat}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="pt-6 mt-4 border-t border-slate-800/80">
                        {isCurrent ? (
                          <button
                            type="button"
                            disabled
                            className="w-full py-2.5 rounded-xl bg-slate-800/80 text-slate-400 text-xs font-bold cursor-default flex items-center justify-center gap-1.5"
                          >
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                            <span>Paket Aktif Saat Ini</span>
                          </button>
                        ) : plan.id === 'ENTERPRISE' ? (
                          <a
                            href="mailto:sales@id-tech.cloud?subject=Permintaan%20Enterprise%20AI%20Command%20Center"
                            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
                          >
                            <span>Hubungi Sales</span>
                            <ChevronRight className="w-4 h-4" />
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedPlanForCheckout(plan)}
                            disabled={upgradingPlan === plan.id}
                            className={`w-full py-2.5 rounded-xl text-xs font-bold transition shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                              isStarter
                                ? 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white shadow-blue-500/20'
                                : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                            }`}
                          >
                            {upgradingPlan === plan.id ? (
                              <span>Memproses Upgrade...</span>
                            ) : (
                              <>
                                <span>Pilih {plan.name}</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Invoices History Tab */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <span>Riwayat Faktur & Pembayaran Langganan</span>
                </h3>
              </div>

              {invoices.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl">
                  <CreditCard className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Belum ada riwayat transaksi pembayaran.</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Faktur akan otomatis tercatat setiap kali workspace Anda memperbarui paket langganan.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/50">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 font-semibold">
                      <tr>
                        <th className="px-4 py-3">No. Faktur</th>
                        <th className="px-4 py-3">Paket</th>
                        <th className="px-4 py-3">Jumlah</th>
                        <th className="px-4 py-3">Interval</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Tanggal Pembayaran</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-900/40 transition">
                          <td className="px-4 py-3 font-bold text-slate-200">{inv.invoiceNumber}</td>
                          <td className="px-4 py-3 text-cyan-300 font-semibold">{inv.plan}</td>
                          <td className="px-4 py-3 text-white font-bold">
                            Rp {inv.amountIdr.toLocaleString('id-ID')}
                          </td>
                          <td className="px-4 py-3 text-slate-400">{inv.interval}</td>
                          <td className="px-4 py-3">
                            {inv.status === 'PAID' ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                LUNAS (PAID)
                              </span>
                            ) : inv.status === 'PENDING' ? (
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">
                                  PENDING
                                </span>
                                {inv.paymentGatewayRef && (
                                  <button
                                    type="button"
                                    onClick={() => reopenSnapPayment(inv.paymentGatewayRef!)}
                                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/40 flex items-center gap-1 transition"
                                  >
                                    <span>Bayar</span>
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20">
                                {inv.status}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-400">
                            {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Guarantee */}
        <div className="px-6 py-3 border-t border-slate-800/80 bg-[#111827]/40 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <span>Garansi ketersediaan SLA 99.9% • Pembayaran aman QRIS & Virtual Account Bank</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px]">Sistem Penagihan Terisolasi Multi-Tenant</span>
          </div>
        </div>
      </div>

      {/* Cybernetic Pre-Checkout Review Modal */}
      {selectedPlanForCheckout && (
        <div
          onClick={() => setSelectedPlanForCheckout(null)}
          className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0B0F17] border border-cyan-500/50 rounded-2xl w-full max-w-lg shadow-2xl shadow-cyan-950/60 overflow-hidden p-5 sm:p-6 space-y-5 animate-in zoom-in-95 duration-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Ringkasan Checkout Langganan</h3>
                  <p className="text-[11px] text-slate-400">Gateway Pembayaran Resmi ID-Tech Cloud & Midtrans</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPlanForCheckout(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Plan Info Card */}
            <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                    Paket Pilihan
                  </span>
                  <h4 className="text-base font-extrabold text-white mt-1">{selectedPlanForCheckout.name}</h4>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-slate-400 font-mono">Kapasitas Tugas:</span>
                  <p className="text-sm font-black text-cyan-300 font-mono">
                    {selectedPlanForCheckout.taskQuotaLimit.toLocaleString('id-ID')} /bln
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                {selectedPlanForCheckout.tagline}
              </p>

              {/* Interval Switcher */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-xs text-slate-400">Siklus Penagihan:</span>
                <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setBillingInterval('MONTHLY')}
                    className={`px-2.5 py-1 rounded font-medium transition ${
                      billingInterval === 'MONTHLY' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400'
                    }`}
                  >
                    Bulanan
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillingInterval('ANNUALLY')}
                    className={`px-2.5 py-1 rounded font-medium transition flex items-center gap-1 ${
                      billingInterval === 'ANNUALLY' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400'
                    }`}
                  >
                    <span>Tahunan</span>
                    <span className="text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-400 font-bold">-20%</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="space-y-2 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>Harga Paket ({billingInterval === 'ANNUALLY' ? '12 Bulan' : '1 Bulan'}):</span>
                <span className="font-mono text-slate-200">
                  Rp {(billingInterval === 'ANNUALLY' ? selectedPlanForCheckout.priceIdr * 12 : selectedPlanForCheckout.priceIdr).toLocaleString('id-ID')}
                </span>
              </div>
              {billingInterval === 'ANNUALLY' && (
                <div className="flex items-center justify-between text-emerald-400">
                  <span>Diskon Promo Tahunan (Hemat 20%):</span>
                  <span className="font-mono font-bold">
                    -Rp {(selectedPlanForCheckout.priceIdr * 12 * 0.2).toLocaleString('id-ID')}
                  </span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-800 flex items-center justify-between font-bold text-sm">
                <span className="text-white">Total Pembayaran:</span>
                <span className="text-cyan-400 font-mono text-base font-black">
                  Rp {(billingInterval === 'ANNUALLY' ? Math.round(selectedPlanForCheckout.priceIdr * 12 * 0.8) : selectedPlanForCheckout.priceIdr).toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            {/* Supported Channels */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="font-semibold uppercase tracking-wider">Metode Pembayaran Resmi:</span>
                <span className="text-cyan-400 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  256-bit SSL Verified
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                  <QrCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="font-bold truncate">QRIS Instant</span>
                </div>
                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                  <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="font-bold truncate">Virtual Account</span>
                </div>
                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="font-bold truncate">Kartu Kredit</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 text-center pt-0.5">
                Mendukung QRIS (GoPay, OVO, Dana, ShopeePay), BCA, Mandiri, BRI, BNI & Visa/Mastercard.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedPlanForCheckout(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-900 text-slate-400 hover:text-white text-xs font-semibold transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleUpgrade(selectedPlanForCheckout.id)}
                disabled={upgradingPlan === selectedPlanForCheckout.id}
                className="flex-[2] py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-cyan-500 to-cyan-400 hover:from-blue-500 hover:to-cyan-300 text-white font-extrabold text-xs shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {upgradingPlan === selectedPlanForCheckout.id ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyiapkan Midtrans...</span>
                  </>
                ) : (
                  <>
                    <span>Buka Pembayaran Snap</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cybernetic Loading Overlay during Snap generation */}
      {upgradingPlan && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md animate-in fade-in duration-150">
          <div className="p-6 rounded-2xl bg-[#0B0F17] border border-cyan-500/50 shadow-2xl shadow-cyan-500/20 text-center space-y-4 max-w-sm mx-4">
            <div className="w-12 h-12 mx-auto rounded-full border-2 border-cyan-500 border-t-transparent animate-spin flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Menghubungkan ke Midtrans Snap</h4>
              <p className="text-xs text-slate-400 mt-1">
                Menyiapkan formulir pembayaran terenkripsi untuk transaksi Anda...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
