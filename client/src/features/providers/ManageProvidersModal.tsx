import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Cpu,
  Plus,
  Search,
  RefreshCw,
  Zap,
  Server,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Trash2,
  Radio,
  ExternalLink,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
  Sparkles,
  Layers,
  Activity,
  Bot
} from 'lucide-react';
import { ModelProviderConfig, ProviderType, ProtocolType, TestConnectionResponse } from '../../../../shared/types.js';
import { api } from '../../services/api.js';
import { CustomSelect } from '../../components/common/CustomSelect.js';
import { CustomCheckbox } from '../../components/common/CustomCheckbox.js';

interface ManageProvidersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProvidersUpdated?: () => void;
}

interface ProviderPreset {
  id: ProviderType;
  name: string;
  defaultBaseUrl: string;
  defaultProtocol: ProtocolType;
  description: string;
  iconBg: string;
  iconColor: string;
  docUrl: string;
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'routex_local',
    name: 'Route-X Local Gateway',
    defaultBaseUrl: 'http://localhost:8080/v1',
    defaultProtocol: 'openai',
    description: 'Gateway lokal performa tinggi terisolasi dengan latensi rendah.',
    iconBg: 'from-blue-600 to-cyan-500',
    iconColor: 'text-cyan-300',
    docUrl: 'http://localhost:8080'
  },
  {
    id: 'openai',
    name: 'OpenAI Official',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultProtocol: 'openai',
    description: 'Endpoint resmi model GPT-4o, o1, o3-mini, dan embedding.',
    iconBg: 'from-emerald-600 to-teal-500',
    iconColor: 'text-emerald-300',
    docUrl: 'https://platform.openai.com'
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultProtocol: 'anthropic',
    description: 'Claude 3.7 Sonnet, Claude 3.5 Haiku dengan penalaran mendalam.',
    iconBg: 'from-amber-600 to-orange-500',
    iconColor: 'text-amber-300',
    docUrl: 'https://anthropic.com'
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultProtocol: 'gemini',
    description: 'Gemini 2.5 Flash, 1.5 Pro multimodal dengan context window masif.',
    iconBg: 'from-blue-600 to-indigo-500',
    iconColor: 'text-indigo-300',
    docUrl: 'https://ai.google.dev'
  },
  {
    id: 'groq',
    name: 'Groq Cloud LPU',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    defaultProtocol: 'openai',
    description: 'Inference ultra-cepat dengan LPU chip untuk Llama-3, Mixtral.',
    iconBg: 'from-orange-600 to-red-500',
    iconColor: 'text-orange-300',
    docUrl: 'https://groq.com'
  },
  {
    id: 'ollama',
    name: 'Ollama Local Runtime',
    defaultBaseUrl: 'http://localhost:11434/v1',
    defaultProtocol: 'ollama',
    description: 'Host lokal model open-weight (Llama, DeepSeek, Qwen, Mistral).',
    iconBg: 'from-teal-600 to-emerald-500',
    iconColor: 'text-teal-300',
    docUrl: 'https://ollama.ai'
  },
  {
    id: 'custom_api',
    name: 'Custom OpenAI-Compatible',
    defaultBaseUrl: 'https://api.your-provider.com/v1',
    defaultProtocol: 'openai',
    description: 'Endpoint pihak ketiga, vLLM, DeepSeek API, Together, atau proxy kustom.',
    iconBg: 'from-purple-600 to-pink-500',
    iconColor: 'text-purple-300',
    docUrl: ''
  }
];

