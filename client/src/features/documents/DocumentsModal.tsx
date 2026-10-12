import React, { useState, useEffect } from 'react';
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
  Download
} from 'lucide-react';
import { api } from '../../services/api.js';
import { DocumentItem, DocumentCategory, Project } from '../../../../shared/types.js';
import { useFeedback } from '../../components/common/FeedbackContext.js';
import { CustomSelect } from '../../components/common/CustomSelect.js';

interface DocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects?: Project[];
}

const CATEGORIES: DocumentCategory[] = ['SOP', 'SPEC', 'PROMPT_TEMPLATE', 'ARCHITECTURE', 'NOTE'];

export const DocumentsModal: React.FC<DocumentsModalProps> = ({ isOpen, onClose, projects = [] }) => {
  const { toast, confirm } = useFeedback();
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

  useEffect(() => {
    if (isOpen) {
      fetchDocs();
    }
  }, [isOpen, selectedCategory]);

  // Handle Escape key to close modal
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
    if (!formTitle.trim() || !formContent.trim()) {
      setStatusMessage({ type: 'error', text: 'Judul dan isi dokumen wajib diisi.' });
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
        setStatusMessage({ type: 'success', text: 'Dokumen baru berhasil dibuat.' });
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
        setStatusMessage({ type: 'success', text: 'Dokumen berhasil diperbarui.' });
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
      message: 'Apakah Anda yakin ingin menghapus dokumen ini secara permanen dari Knowledge Base?',
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
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Gagal menghapus dokumen.' });
      toast.error(err.message || 'Gagal menghapus dokumen.', 'Penghapusan Gagal');
    } finally {
      setLoading(false);
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

  const filteredDocs = documents.filter((d) => {
    const matchesSearch =
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  if (!isOpen) return null;

  const isMobileDetailView = Boolean(selectedDoc || isCreating || isEditing);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-6xl h-[92vh] sm:h-[88vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3.5 sm:px-6 py-3 sm:py-4 border-b border-slate-800 bg-slate-800/40 gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide truncate">
                Knowledge Base & SOP
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 hidden sm:block truncate">
                Pusat referensi SOP, arsitektur, prompt template, dan dokumentasi kerja AI Team
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportAllDocs}
              className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 sm:py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition"
              title="Ekspor Semua Dokumen ke file JSON"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Export Semua</span>
            </button>
            <button
              type="button"
              onClick={handleStartCreate}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-md transition-all active:scale-95"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Buat Dokumen</span>
              <span className="sm:hidden">+ Dokumen</span>
            </button>
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

        {/* Content Body: Sidebar + Main Viewer */}
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
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
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
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
              {filteredDocs.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  Tidak ada dokumen ditemukan.
                </div>
              ) : (
                filteredDocs.map((doc) => (
                  <div
                    key={doc.id}
                    onClick={() => handleSelectDoc(doc)}
                    className={`p-3 cursor-pointer transition-colors ${
                      selectedDoc?.id === doc.id && !isCreating
                        ? 'bg-slate-800 border-l-2 border-purple-400'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-purple-400 border border-purple-500/30">
                        {doc.category}
                      </span>
                      <h4 className="text-xs font-semibold text-slate-200 truncate flex-1">
                        {doc.title}
                      </h4>
                    </div>
                    {doc.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {doc.tags.map((t) => (
                          <span
                            key={t}
                            className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Main Panel: Viewer or Editor */}
          <div className={`${!isMobileDetailView ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-slate-900/40 overflow-hidden`}>
            {statusMessage && (
              <div
                className={`p-3 text-xs flex items-center justify-between border-b ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
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
                <button
                  onClick={() => setStatusMessage(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {isCreating || isEditing ? (
              // Form Editor
              <div className="flex-1 p-4 sm:p-6 flex flex-col space-y-4 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setIsEditing(false);
                  }}
                  className="md:hidden flex items-center gap-1.5 text-xs text-purple-400 font-bold mb-2 hover:text-purple-300"
                >
                  ← Kembali ke Daftar Dokumen
                </button>

                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">
                    {isCreating ? 'Buat Dokumen Baru' : 'Edit Dokumen'}
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setIsCreating(false);
                        setIsEditing(false);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={loading}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{loading ? 'Menyimpan...' : 'Simpan'}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Judul Dokumen
                    </label>
                    <input
                      type="text"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="e.g. SOP Deployment Agent"
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Kategori
                    </label>
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
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Tags (pisahkan koma)
                    </label>
                    <input
                      type="text"
                      value={formTags}
                      onChange={(e) => setFormTags(e.target.value)}
                      placeholder="SOP, Security, Onboarding"
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Hubungkan ke Proyek (Opsional)
                    </label>
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

                <div className="flex-1 flex flex-col">
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Isi Dokumen (Markdown Format)
                  </label>
                  <textarea
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    rows={14}
                    className="w-full flex-1 p-3 rounded-lg bg-slate-800 border border-slate-700 font-mono text-xs text-slate-200 leading-relaxed focus:outline-none focus:border-purple-500 resize-none"
                  />
                </div>
              </div>
            ) : selectedDoc ? (
              // Document Viewer
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Mobile Back Button */}
                <div className="px-4 pt-3 pb-0 md:hidden bg-slate-850/40">
                  <button
                    type="button"
                    onClick={() => setSelectedDoc(null)}
                    className="flex items-center gap-1.5 text-xs text-purple-400 font-bold hover:text-purple-300"
                  >
                    ← Kembali ke Daftar Dokumen
                  </button>
                </div>

                <div className="p-4 sm:p-6 border-b border-slate-800/80 bg-slate-850/40 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        {selectedDoc.category}
                      </span>
                      <span className="text-xs text-slate-500">
                        Diperbarui: {new Date(selectedDoc.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-white tracking-wide">
                      {selectedDoc.title}
                    </h2>
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
                  </div>

                  <div className="flex items-center gap-2">
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
      </div>
    </div>
  );
};
