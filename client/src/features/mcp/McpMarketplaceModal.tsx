import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Boxes,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Terminal,
  Search,
  Plus,
  Trash2,
  Play,
  Zap,
  Database,
  Globe,
  HardDrive,
  Cpu,
  Check,
  Copy,
  ChevronRight,
  Activity,
  Layers,
  Sparkles,
  Download
} from 'lucide-react';
import {
  McpServer,
  McpTool,
  McpServerTemplate,
  McpToolCallResult
} from '../../../../shared/types.js';
import { api } from '../../services/api.js';
import { useFeedback } from '../../components/common/FeedbackContext.js';

interface McpMarketplaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const McpMarketplaceModal: React.FC<McpMarketplaceModalProps> = ({
  isOpen,
  onClose
}) => {
  const { toast } = useFeedback();

  // Tab State: 'marketplace' | 'servers' | 'add-custom'
  const [activeTab, setActiveTab] = useState<'marketplace' | 'servers' | 'add-custom'>('marketplace');

  // Data State
  const [servers, setServers] = useState<McpServer[]>([]);
  const [templates, setTemplates] = useState<McpServerTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Server Testing State
  const [testingServerId, setTestingServerId] = useState<string | null>(null);
  const [installingTemplateId, setInstallingTemplateId] = useState<string | null>(null);

  // Selected Tool Runner State
  const [selectedTool, setSelectedTool] = useState<McpTool | null>(null);
  const [toolArgsJson, setToolArgsJson] = useState('{}');
  const [callingTool, setCallingTool] = useState(false);
  const [toolCallResult, setToolCallResult] = useState<McpToolCallResult | null>(null);

  // Add Custom Server Form State
  const [customName, setCustomName] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [customTransport, setCustomTransport] = useState<'stdio' | 'sse'>('stdio');
  const [customCommand, setCustomCommand] = useState('npx');
  const [customArgs, setCustomArgs] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customEnv, setCustomEnv] = useState('');
  const [isSubmittingCustom, setIsSubmittingCustom] = useState(false);

  // Load Servers and Templates
  const fetchData = async () => {
    setLoading(true);
    try {
      const [serversRes, templatesRes] = await Promise.all([
        api.getMcpServers().catch(() => []),
        api.getMcpTemplates().catch(() => [])
      ]);
      setServers(serversRes || []);
      setTemplates(templatesRes || []);
    } catch (err: any) {
      toast.error('Gagal memuat ekosistem MCP: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  // Install Template as Live Server
  const handleInstallTemplate = async (template: McpServerTemplate) => {
    setInstallingTemplateId(template.id);
    try {
      // Check if already installed with same name
      const exists = servers.some(s => s.name.toLowerCase() === template.name.toLowerCase());
      if (exists) {
        toast.info(`Server "${template.name}" sudah terpasang di workspace.`);
        setActiveTab('servers');
        return;
      }

      const created = await api.registerMcpServer({
        name: template.name,
        description: template.description,
        transport: template.transport,
        command: template.command,
        args: template.args,
        env: template.env || {},
        enabled: true
      });

      toast.success(`Server MCP "${template.name}" berhasil dipasang! Menguji koneksi...`);
      // Auto test
      await api.testMcpServer(created.id).catch(() => null);
      await fetchData();
      setActiveTab('servers');
    } catch (err: any) {
      toast.error('Gagal memasang template MCP: ' + (err.message || err));
    } finally {
      setInstallingTemplateId(null);
    }
  };

  // Test Connection
  const handleTestServer = async (serverId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setTestingServerId(serverId);
    try {
      const res = await api.testMcpServer(serverId);
      if (res.success) {
        toast.success(`Koneksi MCP aktif! Terdeteksi ${res.data?.tools?.length || 0} tool.`);
      } else {
        toast.error(`Koneksi MCP gagal: ${res.data?.error || 'Unknown error'}`);
      }
      await fetchData();
    } catch (err: any) {
      toast.error('Uji coba server MCP gagal: ' + (err.message || err));
    } finally {
      setTestingServerId(null);
    }
  };

  // Delete Server
  const handleDeleteServer = async (serverId: string, name: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm(`Hapus integrasi MCP "${name}"?`)) return;
    try {
      await api.deleteMcpServer(serverId);
      toast.success(`Server MCP "${name}" telah dihapus.`);
      setServers(prev => prev.filter(s => s.id !== serverId));
      if (selectedTool?.serverId === serverId) {
        setSelectedTool(null);
      }
    } catch (err: any) {
      toast.error('Gagal menghapus server MCP: ' + (err.message || err));
    }
  };

  // Execute Tool
  const handleExecuteTool = async () => {
    if (!selectedTool) return;
    setCallingTool(true);
    setToolCallResult(null);
    try {
      let parsedArgs = {};
      try {
        parsedArgs = JSON.parse(toolArgsJson);
      } catch {
        throw new Error('Format argumen JSON tidak valid.');
      }

      const res = await api.callMcpTool(selectedTool.serverId, selectedTool.name, parsedArgs);
      setToolCallResult(res);
      toast.success(`Tool "${selectedTool.name}" berhasil dieksekusi!`);
    } catch (err: any) {
      toast.error('Eksekusi tool gagal: ' + (err.message || err));
    } finally {
      setCallingTool(false);
    }
  };

  // Add Custom Server Submit
  const handleAddCustomServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) {
      toast.error('Nama server wajib diisi');
      return;
    }

    setIsSubmittingCustom(true);
    try {
      let envObj: Record<string, string> = {};
      if (customEnv.trim()) {
        customEnv.split('\n').forEach(line => {
          const parts = line.split('=');
          if (parts[0] && parts[1]) {
            envObj[parts[0].trim()] = parts.slice(1).join('=').trim();
          }
        });
      }

      const argsArr = customArgs.trim() ? customArgs.split(' ').filter(Boolean) : [];

      const created = await api.registerMcpServer({
        name: customName.trim(),
        description: customDescription.trim(),
        transport: customTransport,
        command: customTransport === 'stdio' ? customCommand.trim() : undefined,
        args: customTransport === 'stdio' ? argsArr : [],
        url: customTransport === 'sse' ? customUrl.trim() : undefined,
        env: envObj,
        enabled: true
      });

      toast.success(`Server kustom "${created.name}" berhasil didaftarkan! Menguji jabat tangan...`);
      await api.testMcpServer(created.id).catch(() => null);
      await fetchData();
      setActiveTab('servers');
      // Reset form
      setCustomName('');
      setCustomDescription('');
      setCustomArgs('');
      setCustomUrl('');
      setCustomEnv('');
    } catch (err: any) {
      toast.error('Gagal mendaftarkan server kustom: ' + (err.message || err));
    } finally {
      setIsSubmittingCustom(false);
    }
  };

  // Filter templates & tools by search query
  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const q = searchQuery.toLowerCase();
    return templates.filter(t =>
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.defaultTools.some(tool => tool.toLowerCase().includes(q))
    );
  }, [templates, searchQuery]);

  // Aggregate total tools count
  const totalConnectedTools = useMemo(() => {
    return servers.reduce((acc, s) => acc + (s.toolsCache?.length || 0), 0);
  }, [servers]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#090d16] border border-zinc-800 rounded-3xl w-full max-w-5xl h-[92vh] max-h-[850px] flex flex-col shadow-2xl overflow-hidden text-slate-200"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between shrink-0 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 shadow-sm">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Model Context Protocol (MCP) Tools Marketplace
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-500/20 text-teal-400 border border-teal-500/30">
                  Open Standard
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Hubungkan AI Agent ke ekosistem perkakas modular, database, browser scraping, dan knowledge graph
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-slate-300 hover:text-white border border-zinc-800 transition shadow-sm"
              title="Perbarui daftar server"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-teal-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-slate-400 hover:text-white border border-zinc-800 transition"
              title="Tutup dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Navigation Tabs & Search Bar */}
        <div className="px-5 py-2.5 border-b border-zinc-800/80 bg-zinc-950/40 flex items-center justify-between gap-3 flex-wrap shrink-0">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-zinc-900/80 rounded-2xl border border-zinc-800/80">
            <button
              onClick={() => setActiveTab('marketplace')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'marketplace'
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-950/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-300" />
              <span>Katalog Template ({templates.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('servers')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'servers'
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-950/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-cyan-300" />
              <span>Server Terpasang ({servers.length})</span>
              {totalConnectedTools > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-teal-950 border border-teal-500/40 text-teal-300">
                  {totalConnectedTools} Tools
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('add-custom')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                activeTab === 'add-custom'
                  ? 'bg-teal-600 text-white shadow-md shadow-teal-950/50'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Plus className="w-3.5 h-3.5 text-amber-300" />
              <span>Tambah Server Kustom</span>
            </button>
          </div>

          {/* Search bar (active in marketplace tab) */}
          {activeTab === 'marketplace' && (
            <div className="relative min-w-[200px] flex-1 max-w-xs">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari tool atau template..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-teal-500"
              />
            </div>
          )}
        </div>

        {/* Modal Body / Tab Contents */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-5 space-y-4">
          {/* TAB 1: MARKETPLACE / TEMPLATES */}
          {activeTab === 'marketplace' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Template MCP Siap Pakai</span>
                    <span className="text-[11px] font-normal text-slate-400">
                      (Instalasi instan 1-klik terintegrasi ke ekosistem Anthropic & OpenAI Swarm)
                    </span>
                  </h3>
                </div>
              </div>

              {filteredTemplates.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs border border-zinc-800 rounded-2xl">
                  Tidak ada template MCP yang cocok dengan pencarian "{searchQuery}".
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {filteredTemplates.map((template) => {
                    const isInstalled = servers.some(s => s.name.toLowerCase() === template.name.toLowerCase());
                    const isInstalling = installingTemplateId === template.id;

                    return (
                      <div
                        key={template.id}
                        className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/90 hover:border-teal-500/40 transition flex flex-col justify-between space-y-3 group"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <div className="p-2 rounded-xl bg-zinc-800/80 border border-zinc-700/60 text-teal-400">
                                {template.id.includes('postgres') || template.id.includes('sqlite') ? (
                                  <Database className="w-4 h-4" />
                                ) : template.id.includes('fetch') ? (
                                  <Globe className="w-4 h-4" />
                                ) : template.id.includes('filesystem') ? (
                                  <HardDrive className="w-4 h-4" />
                                ) : (
                                  <Boxes className="w-4 h-4" />
                                )}
                              </div>
                              <span className="text-xs font-bold text-white group-hover:text-teal-300 transition line-clamp-1">
                                {template.name}
                              </span>
                            </div>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
                              {template.transport}
                            </span>
                          </div>

                          <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                            {template.description}
                          </p>

                          {/* Default Tools Tags */}
                          <div className="flex flex-wrap gap-1 pt-1">
                            {template.defaultTools.map(tool => (
                              <span
                                key={tool}
                                className="px-1.5 py-0.5 rounded-md bg-teal-950/50 border border-teal-500/30 text-teal-300 text-[10px] font-mono"
                              >
                                {tool}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Install / Status Action */}
                        <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                          <span className="text-[10px] font-mono text-zinc-500">
                            {template.command} {template.args[1] ? template.args[1].split('/').pop() : ''}
                          </span>

                          {isInstalled ? (
                            <button
                              onClick={() => setActiveTab('servers')}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Terpasang</span>
                            </button>
                          ) : (
                            <button
                              disabled={isInstalling}
                              onClick={() => handleInstallTemplate(template)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-semibold shadow-md shadow-teal-950/40 transition disabled:opacity-50"
                            >
                              {isInstalling ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span>Memasang...</span>
                                </>
                              ) : (
                                <>
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Pasang (1-Klik)</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: INSTALLED SERVERS & TOOL RUNNER */}
          {activeTab === 'servers' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-full">
              {/* Left Column: Servers List */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Server Terhubung ({servers.length})
                  </h3>
                  <button
                    onClick={() => setActiveTab('add-custom')}
                    className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Tambah</span>
                  </button>
                </div>

                {servers.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs border border-dashed border-zinc-800 rounded-2xl space-y-3">
                    <p>Belum ada MCP server yang dipasang di workspace ini.</p>
                    <button
                      onClick={() => setActiveTab('marketplace')}
                      className="px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow"
                    >
                      Buka Katalog Template
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {servers.map((server) => {
                      const isTesting = testingServerId === server.id;
                      const isConnected = server.status === 'CONNECTED';
                      const isError = server.status === 'ERROR';

                      return (
                        <div
                          key={server.id}
                          className="p-3.5 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 transition space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : isError ? 'bg-red-400' : 'bg-amber-400'}`} />
                                <h4 className="text-xs font-bold text-white">{server.name}</h4>
                                <span className="text-[10px] font-mono text-zinc-400 uppercase bg-zinc-800 px-1 rounded">
                                  {server.transport}
                                </span>
                              </div>
                              {server.description && (
                                <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                                  {server.description}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={(e) => handleTestServer(server.id, e)}
                                disabled={isTesting}
                                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-slate-300 hover:text-teal-400 border border-zinc-700/60 transition"
                                title="Uji Koneksi & Refresh Tools"
                              >
                                <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-teal-400' : ''}`} />
                              </button>
                              <button
                                onClick={(e) => handleDeleteServer(server.id, server.name, e)}
                                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-zinc-700/60 transition"
                                title="Hapus Server"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Tools List Preview */}
                          <div className="pt-2 border-t border-zinc-800/80">
                            <span className="text-[10px] text-slate-400 block mb-1">
                              Tools Tersedia ({server.toolsCache?.length || 0}):
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {(!server.toolsCache || server.toolsCache.length === 0) ? (
                                <span className="text-[10px] text-zinc-500 italic">Belum ada tool terdeteksi. Klik tombol refresh di atas.</span>
                              ) : (
                                server.toolsCache.map((tool) => (
                                  <button
                                    key={tool.name}
                                    onClick={() => {
                                      setSelectedTool(tool);
                                      setToolCallResult(null);
                                      // generate sample args if schema properties exist
                                      const sampleArgs: Record<string, any> = {};
                                      if (tool.inputSchema?.properties) {
                                        Object.keys(tool.inputSchema.properties).forEach(prop => {
                                          sampleArgs[prop] = '';
                                        });
                                      }
                                      setToolArgsJson(JSON.stringify(sampleArgs, null, 2));
                                    }}
                                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition flex items-center gap-1 ${
                                      selectedTool?.name === tool.name && selectedTool?.serverId === tool.serverId
                                        ? 'bg-teal-500 text-slate-950 font-bold shadow'
                                        : 'bg-zinc-800 text-teal-300 hover:bg-zinc-700'
                                    }`}
                                  >
                                    <Terminal className="w-2.5 h-2.5" />
                                    <span>{tool.name}</span>
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right Column: Interactive Tool Tester */}
              <div className="lg:col-span-7 bg-zinc-950/60 border border-zinc-800 rounded-2xl p-4 flex flex-col space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-teal-400" />
                    <h3 className="text-xs font-bold text-white">
                      Uji Coba Eksekusi Tool (Interactive Tester)
                    </h3>
                  </div>
                  {selectedTool && (
                    <span className="text-[11px] font-mono text-teal-400 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-500/30">
                      {selectedTool.serverName} / {selectedTool.name}
                    </span>
                  )}
                </div>

                {!selectedTool ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 text-xs space-y-2">
                    <Boxes className="w-8 h-8 text-zinc-600" />
                    <p>Pilih salah satu tool dari daftar server di sebelah kiri untuk menguji parameternya.</p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col space-y-3">
                    {selectedTool.description && (
                      <p className="text-xs text-slate-300 bg-zinc-900 p-2.5 rounded-xl border border-zinc-800">
                        {selectedTool.description}
                      </p>
                    )}

                    {/* Parameter Input JSON */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-300">
                          Argumen Masukan (JSON Format)
                        </label>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          Required: {selectedTool.inputSchema?.required?.join(', ') || 'none'}
                        </span>
                      </div>
                      <textarea
                        value={toolArgsJson}
                        onChange={(e) => setToolArgsJson(e.target.value)}
                        rows={5}
                        className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono text-xs focus:outline-none focus:border-teal-500 resize-none"
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={handleExecuteTool}
                        disabled={callingTool}
                        className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow transition disabled:opacity-50"
                      >
                        {callingTool ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Mengeksekusi...</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5" />
                            <span>⚡ Jalankan Tool</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Execution Result Box */}
                    {toolCallResult && (
                      <div className="pt-2 border-t border-zinc-800 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            {toolCallResult.isError ? (
                              <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            )}
                            <span>Hasil Respon MCP:</span>
                          </span>
                        </div>
                        <pre className="p-3 rounded-xl bg-black border border-zinc-800 text-teal-300 font-mono text-xs overflow-x-auto max-h-48 whitespace-pre-wrap">
                          {JSON.stringify(toolCallResult, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: ADD CUSTOM SERVER */}
          {activeTab === 'add-custom' && (
            <div className="max-w-2xl mx-auto space-y-4 py-2">
              <div className="border-b border-zinc-800 pb-2">
                <h3 className="text-sm font-bold text-white">Daftarkan MCP Server Kustom</h3>
                <p className="text-xs text-slate-400">
                  Tambahkan server MCP lokal atau remote menggunakan standar stdio CLI atau Server-Sent Events (SSE).
                </p>
              </div>

              <form onSubmit={handleAddCustomServer} className="space-y-4 text-xs">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Nama Server</label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. Custom Node.js Tool Server"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-teal-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Deskripsi Singkat</label>
                  <input
                    type="text"
                    value={customDescription}
                    onChange={(e) => setCustomDescription(e.target.value)}
                    placeholder="e.g. Menyediakan tool otomasi deployment dan data analytics"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Tipe Transport</label>
                    <select
                      value={customTransport}
                      onChange={(e) => setCustomTransport(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white focus:outline-none focus:border-teal-500"
                    >
                      <option value="stdio">stdio (Local Command Process)</option>
                      <option value="sse">sse (HTTP Server-Sent Events)</option>
                    </select>
                  </div>

                  {customTransport === 'stdio' ? (
                    <div>
                      <label className="text-slate-300 font-semibold block mb-1">Command Eksekutor</label>
                      <input
                        type="text"
                        value={customCommand}
                        onChange={(e) => setCustomCommand(e.target.value)}
                        placeholder="npx / python3 / node / docker"
                        className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="text-slate-300 font-semibold block mb-1">Endpoint SSE URL</label>
                      <input
                        type="url"
                        value={customUrl}
                        onChange={(e) => setCustomUrl(e.target.value)}
                        placeholder="http://localhost:8080/events"
                        className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono focus:outline-none focus:border-teal-500"
                        required
                      />
                    </div>
                  )}
                </div>

                {customTransport === 'stdio' && (
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">
                      Arguments (pisahkan dengan spasi)
                    </label>
                    <input
                      type="text"
                      value={customArgs}
                      onChange={(e) => setCustomArgs(e.target.value)}
                      placeholder="-y @modelcontextprotocol/server-postgres postgresql://..."
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono focus:outline-none focus:border-teal-500"
                    />
                  </div>
                )}

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">
                    Environment Variables (satu baris per variabel: KEY=VALUE)
                  </label>
                  <textarea
                    value={customEnv}
                    onChange={(e) => setCustomEnv(e.target.value)}
                    placeholder="API_KEY=sk_live_xxxx&#10;DEBUG=true"
                    rows={3}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono focus:outline-none focus:border-teal-500 resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setActiveTab('marketplace')}
                    className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-slate-300 font-semibold transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingCustom}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-semibold flex items-center gap-1.5 shadow-lg shadow-teal-950/40 transition disabled:opacity-50"
                  >
                    {isSubmittingCustom && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Daftarkan & Jabat Tangan (Handshake)</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-zinc-800/80 bg-zinc-950/80 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-400" />
            <span>Anthropic Model Context Protocol Client Ready</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-slate-300 font-semibold transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