export const ManageProvidersModal: React.FC<ManageProvidersModalProps> = ({
  isOpen,
  onClose,
  onProvidersUpdated
}) => {
  const [providers, setProviders] = useState<ModelProviderConfig[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'VERIFIED' | 'FAILED' | 'NOT_CONFIGURED'>('ALL');

  // Testing status map: providerId -> { testing: boolean, result?: TestConnectionResponse }
  const [testingMap, setTestingMap] = useState<Record<string, { testing: boolean; result?: TestConnectionResponse }>>({});

  // Modals inside manage provider
  const [isAddEditOpen, setIsAddEditOpen] = useState<boolean>(false);
  const [editingProvider, setEditingProvider] = useState<ModelProviderConfig | null>(null);

  // Form State
  const [formData, setFormData] = useState<{
    name: string;
    providerType: ProviderType;
    baseUrl: string;
    protocol: ProtocolType;
    apiKey: string;
    enabled: boolean;
  }>({
    name: '',
    providerType: 'routex_local',
    baseUrl: 'http://localhost:8080/v1',
    protocol: 'openai',
    apiKey: '',
    enabled: true
  });
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [formTesting, setFormTesting] = useState<boolean>(false);
  const [formTestResult, setFormTestResult] = useState<TestConnectionResponse | null>(null);
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Model discovery submodal state
  const [discoveryModalOpen, setDiscoveryModalOpen] = useState<boolean>(false);
  const [discoveryProvider, setDiscoveryProvider] = useState<ModelProviderConfig | null>(null);
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);
  const [discovering, setDiscovering] = useState<boolean>(false);
  const [modelSearch, setModelSearch] = useState<string>('');
  const [copiedModel, setCopiedModel] = useState<string | null>(null);

  // Delete confirmation
  const [providerToDelete, setProviderToDelete] = useState<ModelProviderConfig | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  // Fetch Providers
  const fetchProviders = async () => {
    try {
      setLoading(true);
      const data = await api.getProviders();
      setProviders(data);
    } catch (err: any) {
      console.error('Failed to fetch providers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchProviders();
    }
  }, [isOpen]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setEditingProvider(null);
    setFormData({
      name: '',
      providerType: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      protocol: 'openai',
      apiKey: '',
      enabled: true
    });
    setShowApiKey(false);
    setFormTestResult(null);
    setFormError(null);
    setIsAddEditOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (p: ModelProviderConfig) => {
    setEditingProvider(p);
    setFormData({
      name: p.name,
      providerType: p.providerType,
      baseUrl: p.baseUrl,
      protocol: p.protocol,
      apiKey: '', // Keep empty unless updating
      enabled: p.enabled
    });
    setShowApiKey(false);
    setFormTestResult(null);
    setFormError(null);
    setIsAddEditOpen(true);
  };

  // Select Preset in form
  const handleSelectPreset = (preset: ProviderPreset) => {
    setFormData(prev => ({
      ...prev,
      name: prev.name.trim() === '' || PROVIDER_PRESETS.some(pr => pr.name === prev.name) ? preset.name : prev.name,
      providerType: preset.id,
      baseUrl: preset.defaultBaseUrl,
      protocol: preset.defaultProtocol
    }));
    setFormTestResult(null);
  };

  // Test Connection in Form
  const handleTestFormConnection = async () => {
    setFormTesting(true);
    setFormError(null);
    setFormTestResult(null);
    try {
      const res = await api.testConnection({
        providerType: formData.providerType,
        baseUrl: formData.baseUrl,
        protocol: formData.protocol,
        apiKey: formData.apiKey || undefined,
        existingProviderId: editingProvider ? editingProvider.id : undefined
      });
      setFormTestResult(res);
    } catch (err: any) {
      setFormTestResult({
        success: false,
        status: 'CONNECTION_FAILED',
        message: err.message || 'Gagal terhubung ke host provider.'
      });
    } finally {
      setFormTesting(false);
    }
  };

  // Save Provider (Create or Update)
  const handleSaveProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.baseUrl.trim()) {
      setFormError('Nama provider dan Base URL tidak boleh kosong.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      if (editingProvider) {
        await api.updateProvider(editingProvider.id, {
          name: formData.name.trim(),
          providerType: formData.providerType,
          baseUrl: formData.baseUrl.trim(),
          protocol: formData.protocol,
          apiKey: formData.apiKey.trim() !== '' ? formData.apiKey.trim() : undefined,
          enabled: formData.enabled
        });
      } else {
        await api.createProvider({
          name: formData.name.trim(),
          providerType: formData.providerType,
          baseUrl: formData.baseUrl.trim(),
          protocol: formData.protocol,
          apiKey: formData.apiKey.trim() !== '' ? formData.apiKey.trim() : undefined,
          enabled: formData.enabled
        });
      }

      await fetchProviders();
      if (onProvidersUpdated) onProvidersUpdated();
      setIsAddEditOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan konfigurasi provider.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Ping / Test Saved Provider
  const handlePingProvider = async (provider: ModelProviderConfig) => {
    setTestingMap(prev => ({
      ...prev,
      [provider.id]: { testing: true }
    }));

    try {
      const res = await api.testProviderById(provider.id);
      setTestingMap(prev => ({
        ...prev,
        [provider.id]: { testing: false, result: res }
      }));
      // Update local provider list status
      setProviders(prev =>
        prev.map(p =>
          p.id === provider.id
            ? { ...p, connectionStatus: res.status, errorMessage: res.success ? undefined : res.message, lastCheckedAt: new Date().toISOString() }
            : p
        )
      );
      if (onProvidersUpdated) onProvidersUpdated();
    } catch (err: any) {
      const failRes: TestConnectionResponse = {
        success: false,
        status: 'CONNECTION_FAILED',
        message: err.message || 'Koneksi gagal atau waktu habis.'
      };
      setTestingMap(prev => ({
        ...prev,
        [provider.id]: { testing: false, result: failRes }
      }));
      setProviders(prev =>
        prev.map(p =>
          p.id === provider.id
            ? { ...p, connectionStatus: 'CONNECTION_FAILED', errorMessage: failRes.message }
            : p
        )
      );
    }
  };

  // Discover Models for Saved Provider
  const handleDiscoverModels = async (provider: ModelProviderConfig) => {
    setDiscoveryProvider(provider);
    setDiscoveryModalOpen(true);
    setDiscovering(true);
    setDiscoveredModels([]);
    setModelSearch('');

    try {
      const res = await api.discoverModels(provider.baseUrl, undefined, provider.providerType, provider.id);
      setDiscoveredModels(res.models || []);
    } catch (err: any) {
      console.error('Model discovery failed:', err);
      setDiscoveredModels([]);
    } finally {
      setDiscovering(false);
    }
  };

  // Delete Provider
  const handleDeleteProvider = async () => {
    if (!providerToDelete) return;
    setDeleting(true);
    setDeleteError(null);

    try {
      await api.deleteProvider(providerToDelete.id);
      setProviderToDelete(null);
      await fetchProviders();
      if (onProvidersUpdated) onProvidersUpdated();
    } catch (err: any) {
      setDeleteError(err.message || 'Gagal menghapus provider.');
    } finally {
      setDeleting(false);
    }
  };

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedModel(id);
    setTimeout(() => setCopiedModel(null), 2000);
  };

  // Filtered providers
  const filteredProviders = useMemo(() => {
    return providers.filter(p => {
      const matchSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.providerType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.baseUrl.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchSearch) return false;

      if (statusFilter === 'VERIFIED') {
        return p.connectionStatus === 'CONNECTION_OK' || p.connectionStatus === 'MODEL_VERIFIED';
      }
      if (statusFilter === 'FAILED') {
        return p.connectionStatus === 'CONNECTION_FAILED' || p.connectionStatus === 'UNAVAILABLE';
      }
      if (statusFilter === 'NOT_CONFIGURED') {
        return p.connectionStatus === 'NOT_CONFIGURED';
      }
      return true;
    });
  }, [providers, searchQuery, statusFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-6xl max-h-[94vh] flex flex-col bg-[#0B0F17] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-800 bg-[#0E131F]/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 p-0.5 shadow-lg shadow-cyan-500/20 flex items-center justify-center shrink-0">
              <div className="w-full h-full bg-[#0B0F17] rounded-[10px] flex items-center justify-center">
                <Cpu className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Manajemen Model Provider
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-[11px] font-mono text-cyan-400 font-semibold">
                  {providers.length} Terpasang
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[11px] font-mono text-emerald-400 font-semibold hidden sm:inline-flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  AES-256-GCM
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                Koneksi upstream multi-model LLM independen dengan proteksi SSRF dan enkripsi kunci simetris.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchProviders}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition disabled:opacity-50"
              title="Segarkan daftar"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Toolbar & Filter Bar */}
        <div className="px-4 sm:px-6 py-3 border-b border-slate-800/80 bg-slate-900/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
          {/* Search & Status Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari provider (nama, tipe, URL)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
              {(
                [
                  { id: 'ALL', label: 'Semua' },
                  { id: 'VERIFIED', label: 'Terhubung' },
                  { id: 'FAILED', label: 'Gagal' },
                  { id: 'NOT_CONFIGURED', label: 'Belum Dites' }
                ] as const
              ).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    statusFilter === tab.id
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Add Provider Button */}
          <button
            onClick={handleOpenAdd}
            className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-cyan-600/20 transition shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Provider</span>
          </button>
        </div>

        {/* Content: Provider Cards List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 custom-scrollbar">
          {loading && providers.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
              <p className="text-sm">Memuat konfigurasi provider...</p>
            </div>
          ) : filteredProviders.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-2xl p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-3">
                <Cpu className="w-6 h-6 text-slate-500" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">
                {searchQuery || statusFilter !== 'ALL'
                  ? 'Tidak ada provider yang cocok dengan filter'
                  : 'Belum Ada Model Provider'}
              </h3>
              <p className="text-xs text-slate-400 max-w-md mb-4">
                {searchQuery || statusFilter !== 'ALL'
                  ? 'Coba ganti kata kunci pencarian atau sesuaikan filter status di atas.'
                  : 'Konfigurasikan koneksi LLM pertama Anda (Route-X, OpenAI, Anthropic, Gemini, Groq, atau Ollama).'}
              </p>
              {!searchQuery && statusFilter === 'ALL' && (
                <button
                  onClick={handleOpenAdd}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-md shadow-blue-500/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Provider Baru</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
              {filteredProviders.map(p => {
                const testState = testingMap[p.id];
                const isOnline = p.connectionStatus === 'CONNECTION_OK' || p.connectionStatus === 'MODEL_VERIFIED';
                const isFailed = p.connectionStatus === 'CONNECTION_FAILED' || p.connectionStatus === 'UNAVAILABLE';

                // Find preset info if available
                const presetInfo = PROVIDER_PRESETS.find(pr => pr.id === p.providerType);

                return (
                  <div
                    key={p.id}
                    className={`relative rounded-2xl p-4 sm:p-5 border transition-all ${
                      p.enabled
                        ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700/80'
                        : 'bg-slate-950/40 border-slate-900 opacity-70'
                    }`}
                  >
                    {/* Top Row: Provider Identity & Status */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${
                            presetInfo ? presetInfo.iconBg : 'from-slate-700 to-slate-600'
                          } p-0.5 shadow-md flex items-center justify-center shrink-0`}
                        >
                          <div className="w-full h-full bg-[#0B0F17] rounded-[10px] flex items-center justify-center">
                            <Bot className={`w-5 h-5 ${presetInfo ? presetInfo.iconColor : 'text-slate-300'}`} />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-sm text-white">{p.name}</h3>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-cyan-300 border border-slate-700/80">
                              {p.providerType}
                            </span>
                            {!p.enabled && (
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-400">
                                Nonaktif
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 font-mono break-all line-clamp-1">
                            {p.baseUrl}
                          </p>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="shrink-0 text-right">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border ${
                            isOnline
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : isFailed
                              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                              : 'bg-slate-800 border-slate-700 text-slate-400'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isOnline ? 'bg-emerald-400 animate-pulse' : isFailed ? 'bg-rose-400' : 'bg-slate-500'
                            }`}
                          />
                          {isOnline ? 'TERHUBUNG' : isFailed ? 'GAGAL' : 'BELUM DITES'}
                        </span>
                      </div>
                    </div>

                    {/* Metadata & Security Chips */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2.5 border-y border-slate-800/80 text-[11px] mb-3">
                      <div>
                        <span className="text-slate-500 block text-[10px]">API Key</span>
                        <div className="flex items-center gap-1 font-mono text-slate-300 font-semibold">
                          <Lock className="w-3 h-3 text-cyan-400 shrink-0" />
                          <span>{p.apiKeyMasked || 'Tanpa Token'}</span>
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-500 block text-[10px]">Protokol</span>
                        <span className="font-mono text-slate-300 font-semibold uppercase">{p.protocol}</span>
                      </div>

                      <div className="col-span-2 sm:col-span-1">
                        <span className="text-slate-500 block text-[10px]">Agen Terkait</span>
                        <span
                          className={`font-semibold ${
                            (p.agentCount || 0) > 0 ? 'text-purple-300 font-bold' : 'text-slate-400'
                          }`}
                        >
                          {p.agentCount || 0} Agen Aktif
                        </span>
                      </div>
                    </div>

                    {/* Error message display if any */}
                    {p.errorMessage && (
                      <div className="mb-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] flex items-start gap-2">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />
                        <span className="break-all">{p.errorMessage}</span>
                      </div>
                    )}

                    {/* Ping feedback result */}
                    {testState?.result && (
                      <div
                        className={`mb-3 p-2.5 rounded-xl border text-[11px] flex items-start gap-2 ${
                          testState.result.success
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        }`}
                      >
                        {testState.result.success ? (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-400" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />
                        )}
                        <div>
                          <p className="font-semibold">{testState.result.message}</p>
                          {testState.result.latencyMs !== undefined && (
                            <p className="text-[10px] opacity-80 mt-0.5">
                              Latensi respons: ⚡ {testState.result.latencyMs}ms
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons Row */}
                    <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Ping / Test Connection */}
                        <button
                          onClick={() => handlePingProvider(p)}
                          disabled={testState?.testing}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-cyan-300 hover:text-cyan-200 border border-slate-700/60 text-xs font-semibold transition disabled:opacity-50"
                          title="Uji koneksi upstream secara empiris"
                        >
                          <Zap className={`w-3.5 h-3.5 ${testState?.testing ? 'animate-spin text-cyan-400' : 'text-cyan-400'}`} />
                          <span>{testState?.testing ? 'Menguji...' : 'Uji Koneksi'}</span>
                        </button>

                        {/* Discover Models */}
                        <button
                          onClick={() => handleDiscoverModels(p)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-purple-300 hover:text-purple-200 border border-slate-700/60 text-xs font-semibold transition"
                          title="Deteksi model AI yang tersedia dari provider ini"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                          <span>Deteksi Model</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Edit Button */}
                        <button
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition"
                          title="Edit konfigurasi provider"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => {
                            setProviderToDelete(p);
                            setDeleteError(null);
                          }}
                          className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700/60 transition"
                          title="Hapus provider"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info banner */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-800 bg-[#0E131F]/90 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">
              Setiap API key dienkripsi simetris dengan initialization vector acak dan cryptographic authentication tag.
            </span>
            <span className="sm:hidden">Enkripsi AES-256 Aktif</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* ADD / EDIT PROVIDER SUBMODAL                             */}
      {/* ======================================================== */}
      {isAddEditOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md">
          <div className="relative w-full max-w-xl max-h-[92vh] flex flex-col bg-[#0F1420] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">
                    {editingProvider ? 'Edit Model Provider' : 'Tambah Model Provider Baru'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Konfigurasikan detail endpoint dan kredensial akses provider.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddEditOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveProvider} className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
              {/* Presets Grid (when adding or changing provider) */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Pilih Preset Provider Cepat
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PROVIDER_PRESETS.map(preset => {
                    const isSelected = formData.providerType === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPreset(preset)}
                        className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                          isSelected
                            ? 'bg-cyan-500/15 border-cyan-500/50 shadow-sm'
                            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <span className={`text-xs font-bold ${isSelected ? 'text-cyan-300' : 'text-slate-200'}`}>
                          {preset.name.split(' ')[0]}
                        </span>
                        <span className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                          {preset.id}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Provider Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nama Provider <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: OpenAI GPT-4o Production / Claude 3.7"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {/* Base URL */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Base URL API Endpoint <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="https://api.openai.com/v1"
                  value={formData.baseUrl}
                  onChange={e => setFormData({ ...formData, baseUrl: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-cyan-300 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Target dilindungi SSRF guard. Hanya URL publik valid atau localhost:8080 (Route-X) yang diizinkan.
                </p>
              </div>

              {/* Protocol & Provider Type Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Tipe Provider
                  </label>
                  <CustomSelect
                    value={formData.providerType}
                    onChange={val => setFormData({ ...formData, providerType: val as ProviderType })}
                    options={[
                      { value: 'routex_local', label: 'Route-X Local' },
                      { value: 'openai', label: 'OpenAI' },
                      { value: 'anthropic', label: 'Anthropic' },
                      { value: 'gemini', label: 'Google Gemini' },
                      { value: 'groq', label: 'Groq' },
                      { value: 'ollama', label: 'Ollama' },
                      { value: 'custom_api', label: 'Custom API' },
                    ]}
                    fullWidth
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Protokol Komunikasi
                  </label>
                  <CustomSelect
                    value={formData.protocol}
                    onChange={val => setFormData({ ...formData, protocol: val as ProtocolType })}
                    options={[
                      { value: 'openai', label: 'OpenAI Compatible (/v1/chat/completions)' },
                      { value: 'anthropic', label: 'Anthropic Messages API' },
                      { value: 'gemini', label: 'Gemini API' },
                      { value: 'ollama', label: 'Ollama Native API' },
                    ]}
                    fullWidth
                  />
                </div>
              </div>

              {/* API Key Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    API Key / Bearer Token {editingProvider && <span className="text-slate-400 font-normal">(Kosongkan jika tidak diubah)</span>}
                  </label>
                  <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    AES-256-GCM
                  </span>
                </div>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    placeholder={
                      editingProvider
                        ? `Tersimpan: ${editingProvider.apiKeyMasked || 'Kosong'} (Ketik baru untuk mengganti)`
                        : 'sk-xxxxxxxxxxxxxxxxxxxxxxxx'
                    }
                    value={formData.apiKey}
                    onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                    className="w-full pl-3 pr-10 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Kunci akan dienkripsi dengan SHA-256 master key dan tidak dapat dibaca kembali dalam bentuk plaintext.
                </p>
              </div>

              {/* Enabled toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <div>
                  <span className="text-xs font-semibold text-white block">Status Aktif Provider</span>
                  <span className="text-[10px] text-slate-400">
                    Jika nonaktif, agen AI tidak akan merutekan panggilan ke endpoint ini.
                  </span>
                </div>
                <CustomCheckbox
                  variant="switch"
                  checked={formData.enabled}
                  onChange={checked => setFormData({ ...formData, enabled: checked })}
                />
              </div>

              {/* Live Test Button in Form */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleTestFormConnection}
                  disabled={formTesting || !formData.baseUrl}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-cyan-300 border border-slate-700/80 text-xs font-bold transition disabled:opacity-50"
                >
                  <Zap className={`w-3.5 h-3.5 ${formTesting ? 'animate-spin text-cyan-400' : 'text-cyan-400'}`} />
                  <span>{formTesting ? 'Menguji Koneksi ke Host...' : 'Uji Koneksi Sebelum Menyimpan'}</span>
                </button>
              </div>

              {/* Test Result in Form */}
              {formTestResult && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                    formTestResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {formTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <span className="font-bold block">{formTestResult.message}</span>
                    {formTestResult.latencyMs !== undefined && (
                      <span className="text-[11px] block opacity-80 mt-0.5">
                        Latensi: ⚡ {formTestResult.latencyMs}ms
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Error in Form */}
              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddEditOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold transition shadow-md shadow-cyan-600/20 disabled:opacity-50"
                >
                  {formSubmitting
                    ? 'Menyimpan...'
                    : editingProvider
                    ? 'Simpan Perubahan'
                    : 'Tambah Provider'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DISCOVERED MODELS SUBMODAL                               */}
      {/* ======================================================== */}
      {discoveryModalOpen && discoveryProvider && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md">
          <div className="relative w-full max-w-lg max-h-[85vh] flex flex-col bg-[#0F1420] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">
                    Model Tersedia: {discoveryProvider.name}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Hasil inspeksi langsung endpoint upstream model catalog.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDiscoveryModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter */}
            <div className="px-5 py-2.5 border-b border-slate-800 bg-slate-900/40">
              <input
                type="text"
                placeholder="Saring model..."
                value={modelSearch}
                onChange={e => setModelSearch(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* Model List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-2 custom-scrollbar">
              {discovering ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
                  <p className="text-xs">Mengirim query ke {discoveryProvider.baseUrl}...</p>
                </div>
              ) : discoveredModels.length === 0 ? (
                <div className="py-10 text-center text-slate-500 text-xs">
                  Tidak ada model yang dikembalikan oleh provider ini atau provider tidak mendukung discovery publik.
                </div>
              ) : (
                discoveredModels
                  .filter(m => m.toLowerCase().includes(modelSearch.toLowerCase()))
                  .map(modelId => (
                    <div
                      key={modelId}
                      className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs hover:border-slate-700 transition"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                        <span className="font-mono text-purple-300 font-semibold">{modelId}</span>
                      </div>
                      <button
                        onClick={() => handleCopy(modelId, modelId)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-[11px]"
                      >
                        {copiedModel === modelId ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Salin</span>
                          </>
                        )}
                      </button>
                    </div>
                  ))
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-400">
              <span>{discoveredModels.length} Model Ditemukan</span>
              <button
                onClick={() => setDiscoveryModalOpen(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DELETE CONFIRMATION SUBMODAL                             */}
      {/* ======================================================== */}
      {providerToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-[#0F1420] border border-slate-700 rounded-2xl shadow-2xl p-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">Hapus Model Provider?</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Anda akan menghapus <span className="text-white font-semibold">{providerToDelete.name}</span> ({providerToDelete.providerType}).
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setProviderToDelete(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteProvider}
                disabled={deleting}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-md shadow-rose-600/20 disabled:opacity-50"
              >
                {deleting ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
