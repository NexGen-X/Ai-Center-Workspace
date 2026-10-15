import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  FileText,
  Plus,
  Search,
  BookOpen,
  Trash2,
  Edit3,
  Save,
  Tag,
  CheckCircle2,
  AlertCircle,
  Download,
  Database,
  BrainCircuit,
  Sparkles,
  RefreshCw,
  Layers,
  Cpu,
  Sliders,
  ExternalLink,
  Bot,
  Upload,
  FileSpreadsheet,
  Globe
} from 'lucide-react';
import { api } from '../../services/api.js';
import {
  DocumentItem,
  DocumentCategory,
  Project,
  RagSearchResult,
  RagIndexStats,
  AgentMemoryItem,
  AgentMemoryType,
  WebSearchResultItem,
  WebBrowseResponse
} from '../../../../shared/types.js';
import { useFeedback } from '../../components/common/FeedbackContext.js';
import { CustomSelect } from '../../components/common/CustomSelect.js';

interface DocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects?: Project[];
}

const CATEGORIES: DocumentCategory[] = ['SOP', 'SPEC', 'PROMPT_TEMPLATE', 'ARCHITECTURE', 'NOTE', 'RESEARCH'];
const MEMORY_TYPES: (AgentMemoryType | 'ALL')[] = ['ALL', 'EPISODIC', 'FACTUAL', 'PREFERENCE', 'GOAL'];

