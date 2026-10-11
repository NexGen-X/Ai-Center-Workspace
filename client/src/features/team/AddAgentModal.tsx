import React, { useState } from 'react';
import { X, Check, AlertCircle, RefreshCw, Zap, Server, Shield, Layers, HelpCircle, CheckCircle2 } from 'lucide-react';
import { PROVIDER_PRESETS, AGENT_ROLES, ProviderPresetDefinition } from '../../../../shared/constants.js';
import { AgentRole, ProtocolType, ProviderType, CreateAgentRequest, TestConnectionResponse } from '../../../../shared/types.js';
import { api } from '../../services/api.js';

interface AddAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAgentCreated: () => void;
}

type TabType = 'preset' | 'custom' | 'hermes';

export const AddAgentModal: React.FC<AddAgentModalProps> = ({ isOpen, onClose, onAgentCreated }) => {
  const [activeTab, setActiveTab] = useState<TabType>('preset');

  // Common Fields
  const [name, setName] = useState('');
  const [role, setRole] = useState<AgentRole>('Executor');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState(
    'Anda adalah AI Agent mandiri dalam AI Command Center. Selesaikan tugas dengan terstruktur, aman, dan berikan bukti hasil verifikasi.'
  );

  // Preset Tab State
  const [selectedPreset, setSelectedPreset] = useState<ProviderPresetDefinition>(PROVIDER_PRESETS[0]);
  const [presetApiKey, setPresetApiKey] = useState('');
  const [presetModel, setPresetModel] = useState(PROVIDER_PRESETS[0].suggestedModels[0]);

  // Custom Tab State
  const [customBaseUrl, setCustomBaseUrl] = useState('https://api.openai.com/v1');
  const [customApiKey, setCustomApiKey] = useState('');
  const [customProtocol, setCustomProtocol] = useState<ProtocolType>('openai');
  const [customModel, setCustomModel] = useState('gpt-4o');

  // Hermes Tab State
  const [hermesModel, setHermesModel] = useState('nous-hermes-3-llama-3.1-8b');

  // Testing & Discovery State
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResponse | null>(null);
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handle live test connection
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      let req: {
        providerType: ProviderType;
        baseUrl: string;
        protocol: ProtocolType;
        apiKey?: string;
      } = {
        providerType: 'custom_api',
        baseUrl: customBaseUrl,
        protocol: customProtocol,
        apiKey: customApiKey || undefined
      };

      if (activeTab === 'preset') {
        req = {
          providerType: selectedPreset.type,
          baseUrl: selectedPreset.defaultBaseUrl,
          protocol: selectedPreset.protocol,
          apiKey: presetApiKey || undefined
        };
      } else if (activeTab === 'hermes') {
        req = {
          providerType: 'hermes',
          baseUrl: 'hermes://local-runtime',
          protocol: 'hermes_runtime',
          apiKey: undefined
        };
      }

      const res = await api.testConnection(req);
      setTestResult(res);
      if (res.discoveredModels && res.discoveredModels.length > 0) {
        setDiscoveredModels(res.discoveredModels);
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        status: 'CONNECTION_FAILED',
        message: err.message || 'Gagal menguji koneksi'
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Handle Model Discovery
  const handleDiscoverModels = async () => {
    setIsDiscovering(true);
    try {
      const baseUrl = activeTab === 'preset' ? selectedPreset.defaultBaseUrl : customBaseUrl;
      const apiKey = activeTab === 'preset' ? presetApiKey : customApiKey;
      const providerType = activeTab === 'preset' ? selectedPreset.type : 'custom_api';

      const res = await api.discoverModels(baseUrl, apiKey, providerType);
      if (res.models && res.models.length > 0) {
        setDiscoveredModels(res.models);
      } else {
        alert('Tidak ada model yang ditemukan atau provider tidak mendukung GET /models');
      }
    } catch (err: any) {
      alert(`Model discovery gagal: ${err.message}`);
    } finally {
      setIsDiscovering(false);
    }
  };

  // Submit and create agent
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!name.trim()) {
      setSubmitError('Nama anggota AI wajib diisi.');
      return;
    }

    setIsSubmitting(true);
    try {
      let payload: CreateAgentRequest;

      if (activeTab === 'preset') {
        payload = {
          name: name.trim(),
          role,
          description: description.trim(),
          systemPrompt: systemPrompt.trim(),
          providerMode: 'new_preset',
          newProvider: {
            name: selectedPreset.label,
            providerType: selectedPreset.type,
            baseUrl: selectedPreset.defaultBaseUrl,
            protocol: selectedPreset.protocol,
            apiKey: presetApiKey.trim() || undefined
          },
          modelId: presetModel,
          capabilities: ['inference', 'reasoning']
        };
      } else if (activeTab === 'custom') {
        payload = {
          name: name.trim(),
          role,
          description: description.trim(),
          systemPrompt: systemPrompt.trim(),
          providerMode: 'new_custom',
          newProvider: {
            name: `Custom API (${new URL(customBaseUrl).hostname})`,
            providerType: 'custom_api',
            baseUrl: customBaseUrl.trim(),
            protocol: customProtocol,
            apiKey: customApiKey.trim() || undefined
          },
          modelId: customModel,
          capabilities: ['custom_endpoint', 'inference']
        };
      } else {
        // Hermes Runtime
        payload = {
          name: name.trim(),
          role,
          description: description.trim(),
          systemPrompt: systemPrompt.trim(),
          providerMode: 'hermes_runtime',
          newProvider: {
            name: 'Hermes Agent Runtime',
            providerType: 'hermes',
            baseUrl: 'hermes://local-runtime',
            protocol: 'hermes_runtime'
          },
          modelId: hermesModel,
          capabilities: ['autonomous_agent', 'hermes_runtime']
        };
      }

      await api.createAgent(payload);
      onAgentCreated();
      onClose();
    } catch (err: any) {
      setSubmitError(err.message || 'Gagal menambahkan anggota AI Team');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#111827] border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0B0F17]/60">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span>Tambah Anggota AI Team</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Daftarkan entitas agen AI baru ke dalam sistem orkestrasi dan ruang kerja 3D.
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-800 bg-[#0B0F17]/40 px-6 pt-2 gap-2">
          <button
            type="button"
            onClick={() => { setActiveTab('preset'); setTestResult(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
              activeTab === 'preset'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>1. Provider Preset</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('custom'); setTestResult(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
              activeTab === 'custom'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>2. Custom API Provider</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('hermes'); setTestResult(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition ${
              activeTab === 'hermes'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>3. External Runtime (Hermes)</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-4 flex-1">
          {submitError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Core Identity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nama Anggota AI <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Nova Analyst, CodeWeaver, Atlas"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Peran Agent (Role) <span className="text-red-400">*</span>
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as AgentRole)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 transition"
              >
                {AGENT_ROLES.map((r) => (
                  <option key={r.role} value={r.role}>
                    {r.role} — {r.description.slice(0, 40)}...
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Deskripsi Singkat</label>
            <input
              type="text"
              placeholder="Tujuan spesifik atau area tanggung jawab anggota ini"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Instruksi Sistem (System Prompt) <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div className="border-t border-slate-800 pt-3">
            {/* TAB 1: PRESET PROVIDER */}
            {activeTab === 'preset' && (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-300 mb-1">Pilih Provider Preset Terverifikasi</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {PROVIDER_PRESETS.filter(p => p.type !== 'hermes').map((preset) => {
                    const isSelected = selectedPreset.type === preset.type;
                    return (
                      <button
                        type="button"
                        key={preset.type}
                        onClick={() => {
                          setSelectedPreset(preset);
                          setPresetModel(preset.suggestedModels[0]);
                          setTestResult(null);
                        }}
                        className={`p-2.5 rounded-lg border text-left transition ${
                          isSelected
                            ? 'bg-blue-600/15 border-blue-500 text-white shadow-sm'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-300'
                        }`}
                      >
                        <div className="font-bold text-xs truncate flex items-center justify-between">
                          <span>{preset.label}</span>
                          {preset.isAvailableOnSystem && (
                            <span className="w-2 h-2 rounded-full bg-emerald-400" title="Aktif di host lokal" />
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 block truncate mt-0.5">{preset.defaultBaseUrl}</span>
                      </button>
                    );
                  })}
                </div>

                {selectedPreset.requiresApiKey && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      API Key / Gateway Token <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="password"
                      placeholder={selectedPreset.apiKeyPlaceholder}
                      value={presetApiKey}
                      onChange={(e) => setPresetApiKey(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 transition font-mono"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Kredensial disimpan terenkripsi (AES-256-GCM) di backend dan tidak akan pernah ditampilkan kembali dalam plaintext.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Model ID</label>
                    <input
                      type="text"
                      value={presetModel}
                      onChange={(e) => setPresetModel(e.target.value)}
                      placeholder="Masukkan atau pilih model"
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Rekomendasi Model</label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedPreset.suggestedModels.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setPresetModel(m)}
                          className={`text-[10px] font-mono px-2 py-1 rounded border transition ${
                            presetModel === m
                              ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: CUSTOM API PROVIDER */}
            {activeTab === 'custom' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Base URL <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="url"
                      required
                      placeholder="https://api.openai.com/v1 atau http://custom-host:8000/v1"
                      value={customBaseUrl}
                      onChange={(e) => setCustomBaseUrl(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Protokol</label>
                    <select
                      value={customProtocol}
                      onChange={(e) => setCustomProtocol(e.target.value as ProtocolType)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="openai">OpenAI Compatible (/v1)</option>
                      <option value="anthropic">Anthropic Messages API</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">API Key</label>
                  <input
                    type="password"
                    placeholder="sk-..."
                    value={customApiKey}
                    onChange={(e) => setCustomApiKey(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Model ID <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="gpt-4o, claude-3-7-sonnet, dll"
                      value={customModel}
                      onChange={(e) => setCustomModel(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleDiscoverModels}
                      disabled={isDiscovering}
                      className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isDiscovering ? 'animate-spin' : ''}`} />
                      <span>{isDiscovering ? 'Mencari...' : 'Model Discovery (GET /models)'}</span>
                    </button>
                  </div>
                </div>

                {discoveredModels.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                      Model yang ditemukan dari upstream:
                    </span>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                      {discoveredModels.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setCustomModel(m)}
                          className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 hover:bg-blue-600/20 text-slate-300 border border-slate-800"
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: EXTERNAL RUNTIME — HERMES */}
            {activeTab === 'hermes' && (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-300">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Integrasi External Agent Runtime — Hermes (Nous Research)</span>
                  </div>
                  <p className="text-amber-200/80 leading-relaxed text-[11px]">
                    Runtime Hermes menjalankan autonomous agent langsung di level sistem operasi. Sesuai Bab 4C dokumen arsitektur,
                    aplikasi tidak mengasumsikan endpoint HTTP fiktif atau meminta API key yang tidak diperlukan jika Hermes mengelola kredensial secara internal.
                  </p>
                  <p className="text-slate-400 text-[11px]">
                    <strong className="text-slate-300">Hasil Audit:</strong> Binary <code className="text-amber-300">/usr/bin/hermes</code> tidak terpasang di host saat ini.
                    Status koneksi akan dilaporkan sebagai <strong>UNAVAILABLE</strong> hingga paket atau daemon Hermes diaktifkan.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Pilih Model Hermes Target</label>
                  <select
                    value={hermesModel}
                    onChange={(e) => setHermesModel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="nous-hermes-3-llama-3.1-8b">nous-hermes-3-llama-3.1-8b (General Reasoning)</option>
                    <option value="hermes-3-70b">hermes-3-70b (Deep Agentic Architecture)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Test Connection Result Box */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                <span>{isTesting ? 'Menguji Koneksi...' : 'Test Connection'}</span>
              </button>

              {testResult && (
                <div className={`flex items-center gap-1.5 text-xs font-semibold ${
                  testResult.success ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  <span>{testResult.message}</span>
                  {testResult.latencyMs !== undefined && (
                    <span className="text-[10px] text-slate-500 font-mono">({testResult.latencyMs}ms)</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="border-t border-slate-800 pt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition disabled:opacity-50"
            >
              {isSubmitting ? 'Menyimpan...' : 'Simpan & Aktifkan Anggota'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
