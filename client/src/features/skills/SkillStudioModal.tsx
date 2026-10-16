import React, { useState, useEffect, useCallback } from 'react';
import {
  Wrench,
  Plus,
  Trash2,
  X,
  Play,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Code2,
  ShieldAlert,
  Lock,
  RefreshCw,
  Sparkles,
  Users,
  Search,
  ExternalLink,
  Sliders
} from 'lucide-react';
import { api } from '../../services/api.js';
import {
  CustomAgentSkill,
  CreateCustomSkillRequest,
  CustomSkillParameter,
  ToolRiskLevel,
  AIAgent
} from '../../../../shared/types.js';

interface SkillStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  agents: AIAgent[];
}

export const SkillStudioModal: React.FC<SkillStudioModalProps> = ({
  isOpen,
  onClose,
  agents
}) => {
  const [skills, setSkills] = useState<CustomAgentSkill[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<CustomAgentSkill | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [activeTab, setActiveTab] = useState<'BUILDER' | 'TESTER'>('BUILDER');
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('CUSTOM');
  const [riskLevel, setRiskLevel] = useState<ToolRiskLevel>('LOW');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [executionType, setExecutionType] = useState<'REST_API' | 'MOCK_RESPONSE'>('MOCK_RESPONSE');
  const [parameters, setParameters] = useState<Array<{ name: string; param: CustomSkillParameter }>>([
    { name: 'query', param: { type: 'string', description: 'Kata kunci pencarian atau input', required: true } }
  ]);
  const [restUrl, setRestUrl] = useState('https://api.example.com/data?q={{query}}');
  const [restMethod, setRestMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('GET');
  const [mockOutput, setMockOutput] = useState('{\n  "status": "success",\n  "result": "Hasil pemrosesan untuk: {{query}}"\n}');
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);
  const [isEnabled, setIsEnabled] = useState(true);

  // Tester State
  const [testInputs, setTestInputs] = useState<Record<string, any>>({ query: 'Tes Eksekusi' });
  const [testResult, setTestResult] = useState<{ success: boolean; output: any; durationMs: number; error?: string } | null>(null);

  const fetchSkills = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getCustomSkills();
      setSkills(data);
      if (data.length > 0 && !selectedSkill) {
        populateForm(data[0]);
      }
    } catch (err: any) {
      console.error('Failed to load custom skills:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedSkill]);

  useEffect(() => {
    if (isOpen) {
      fetchSkills();
    }
  }, [isOpen, fetchSkills]);

  // Escape key handler contract
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const populateForm = (skill: CustomAgentSkill) => {
    setSelectedSkill(skill);
    setName(skill.name);
    setDisplayName(skill.displayName);
    setDescription(skill.description);
    setCategory(skill.category);
    setRiskLevel(skill.riskLevel);
    setRequiresApproval(skill.requiresApproval);
    setExecutionType(skill.executionType);

    const paramEntries = Object.entries(skill.parametersSchema || {}).map(([pName, pDef]) => ({
      name: pName,
      param: pDef
    }));
    setParameters(paramEntries.length > 0 ? paramEntries : [{ name: 'query', param: { type: 'string', description: 'Input data', required: true } }]);

    setRestUrl(skill.restConfig?.endpointUrl || '');
    setRestMethod(skill.restConfig?.method || 'GET');
    setMockOutput(skill.mockOutputTemplate || '{\n  "status": "success"\n}');
    setSelectedAgentIds(skill.allowedAgentIds || []);
    setIsEnabled(skill.isEnabled);

    // Initialize test inputs
    const initialTest: Record<string, any> = {};
    for (const [pName, pDef] of Object.entries(skill.parametersSchema || {})) {
      initialTest[pName] = pDef.defaultValue || (pDef.type === 'number' ? 10 : pDef.type === 'boolean' ? true : 'Contoh Nilai');
    }
    setTestInputs(initialTest);
    setTestResult(null);
  };

  const handleCreateNew = () => {
    setSelectedSkill(null);
    setName('');
    setDisplayName('');
    setDescription('');
    setCategory('CUSTOM');
    setRiskLevel('LOW');
    setRequiresApproval(false);
    setExecutionType('MOCK_RESPONSE');
    setParameters([{ name: 'query', param: { type: 'string', description: 'Parameter input', required: true } }]);
    setRestUrl('https://api.example.com/v1/resource?id={{query}}');
    setRestMethod('GET');
    setMockOutput('{\n  "status": "success",\n  "data": "Respons tiruan untuk {{query}}"\n}');
    setSelectedAgentIds([]);
    setIsEnabled(true);
    setTestInputs({ query: 'Tes' });
    setTestResult(null);
    setActiveTab('BUILDER');
  };

  const handleSaveSkill = async () => {
    if (!name.trim()) {
      setMessage({ text: 'Nama identifikasi skill wajib diisi.', type: 'error' });
      return;
    }
    if (!displayName.trim()) {
      setMessage({ text: 'Nama tampilan skill wajib diisi.', type: 'error' });
      return;
    }

    const schemaObj: Record<string, CustomSkillParameter> = {};
    for (const p of parameters) {
      if (p.name.trim()) {
        schemaObj[p.name.trim()] = p.param;
      }
    }

    const payload: CreateCustomSkillRequest = {
      name: name.trim().toLowerCase(),
      displayName: displayName.trim(),
      description: description.trim(),
      category: category as any,
      riskLevel,
      requiresApproval,
      executionType,
      parametersSchema: schemaObj,
      restConfig: {
        endpointUrl: restUrl.trim(),
        method: restMethod
      },
      mockOutputTemplate: mockOutput,
      allowedAgentIds: selectedAgentIds,
      isEnabled
    };

    try {
      setSaving(true);
      setMessage(null);
      if (selectedSkill) {
        const updated = await api.updateCustomSkill(selectedSkill.id, payload);
        setSelectedSkill(updated);
        setMessage({ text: `Skill "${updated.displayName}" berhasil diperbarui.`, type: 'success' });
      } else {
        const created = await api.createCustomSkill(payload);
        setSelectedSkill(created);
        setMessage({ text: `Skill baru "${created.displayName}" berhasil dibuat!`, type: 'success' });
      }
      await fetchSkills();
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal menyimpan skill.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSkill = async (id: string) => {
    try {
      await api.deleteCustomSkill(id);
      if (selectedSkill?.id === id) {
        handleCreateNew();
      }
      await fetchSkills();
      setMessage({ text: 'Skill berhasil dihapus.', type: 'success' });
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal menghapus skill.', type: 'error' });
    }
  };

  const handleRunTest = async () => {
    if (!selectedSkill) return;
    try {
      setTesting(true);
      setMessage(null);
      const res = await api.testCustomSkill(selectedSkill.id, {
        input: testInputs
      });
      setTestResult(res);
      if (res.success) {
        setMessage({ text: `Eksekusi uji coba berhasil dalam ${res.durationMs}ms!`, type: 'success' });
      } else {
        setMessage({ text: `Eksekusi gagal: ${res.error}`, type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Gagal menguji eksekusi skill.', type: 'error' });
    } finally {
      setTesting(false);
    }
  };

  const addParameter = () => {
    const newIdx = parameters.length + 1;
    setParameters([
      ...parameters,
      { name: `param_${newIdx}`, param: { type: 'string', description: `Deskripsi param ${newIdx}`, required: false } }
    ]);
  };

  const removeParameter = (idx: number) => {
    setParameters(parameters.filter((_, i) => i !== idx));
  };

  const filteredSkills = skills.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-[#0f172a] border border-slate-700/80 rounded-2xl w-full max-w-7xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                No-Code Agent Skill Builder & Dynamic Tool Studio
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                  RUNTIME TOOL REGISTRY
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Bangun alat kustom, tentukan skema parameter, proteksi SSRF REST endpoint, dan delegasikan ke AI Agent
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCreateNew}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Skill Baru</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notifications Banner */}
        {message && (
          <div
            className={`px-6 py-2 text-xs flex items-center justify-between border-b ${
              message.type === 'success'
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
                : 'bg-rose-950/40 text-rose-300 border-rose-800/40'
            }`}
          >
            <span>{message.text}</span>
            <button
              type="button"
              onClick={() => setMessage(null)}
              className="text-slate-400 hover:text-white ml-2 text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Content Layout */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
          {/* Left Column: Skills Registry List */}
          <div className="lg:col-span-4 p-4 flex flex-col h-full overflow-hidden space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari skill kustom..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {loading && skills.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                  <span>Memuat daftar skill...</span>
                </div>
              ) : filteredSkills.length === 0 ? (
                <div className="text-center py-12 px-4 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
                  Belum ada skill kustom yang terdaftar. Klik <strong>+ Skill Baru</strong> untuk membuat tool pertama Anda!
                </div>
              ) : (
                filteredSkills.map((s) => {
                  const isSelected = selectedSkill?.id === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => populateForm(s)}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition flex items-center justify-between ${
                        isSelected
                          ? 'bg-purple-950/40 border-purple-500/50 shadow-md ring-1 ring-purple-500/30'
                          : 'bg-slate-900/40 border-slate-800 hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-purple-300 font-bold">
                            {s.executionType}
                          </span>
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase ${
                              s.riskLevel === 'HIGH' || s.riskLevel === 'CRITICAL'
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {s.riskLevel}
                          </span>
                          {s.requiresApproval && (
                            <span className="text-[9px] font-mono px-1 rounded bg-amber-500/20 text-amber-300 flex items-center gap-0.5">
                              <Lock className="w-2.5 h-2.5" /> GATE
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-white truncate">{s.displayName}</h4>
                        <p className="text-[10px] font-mono text-slate-400 truncate">{s.name}()</p>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSkill(s.id);
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1.5 rounded transition"
                        title="Hapus Skill"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Skill Studio Form / Tester */}
          <div className="lg:col-span-8 p-6 flex flex-col h-full overflow-y-auto bg-slate-950/40 space-y-4">
            {/* Tab Navigation */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('BUILDER')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    activeTab === 'BUILDER'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Desain & Konfigurasi Skill</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('TESTER')}
                  disabled={!selectedSkill}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-40 ${
                    activeTab === 'TESTER'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Interactive Test Sandbox</span>
                </button>
              </div>

              {activeTab === 'BUILDER' && (
                <button
                  type="button"
                  onClick={handleSaveSkill}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md transition disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{saving ? 'Menyimpan...' : selectedSkill ? 'Simpan Pembaruan' : 'Buat Skill Baru'}</span>
                </button>
              )}
            </div>

            {/* TAB 1: BUILDER */}
            {activeTab === 'BUILDER' && (
              <div className="space-y-4">
                {/* Basic Identifiers */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">
                      Nama Identifier Tool (Slug):
                    </label>
                    <input
                      type="text"
                      value={name}
                      disabled={Boolean(selectedSkill)}
                      onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="mis. check_crypto_price"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-purple-300 placeholder-slate-600 focus:outline-none focus:border-purple-500 disabled:opacity-60"
                    />
                    <span className="text-[10px] text-slate-500">
                      Nama fungsi pemanggilan oleh AI Agent (hanya huruf kecil dan underscore).
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Nama Tampilan Human-Readable:</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="mis. Crypto Price Checker"
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Deskripsi Perilaku (System Prompt untuk AI Agent):
                  </label>
                  <textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Jelaskan fungsi tool ini secara jelas agar AI Agent tahu kapan harus memanggilnya."
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-purple-500 resize-none"
                  />
                </div>

                {/* Risk and Execution Controls */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Tingkat Risiko:</label>
                    <select
                      value={riskLevel}
                      onChange={(e) => setRiskLevel(e.target.value as ToolRiskLevel)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="LOW">LOW</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="HIGH">HIGH</option>
                      <option value="CRITICAL">CRITICAL</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Tipe Eksekusi:</label>
                    <select
                      value={executionType}
                      onChange={(e) => setExecutionType(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="MOCK_RESPONSE">MOCK_RESPONSE</option>
                      <option value="REST_API">REST_API</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 pt-4">
                    <input
                      type="checkbox"
                      id="approvalGate"
                      checked={requiresApproval}
                      onChange={(e) => setRequiresApproval(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-0"
                    />
                    <label htmlFor="approvalGate" className="text-xs text-slate-300 font-medium cursor-pointer">
                      Human Approval Gate
                    </label>
                  </div>

                  <div className="flex items-center gap-2 pt-4">
                    <input
                      type="checkbox"
                      id="enableSkill"
                      checked={isEnabled}
                      onChange={(e) => setIsEnabled(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-emerald-600 focus:ring-0"
                    />
                    <label htmlFor="enableSkill" className="text-xs text-slate-300 font-medium cursor-pointer">
                      Aktifkan Skill
                    </label>
                  </div>
                </div>

                {/* Parameters Schema Builder */}
                <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Code2 className="w-3.5 h-3.5 text-blue-400" />
                        <span>Parameter Input (JSON Schema)</span>
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Argumen yang dapat diberikan oleh AI Agent saat memanggil tool ini.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={addParameter}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Tambah Parameter</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {parameters.map((p, idx) => (
                      <div key={idx} className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                        <input
                          type="text"
                          value={p.name}
                          onChange={(e) => {
                            const updated = [...parameters];
                            updated[idx].name = e.target.value;
                            setParameters(updated);
                          }}
                          placeholder="nama_parameter"
                          className="w-36 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-purple-300 focus:outline-none"
                        />

                        <select
                          value={p.param.type}
                          onChange={(e) => {
                            const updated = [...parameters];
                            updated[idx].param.type = e.target.value as any;
                            setParameters(updated);
                          }}
                          className="w-24 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none"
                        >
                          <option value="string">string</option>
                          <option value="number">number</option>
                          <option value="boolean">boolean</option>
                          <option value="object">object</option>
                        </select>

                        <input
                          type="text"
                          value={p.param.description}
                          onChange={(e) => {
                            const updated = [...parameters];
                            updated[idx].param.description = e.target.value;
                            setParameters(updated);
                          }}
                          placeholder="Deskripsi parameter"
                          className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none min-w-[150px]"
                        />

                        <label className="flex items-center gap-1 text-[11px] text-slate-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(p.param.required)}
                            onChange={(e) => {
                              const updated = [...parameters];
                              updated[idx].param.required = e.target.checked;
                              setParameters(updated);
                            }}
                            className="rounded bg-slate-800 border-slate-700"
                          />
                          <span>Wajib</span>
                        </label>

                        <button
                          type="button"
                          onClick={() => removeParameter(idx)}
                          className="text-slate-500 hover:text-rose-400 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Execution Details Configuration */}
                {executionType === 'REST_API' ? (
                  <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-3">
                    <h4 className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" />
                      <span>Konfigurasi REST API Webhook</span>
                    </h4>
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-3 sm:col-span-2">
                        <label className="block text-[10px] text-slate-400 mb-1">Metode:</label>
                        <select
                          value={restMethod}
                          onChange={(e) => setRestMethod(e.target.value as any)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                        >
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                          <option value="PUT">PUT</option>
                          <option value="DELETE">DELETE</option>
                        </select>
                      </div>
                      <div className="col-span-9 sm:col-span-10">
                        <label className="block text-[10px] text-slate-400 mb-1">Endpoint URL (Gunakan {'{{param}}'}):</label>
                        <input
                          type="text"
                          value={restUrl}
                          onChange={(e) => setRestUrl(e.target.value)}
                          placeholder="https://api.external.com/endpoint?key={{query}}"
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-cyan-300 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-2">
                    <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <Code2 className="w-3.5 h-3.5" />
                      <span>Templat Respons Tiruan (Mock JSON)</span>
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Gunakan sintaks {'{{nama_param}}'} untuk menginjeksikan nilai parameter input ke dalam respons tiruan.
                    </p>
                    <textarea
                      rows={4}
                      value={mockOutput}
                      onChange={(e) => setMockOutput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-amber-300 focus:outline-none resize-none"
                    />
                  </div>
                )}

                {/* Agent Access Control */}
                <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-2">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-purple-400" />
                    <span>Izin Delegasi AI Agent</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Pilih AI Agent mana saja yang diizinkan menggunakan tool ini. Biarkan kosong untuk mengizinkan semua agen.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {agents.map((ag) => {
                      const isAssigned = selectedAgentIds.includes(ag.id);
                      return (
                        <button
                          key={ag.id}
                          type="button"
                          onClick={() => {
                            if (isAssigned) {
                              setSelectedAgentIds(selectedAgentIds.filter((id) => id !== ag.id));
                            } else {
                              setSelectedAgentIds([...selectedAgentIds, ag.id]);
                            }
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                            isAssigned
                              ? 'bg-purple-600 text-white border-purple-500'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          {ag.name} ({ag.role})
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: TESTER */}
            {activeTab === 'TESTER' && selectedSkill && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                  <h4 className="text-xs font-bold text-white mb-1">
                    Uji Coba Eksekusi Skill: <span className="text-purple-400 font-mono">{selectedSkill.name}</span>
                  </h4>
                  <p className="text-xs text-slate-400">{selectedSkill.description}</p>
                </div>

                {/* Test Inputs */}
                <div className="space-y-3 p-4 rounded-xl bg-slate-900/40 border border-slate-800">
                  <h5 className="text-xs font-bold text-slate-300">Masukkan Nilai Parameter:</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.entries(selectedSkill.parametersSchema || {}).map(([pName, pDef]) => (
                      <div key={pName}>
                        <label className="block text-[11px] font-mono text-slate-400 mb-1">
                          {pName} {pDef.required && <span className="text-rose-400">*</span>}:
                        </label>
                        <input
                          type={pDef.type === 'number' ? 'number' : 'text'}
                          value={testInputs[pName] ?? ''}
                          onChange={(e) =>
                            setTestInputs({
                              ...testInputs,
                              [pName]: pDef.type === 'number' ? Number(e.target.value) : e.target.value
                            })
                          }
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-500"
                        />
                        <span className="text-[10px] text-slate-500">{pDef.description}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleRunTest}
                    disabled={testing}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition disabled:opacity-50"
                  >
                    <Play className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                    <span>{testing ? 'Mengeksekusi...' : 'Eksekusi Sekarang'}</span>
                  </button>
                </div>

                {/* Test Result View */}
                {testResult && (
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="flex items-center gap-1.5">
                        {testResult.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-400" />
                        )}
                        <strong className={testResult.success ? 'text-emerald-400' : 'text-rose-400'}>
                          {testResult.success ? 'BERHASIL' : 'GAGAL'}
                        </strong>
                      </span>
                      <span className="text-slate-400">{testResult.durationMs}ms</span>
                    </div>

                    <pre className="p-3 rounded-lg bg-black/50 border border-slate-800 text-xs font-mono text-slate-300 overflow-x-auto max-h-60">
                      {typeof testResult.output === 'object'
                        ? JSON.stringify(testResult.output, null, 2)
                        : String(testResult.output || testResult.error)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