export const DocumentsModal: React.FC<DocumentsModalProps> = ({ isOpen, onClose, projects = [] }) => {
  const { toast, confirm } = useFeedback();

  // Tab State
  const [activeTab, setActiveTab] = useState<'docs' | 'semantic_search' | 'memory_vault' | 'web_research'>('docs');

  // Documents state
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<DocumentCategory>('SOP');
  const [formTags, setFormTags] = useState('');
  const [formProjectId, setFormProjectId] = useState('');
  const [formContent, setFormContent] = useState('');

  // RAG & Vector Memory state
  const [ragStats, setRagStats] = useState<RagIndexStats | null>(null);
  const [indexingDocId, setIndexingDocId] = useState<string | null>(null);
  const [isIndexingAll, setIsIndexingAll] = useState(false);

  // Semantic Search state
  const [semanticQuery, setSemanticQuery] = useState('');
  const [minSimilarity, setMinSimilarity] = useState(35); // 35%
  const [semanticResults, setSemanticResults] = useState<RagSearchResult[]>([]);
  const [isSearchingSemantic, setIsSearchingSemantic] = useState(false);

  // Memory Vault state
  const [memories, setMemories] = useState<AgentMemoryItem[]>([]);
  const [selectedMemoryType, setSelectedMemoryType] = useState<AgentMemoryType | 'ALL'>('ALL');
  const [loadingMemories, setLoadingMemories] = useState(false);

  // Web Research state
  const [webQuery, setWebQuery] = useState('');
  const [webResults, setWebResults] = useState<WebSearchResultItem[]>([]);
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);
  const [browsingUrl, setBrowsingUrl] = useState<string | null>(null);
  const [browsedContent, setBrowsedContent] = useState<WebBrowseResponse | null>(null);
  const [isIngestingWeb, setIsIngestingWeb] = useState(false);

  // File Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Ukuran berkas melebihi batas maksimum 10MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      setIsUploading(true);
      toast.info(`Membaca dan memproses "${file.name}"...`);

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const resultStr = reader.result as string;
          const base64Data = resultStr.includes(',') ? resultStr.split(',')[1] : resultStr;
          if (!base64Data) {
            throw new Error('Gagal membaca data berkas.');
          }

          const res = await api.uploadDocument({
            fileName: file.name,
            fileContentBase64: base64Data,
            fileType: file.type || 'text/plain',
            category: 'SPEC',
            projectId: formProjectId || undefined
          });

          toast.success(`Berkas "${file.name}" berhasil diunggah dan diindeks!`);
          await fetchDocs();
          await fetchRagStats();
          if (res && res.id) {
            setSelectedDoc(res);
          }
        } catch (uploadErr: any) {
          toast.error(uploadErr.message || 'Gagal memproses berkas yang diunggah.', 'Unggah Gagal');
        } finally {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.onerror = () => {
        toast.error('Gagal membaca berkas dari sistem lokal.');
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast.error(err.message || 'Gagal memulai unggah berkas.');
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const fetchDocs = async () => {
    try {
      setLoading(true);
      const categoryParam = selectedCategory === 'ALL' ? undefined : selectedCategory;
      const res = await api.getDocuments(categoryParam);
      setDocuments(res);
      if (res.length > 0 && !selectedDoc && !isCreating) {
        setSelectedDoc(res[0]);
      }
    } catch (err: any) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRagStats = async () => {
    try {
      const stats = await api.getRagStats();
      setRagStats(stats);
    } catch (err) {
      console.error('Failed to fetch RAG stats:', err);
    }
  };

  const fetchMemories = async () => {
    try {
      setLoadingMemories(true);
      const res = await api.getAgentMemories();
      setMemories(res);
    } catch (err) {
      console.error('Failed to load agent memories:', err);
    } finally {
      setLoadingMemories(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDocs();
      fetchRagStats();
      if (activeTab === 'memory_vault') {
        fetchMemories();
      }
    }
  }, [isOpen, selectedCategory, activeTab]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleSelectDoc = (doc: DocumentItem) => {
    setSelectedDoc(doc);
    setIsEditing(false);
    setIsCreating(false);
    setStatusMessage(null);
  };

  const handleStartCreate = () => {
    setActiveTab('docs');
    setIsCreating(true);
    setIsEditing(false);
    setSelectedDoc(null);
    setFormTitle('');
    setFormCategory('SOP');
    setFormTags('');
    setFormProjectId('');
    setFormContent('# Judul Dokumen\n\nTuliskan instruksi atau panduan di sini...');
    setStatusMessage(null);
  };

  const handleStartEdit = (doc: DocumentItem) => {
    setActiveTab('docs');
    setIsEditing(true);
    setIsCreating(false);
    setFormTitle(doc.title);
    setFormCategory(doc.category);
    setFormTags(doc.tags.join(', '));
    setFormProjectId(doc.projectId || '');
    setFormContent(doc.content);
    setStatusMessage(null);
  };

  const handleSave = async () => {
    if (!formTitle.trim()) {
      setStatusMessage({ type: 'error', text: 'Judul dokumen wajib diisi.' });
      return;
    }
    if (!formContent.trim()) {
      setStatusMessage({ type: 'error', text: 'Isi dokumen tidak boleh kosong.' });
      return;
    }

    const tagsArray = formTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      setLoading(true);
      if (isCreating) {
        const created = await api.createDocument({
          title: formTitle,
          content: formContent,
          category: formCategory,
          tags: tagsArray,
          projectId: formProjectId || undefined
        });
        setDocuments([created, ...documents]);
        setSelectedDoc(created);
        setIsCreating(false);
        setStatusMessage({ type: 'success', text: 'Dokumen baru berhasil dibuat dan otomatis diindeks ke pgvector.' });
        toast.success('Dokumen berhasil dibuat dan diindeks ke Knowledge Base.');
        fetchRagStats();
      } else if (isEditing && selectedDoc) {
        const updated = await api.updateDocument(selectedDoc.id, {
          title: formTitle,
          content: formContent,
          category: formCategory,
          tags: tagsArray,
          projectId: formProjectId || undefined
        });
        setDocuments(documents.map((d) => (d.id === updated.id ? updated : d)));
        setSelectedDoc(updated);
        setIsEditing(false);
        setStatusMessage({ type: 'success', text: 'Dokumen berhasil diperbarui dan vektor diperbarui.' });
        toast.success('Dokumen diperbarui dan diindeks ulang ke pgvector.');
        fetchRagStats();
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Gagal menyimpan dokumen.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const isConfirmed = await confirm({
      title: 'Hapus Dokumen',
      message: 'Apakah Anda yakin ingin menghapus dokumen ini beserta semua vektor chunk-nya dari Knowledge Base?',
      confirmText: 'Ya, Hapus Dokumen',
      variant: 'danger'
    });
    if (!isConfirmed) return;

    try {
      setLoading(true);
      await api.deleteDocument(id);
      const updated = documents.filter((d) => d.id !== id);
      setDocuments(updated);
      setSelectedDoc(updated.length > 0 ? updated[0] : null);
      setIsEditing(false);
      setIsCreating(false);
      setStatusMessage({ type: 'success', text: 'Dokumen berhasil dihapus.' });
      toast.success('Dokumen berhasil dihapus dari Knowledge Base.');
      fetchRagStats();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Gagal menghapus dokumen.' });
      toast.error(err.message || 'Gagal menghapus dokumen.', 'Penghapusan Gagal');
    } finally {
      setLoading(false);
    }
  };

  const handleIndexDoc = async (docId: string) => {
    try {
      setIndexingDocId(docId);
      const res = await api.indexDocument(docId);
      toast.success(res.message);
      fetchDocs();
      fetchRagStats();
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengindeks dokumen.');
    } finally {
      setIndexingDocId(null);
    }
  };

  const handleIndexAll = async () => {
    try {
      setIsIndexingAll(true);
      const res = await api.indexAllDocuments();
      toast.success(res.message);
      fetchDocs();
      fetchRagStats();
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengindeks seluruh dokumen.');
    } finally {
      setIsIndexingAll(false);
    }
  };

  const handleSemanticSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!semanticQuery.trim()) {
      toast.warning('Masukkan pertanyaan atau konsep yang ingin dicari.');
      return;
    }

    try {
      setIsSearchingSemantic(true);
      const res = await api.searchRag({
        query: semanticQuery.trim(),
        limit: 6,
        minSimilarity: minSimilarity / 100
      });
      setSemanticResults(res.matches);
      if (res.matches.length === 0) {
        toast.info('Tidak ada potongan pengetahuan dengan kemiripan semantik di atas batas ambang.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Gagal melakukan pencarian semantik.');
    } finally {
      setIsSearchingSemantic(false);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      await api.deleteAgentMemory(id);
      setMemories(memories.filter((m) => m.id !== id));
      toast.success('Memori agen berhasil dihapus.');
      fetchRagStats();
    } catch (err: any) {
      toast.error(err.message || 'Gagal menghapus memori.');
    }
  };

  const handleDownloadMarkdown = (doc: DocumentItem) => {
    const header = `# ${doc.title}\n\n- **Kategori**: ${doc.category}\n- **Tags**: ${doc.tags.join(', ') || 'None'}\n- **Diperbarui**: ${new Date(doc.updatedAt).toISOString()}\n\n---\n\n`;
    const blob = new Blob([header + doc.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.title.toLowerCase().replace(/[^a-z0-9_-]+/g, '-')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Dokumen "${doc.title}" berhasil diunduh sebagai file Markdown (.md).`);
  };

  const handleExportAllDocs = () => {
    if (documents.length === 0) {
      toast.warning('Tidak ada dokumen untuk diekspor.');
      return;
    }
    const blob = new Blob([JSON.stringify(documents, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-center-docs-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`${documents.length} dokumen berhasil diekspor ke file JSON.`);
  };

  const handleWebSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!webQuery.trim()) return;
    setIsSearchingWeb(true);
    setBrowsedContent(null);
    try {
      const res = await api.searchWeb(webQuery.trim(), 6);
      setWebResults(res.results || []);
      if ((res.results || []).length === 0) {
        toast.info('Tidak ada hasil web ditemukan.');
      }
    } catch {
      toast.error('Gagal melakukan pencarian web.');
    } finally {
      setIsSearchingWeb(false);
    }
  };

  const handleBrowsePage = async (url: string) => {
    setBrowsingUrl(url);
    try {
      const browsed = await api.browseWeb(url, 4000);
      setBrowsedContent(browsed);
      toast.success(`Halaman "${browsed.title}" berhasil diekstraksi.`);
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengekstrak halaman web.');
    } finally {
      setBrowsingUrl(null);
    }
  };

  const handleAutonomousIngest = async () => {
    if (!webQuery.trim() || isIngestingWeb) return;
    setIsIngestingWeb(true);
    try {
      const res = await api.researchAndIngest({
        query: webQuery.trim(),
        category: 'RESEARCH'
      });
      toast.success(`Riset "${res.title}" berhasil diindeks (${res.chunksIndexed} chunks) ke pgvector RAG!`);
      fetchDocs();
      fetchRagStats();
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengindeks riset web.');
    } finally {
      setIsIngestingWeb(false);
    }
  };

  const filteredDocs = documents.filter((d) => {
    const matchesSearch =
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  const filteredMemories = memories.filter((m) => {
    if (selectedMemoryType === 'ALL') return true;
    return m.memoryType === selectedMemoryType;
  });

  if (!isOpen) return null;

  const isMobileDetailView = Boolean(selectedDoc || isCreating || isEditing);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-6xl h-[92vh] sm:h-[88vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-800 bg-slate-800/40 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 shrink-0">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-wide truncate">
                  Knowledge Base & RAG Memory
                </h2>
                <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Database className="w-3 h-3" /> pgvector 768d
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 hidden sm:block truncate">
                Pusat referensi SOP, pencarian semantik vektor HNSW, dan memori jangka panjang AI Agent
              </p>
            </div>
          </div>

          {/* Navigation Tab Pills */}
          <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700 text-xs">
            <button
              onClick={() => setActiveTab('docs')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition ${
                activeTab === 'docs'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Dokumen & SOP</span>
              {documents.length > 0 && (
                <span className="ml-0.5 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/60 text-purple-200">
                  {documents.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('semantic_search')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition ${
                activeTab === 'semantic_search'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>RAG Explorer</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('memory_vault');
                fetchMemories();
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition ${
                activeTab === 'memory_vault'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Memori Agen</span>
              {ragStats && ragStats.totalMemories > 0 && (
                <span className="ml-0.5 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/60 text-indigo-200">
                  {ragStats.totalMemories}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('web_research')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition ${
                activeTab === 'web_research'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Web Research & Auto-RAG</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {activeTab === 'docs' && (
              <>
                <button
                  type="button"
                  onClick={handleIndexAll}
                  disabled={isIndexingAll || documents.length === 0}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 sm:py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-400 text-xs font-semibold transition disabled:opacity-50"
                  title="Indeks ulang seluruh dokumen ke vektor chunk pgvector"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isIndexingAll ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Indeks Semua</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportAllDocs}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 sm:py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition"
                  title="Ekspor Semua Dokumen ke file JSON"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Export</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.csv,.json,.txt,.md,application/pdf,text/csv,application/json,text/plain,text/markdown"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
                  title="Unggah berkas PDF, CSV, JSON, atau Markdown ke Knowledge Base"
                >
                  <Upload className={`w-3.5 h-3.5 shrink-0 ${isUploading ? 'animate-bounce' : ''}`} />
                  <span className="hidden sm:inline">{isUploading ? 'Mengunggah...' : 'Unggah Berkas'}</span>
                  <span className="sm:hidden">Unggah</span>
                </button>
                <button
                  type="button"
                  onClick={handleStartCreate}
                  className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-bold text-xs shadow-md transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span>+ Dokumen</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Tutup (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TAB 1: DOKUMEN & SOP */}
        {activeTab === 'docs' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left Sidebar: Filters & List */}
            <div className={`${isMobileDetailView ? 'hidden md:flex' : 'flex'} w-full md:w-80 border-r border-slate-800 bg-slate-900/60 flex-col shrink-0`}>
              {/* Search */}
              <div className="p-3 border-b border-slate-800/80">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari judul / tag..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Category Pills */}
              <div className="p-3 border-b border-slate-800/80 flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedCategory('ALL')}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                    selectedCategory === 'ALL'
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      : 'text-slate-400 hover:text-white bg-slate-800/60'
                  }`}
                >
                  Semua
                </button>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                      selectedCategory === cat
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                        : 'text-slate-400 hover:text-white bg-slate-800/60'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Document List */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50">
                {loading && documents.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">Memuat dokumen...</div>
                ) : filteredDocs.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">Tidak ada dokumen ditemukan.</div>
                ) : (
                  filteredDocs.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => handleSelectDoc(doc)}
                      className={`p-3.5 cursor-pointer transition-all ${
                        selectedDoc?.id === doc.id && !isCreating
                          ? 'bg-purple-500/10 border-l-4 border-purple-500'
                          : 'hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-purple-300 border border-purple-500/20">
                            {doc.category}
                          </span>
                          {doc.fileMetadata?.parsedFormat && (
                            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                              {doc.fileMetadata.parsedFormat}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {doc.chunkCount && doc.chunkCount > 0 ? (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" title="Terindeks ke pgvector">
                              {doc.chunkCount} chunk
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20" title="Belum diindeks">
                              unindexed
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500">
                            {new Date(doc.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <h3 className="text-xs font-semibold text-slate-200 line-clamp-1">{doc.title}</h3>
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">{doc.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Pane: Document Viewer / Editor */}
            <div className={`${!isMobileDetailView ? 'hidden md:flex' : 'flex'} flex-1 flex-col overflow-hidden bg-slate-900/40`}>
              {statusMessage && (
                <div
                  className={`px-4 py-2 text-xs flex items-center justify-between border-b ${
                    statusMessage.type === 'success'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {statusMessage.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{statusMessage.text}</span>
                  </div>
                  <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {isCreating || isEditing ? (
                // Form Editor
                <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                      <Edit3 className="w-4 h-4 text-purple-400" />
                      {isCreating ? 'Buat Dokumen Baru' : 'Edit Dokumen'}
                    </h3>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreating(false);
                          setIsEditing(false);
                          if (documents.length > 0 && !selectedDoc) setSelectedDoc(documents[0]);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-xs transition"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        <span>{loading ? 'Menyimpan...' : 'Simpan Dokumen'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-400 mb-1">Judul Dokumen *</label>
                      <input
                        type="text"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        placeholder="Contoh: SOP Penanganan Insiden Keamanan Sistem"
                        className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Kategori</label>
                      <CustomSelect
                        value={formCategory}
                        onChange={(val) => setFormCategory(val as DocumentCategory)}
                        options={CATEGORIES.map((cat) => ({
                          value: cat,
                          label: cat,
                          badge: cat,
                          badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                        }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Tags (pisahkan koma)</label>
                      <input
                        type="text"
                        value={formTags}
                        onChange={(e) => setFormTags(e.target.value)}
                        placeholder="SOP, Security, Onboarding"
                        className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Hubungkan ke Proyek</label>
                      <CustomSelect
                        value={formProjectId}
                        onChange={(val) => setFormProjectId(val)}
                        options={[
                          { value: '', label: '(Tanpa Proyek Khusus)' },
                          ...projects.map((p) => ({ value: p.id, label: p.name }))
                        ]}
                        placeholder="Pilih Proyek..."
                      />
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col min-h-[300px]">
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Isi Dokumen (Format Markdown) *
                    </label>
                    <textarea
                      value={formContent}
                      onChange={(e) => setFormContent(e.target.value)}
                      rows={14}
                      className="w-full flex-1 p-3.5 rounded-lg bg-slate-800 border border-slate-700 font-mono text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-purple-500 resize-none"
                    />
                  </div>
                </div>
              ) : selectedDoc ? (
                // Document Viewer
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="px-4 pt-3 pb-0 md:hidden bg-slate-850/40">
                    <button
                      type="button"
                      onClick={() => setSelectedDoc(null)}
                      className="flex items-center gap-1.5 text-xs text-purple-400 font-bold hover:text-purple-300"
                    >
                      ← Kembali ke Daftar Dokumen
                    </button>
                  </div>

                  <div className="p-4 sm:p-6 border-b border-slate-800/80 bg-slate-850/40 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {selectedDoc.category}
                        </span>
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1">
                          <Database className="w-3 h-3" />
                          {selectedDoc.chunkCount ?? 0} Vektor Chunk
                        </span>
                        <span className="text-xs text-slate-500">
                          Diperbarui: {new Date(selectedDoc.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h2 className="text-xl font-bold text-white tracking-wide">{selectedDoc.title}</h2>
                      {selectedDoc.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {selectedDoc.tags.map((t) => (
                            <span
                              key={t}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-cyan-300 border border-slate-700"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                      {selectedDoc.fileMetadata && selectedDoc.fileMetadata.originalFileName && (
                        <div className="flex flex-wrap items-center gap-2 mt-2.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300">
                          <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="font-mono text-emerald-300 font-medium">
                            {selectedDoc.fileMetadata.originalFileName}
                          </span>
                          {selectedDoc.fileMetadata.fileSize && (
                            <span className="text-[11px] text-slate-400">
                              ({(selectedDoc.fileMetadata.fileSize / 1024).toFixed(1)} KB)
                            </span>
                          )}
                          {selectedDoc.fileMetadata.rowCount !== undefined && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              {selectedDoc.fileMetadata.rowCount} baris
                            </span>
                          )}
                          {selectedDoc.fileMetadata.parsedFormat && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                              {selectedDoc.fileMetadata.parsedFormat}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleIndexDoc(selectedDoc.id)}
                        disabled={indexingDocId === selectedDoc.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-xs font-semibold transition"
                        title="Indeks ulang dokumen ini ke pgvector"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${indexingDocId === selectedDoc.id ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">Indeks Vektor</span>
                      </button>
                      <button
                        onClick={() => handleDownloadMarkdown(selectedDoc)}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-400 hover:text-cyan-300 transition-colors"
                        title="Unduh sebagai Markdown (.md)"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleStartEdit(selectedDoc)}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors"
                        title="Edit Dokumen"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(selectedDoc.id)}
                        className="p-2 rounded-lg bg-slate-800 hover:bg-rose-900/40 border border-slate-700 text-rose-400 hover:text-rose-300 transition-colors"
                        title="Hapus Dokumen"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 p-6 overflow-y-auto">
                    <div className="prose prose-invert max-w-none text-slate-300 font-sans text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                      {selectedDoc.content}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-500 text-xs">
                  <FileText className="w-12 h-12 text-slate-600 mb-3" />
                  <p>Pilih dokumen dari daftar di sebelah kiri atau buat dokumen baru.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: RAG SEMANTIC EXPLORER */}
        {activeTab === 'semantic_search' && (
          <div className="flex-1 flex flex-col overflow-hidden p-4 sm:p-6 bg-slate-900/60 space-y-4">
            {/* Search Header Bar */}
            <div className="p-4 rounded-xl bg-slate-850/80 border border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <form onSubmit={handleSemanticSearch} className="flex-1 relative flex items-center">
                  <Search className="w-4 h-4 absolute left-3 text-cyan-400" />
                  <input
                    type="text"
                    value={semanticQuery}
                    onChange={(e) => setSemanticQuery(e.target.value)}
                    placeholder="Ketik pertanyaan atau konsep (mis: 'Bagaimana prosedur deploy Kubernetes cluster?')..."
                    className="w-full pl-9 pr-24 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="submit"
                    disabled={isSearchingSemantic}
                    className="absolute right-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow transition disabled:opacity-50"
                  >
                    {isSearchingSemantic ? 'Mencari...' : 'Cari Vektor'}
                  </button>
                </form>

                <div className="flex items-center gap-3 px-3 py-2 bg-slate-900 rounded-xl border border-slate-700 shrink-0">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-xs text-slate-300 whitespace-nowrap">Ambang Relevansi:</span>
                  <input
                    type="range"
                    min="20"
                    max="90"
                    step="5"
                    value={minSimilarity}
                    onChange={(e) => setMinSimilarity(Number(e.target.value))}
                    className="w-20 sm:w-28 accent-cyan-500 cursor-pointer"
                  />
                  <span className="text-xs font-mono font-bold text-cyan-400 w-8">{minSimilarity}%</span>
                </div>
              </div>
            </div>

            {/* Results Grid / List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {isSearchingSemantic ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-xs gap-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
                  <span>Mengonversi query ke 768-dimensi embedding & mencari di pgvector HNSW...</span>
                </div>
              ) : semanticResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500 text-xs space-y-2">
                  <Sparkles className="w-10 h-10 text-slate-600" />
                  <p className="font-semibold text-slate-400">RAG Semantic Vector Search Engine</p>
                  <p className="max-w-md">
                    Masukkan pertanyaan atau frase pencarian di atas untuk menguji pencarian semantik vektor. Sistem akan mencocokkan kemiripan kosinus (cosine similarity) terhadap seluruh potongan dokumen.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-slate-400 flex items-center justify-between">
                    <span>Ditemukan {semanticResults.length} chunk vektor dengan relevansi &gt;= {minSimilarity}%</span>
                    <span className="text-[11px] text-cyan-400 font-mono">pgvector Cosine Distance: 1 - &lt;=&gt;</span>
                  </div>

                  {semanticResults.map((result, idx) => (
                    <div
                      key={result.chunkId}
                      className="p-4 rounded-xl bg-slate-850 border border-slate-800 hover:border-cyan-500/40 transition-all space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            #{idx + 1}
                          </span>
                          <h4 className="text-sm font-bold text-white tracking-wide">{result.documentTitle}</h4>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-purple-300 border border-purple-500/20">
                            {result.category}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-400">Relevansi:</span>
                            <div className="w-20 bg-slate-800 rounded-full h-2 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full rounded-full"
                                style={{ width: `${Math.min(100, Math.max(0, result.similarity * 100))}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono font-bold text-cyan-400">
                              {(result.similarity * 100).toFixed(1)}%
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500" title="Cosine Distance">
                            d={result.distance.toFixed(3)}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {result.content}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                        <span>Chunk #{result.chunkIndex + 1} (ID: {result.chunkId})</span>
                        <button
                          onClick={() => {
                            const found = documents.find((d) => d.id === result.documentId);
                            if (found) {
                              setSelectedDoc(found);
                              setActiveTab('docs');
                            }
                          }}
                          className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-medium"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Buka Dokumen Lengkap
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: AGENT MEMORY VAULT */}
        {activeTab === 'memory_vault' && (
          <div className="flex-1 flex flex-col overflow-hidden p-4 sm:p-6 bg-slate-900/60 space-y-4">
            {/* Header / Filter Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-850 border border-slate-800">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-white">Memori Jangka Panjang AI Agent:</span>
                <span className="text-xs text-slate-400">
                  Wawasan, fakta, dan preferensi yang dipelajari agen secara otonom saat mengeksekusi tugas.
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Filter Tipe:</span>
                <div className="flex items-center gap-1">
                  {MEMORY_TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => setSelectedMemoryType(t)}
                      className={`px-2 py-1 rounded text-[11px] font-semibold transition ${
                        selectedMemoryType === t
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <button
                  onClick={fetchMemories}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                  title="Segarkan Memori"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingMemories ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Memories List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {loadingMemories ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-xs gap-3">
                  <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
                  <span>Memuat arsip memori agen...</span>
                </div>
              ) : filteredMemories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500 text-xs space-y-2">
                  <Database className="w-10 h-10 text-slate-600" />
                  <p className="font-semibold text-slate-400">Belum Ada Memori Tersimpan</p>
                  <p className="max-w-md">
                    Memori jangka panjang akan otomatis direkam saat AI Agent menyelesaikan tugas atau ketika agen mengeksekusi tool <code className="text-indigo-400">memory_store</code>.
                  </p>
                </div>
              ) : (
                filteredMemories.map((mem) => (
                  <div
                    key={mem.id}
                    className="p-4 rounded-xl bg-slate-850 border border-slate-800 hover:border-indigo-500/40 transition-all space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold border ${
                            mem.memoryType === 'FACTUAL'
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                              : mem.memoryType === 'PREFERENCE'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : mem.memoryType === 'GOAL'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                              : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                          }`}
                        >
                          {mem.memoryType}
                        </span>
                        <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <Bot className="w-3.5 h-3.5 text-indigo-400" />
                          {mem.agentName || mem.agentId}
                        </span>
                        {mem.taskTitle && (
                          <span className="text-[11px] text-slate-400 truncate max-w-xs" title={mem.taskTitle}>
                            • Task: {mem.taskTitle}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1" title={`Importance Score: ${mem.importanceScore}`}>
                          <span className="text-[10px] text-slate-400">Penting:</span>
                          <span className="text-xs font-mono font-bold text-amber-400">
                            {(mem.importanceScore * 100).toFixed(0)}%
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {new Date(mem.createdAt).toLocaleString()}
                        </span>
                        <button
                          onClick={() => handleDeleteMemory(mem.id)}
                          className="p-1 rounded text-slate-500 hover:text-rose-400 transition"
                          title="Hapus Memori Ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200 leading-relaxed font-sans">
                      {mem.keyPoint}
                    </div>

                    {mem.context && (
                      <p className="text-[11px] text-slate-400 italic">
                        Konteks: {mem.context}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: AUTONOMOUS WEB RESEARCH & AUTO-INGESTION */}
        {activeTab === 'web_research' && (
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Left Column: Search & Results */}
            <div className="w-full md:w-1/2 border-r border-slate-800 flex flex-col overflow-hidden bg-slate-900/60">
              <div className="p-4 border-b border-slate-800 bg-slate-950/50">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Autonomous Web Intelligence & Live Crawl
                  </h4>
                </div>
                <form onSubmit={handleWebSearch} className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Cari dokumentasi API, spesifikasi kernel, CVE security..."
                      value={webQuery}
                      onChange={(e) => setWebQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearchingWeb || !webQuery.trim()}
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md"
                  >
                    <Search className={`w-3.5 h-3.5 ${isSearchingWeb ? 'animate-spin' : ''}`} />
                    <span>{isSearchingWeb ? 'Mencari...' : 'Cari'}</span>
                  </button>
                </form>

                {/* 1-Click Auto-Ingest to RAG */}
                <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                  <p className="text-[11px] text-slate-400">
                    Otomatis cari, rangkum, dan indeks langsung ke basis pengetahuan vektor pgvector:
                  </p>
                  <button
                    type="button"
                    onClick={handleAutonomousIngest}
                    disabled={isIngestingWeb || !webQuery.trim()}
                    className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shrink-0"
                    title="Jalankan riset otonom dan simpan ke pgvector RAG"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isIngestingWeb ? 'animate-spin' : ''}`} />
                    <span>{isIngestingWeb ? 'Mengindeks...' : '1-Click Auto-RAG'}</span>
                  </button>
                </div>
              </div>

              {/* Web Results List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {isSearchingWeb ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-cyan-400" />
                    Menelusuri web secara real-time...
                  </div>
                ) : webResults.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                    Ketik topik atau spesifikasi teknis pada kolom pencarian di atas untuk menelusuri web publik secara otonom.
                  </div>
                ) : (
                  webResults.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-slate-850 border border-slate-800 hover:border-cyan-500/40 transition space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-xs text-cyan-300 hover:text-cyan-200 hover:underline flex items-center gap-1 leading-snug"
                        >
                          <span>{item.title}</span>
                          <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
                        </a>
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono truncate">{item.url}</p>
                      <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">{item.snippet}</p>

                      <div className="pt-1.5 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleBrowsePage(item.url)}
                          disabled={browsingUrl === item.url}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-400 hover:text-cyan-300 text-[11px] font-semibold flex items-center gap-1 transition"
                        >
                          <BookOpen className="w-3 h-3" />
                          <span>{browsingUrl === item.url ? 'Mengekstrak...' : 'Ekstrak & Baca Markdown'}</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Column: Markdown Article Preview */}
            <div className="w-full md:w-1/2 flex flex-col overflow-hidden bg-slate-900">
              <div className="p-3.5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-400" />
                  Pratinjau Artikel Markdown Hasil Ekstraksi
                </span>
                {browsedContent && (
                  <span className="text-[10px] font-mono text-slate-500">
                    {browsedContent.contentLength} karakter
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                {browsingUrl ? (
                  <div className="p-12 text-center text-xs text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
                    Mengambil dan membersihkan markup halaman web ke format Markdown...
                  </div>
                ) : browsedContent ? (
                  <div className="space-y-4">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <h3 className="text-sm font-bold text-white mb-1">{browsedContent.title}</h3>
                      <p className="text-[10px] text-cyan-400 font-mono break-all mb-1">{browsedContent.url}</p>
                      {browsedContent.metaDescription && (
                        <p className="text-xs text-slate-400 italic">{browsedContent.metaDescription}</p>
                      )}
                    </div>
                    <div className="prose prose-invert prose-xs max-w-none whitespace-pre-wrap leading-relaxed font-mono bg-slate-950/50 p-4 rounded-xl border border-slate-800/80">
                      {browsedContent.markdownContent}
                    </div>
                  </div>
                ) : (
                  <div className="p-12 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl">
                    Pilih salah satu hasil penelusuran di sebelah kiri dan klik <strong>"Ekstrak & Baca Markdown"</strong> untuk membaca konten halaman web yang bersih dari iklan dan skrip.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Telemetry Status Footer */}
        <div className="px-4 sm:px-6 py-2.5 border-t border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Engine: {ragStats?.storageEngine || 'PostgreSQL + pgvector (HNSW)'}
            </span>
            <span className="text-slate-600">|</span>
            <span>Dimensi: {ragStats?.embeddingDimensions || 768}d</span>
          </div>

          <div className="flex items-center gap-4 font-mono text-slate-400">
            <span>Dokumen: <strong className="text-white">{ragStats?.totalDocuments ?? documents.length}</strong></span>
            <span>Chunk Vektor: <strong className="text-cyan-400">{ragStats?.totalChunks ?? 0}</strong></span>
            <span>Memori Agen: <strong className="text-indigo-400">{ragStats?.totalMemories ?? 0}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
};
