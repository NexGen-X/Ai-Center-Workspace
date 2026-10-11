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
  Folder,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { api } from '../../services/api.js';
import { DocumentItem, DocumentCategory, Project } from '../../../../shared/types.js';

interface DocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects?: Project[];
}

const CATEGORIES: DocumentCategory[] = ['SOP', 'SPEC', 'PROMPT_TEMPLATE', 'ARCHITECTURE', 'NOTE'];

export const DocumentsModal: React.FC<DocumentsModalProps> = ({ isOpen, onClose, projects = [] }) => {
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
    if (!confirm('Apakah Anda yakin ingin menghapus dokumen ini?')) return;
    try {
      setLoading(true);
      await api.deleteDocument(id);
      const updated = documents.filter((d) => d.id !== id);
      setDocuments(updated);
      setSelectedDoc(updated.length > 0 ? updated[0] : null);
      setIsEditing(false);
      setIsCreating(false);
      setStatusMessage({ type: 'success', text: 'Dokumen berhasil dihapus.' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Gagal menghapus dokumen.' });
    } finally {
      setLoading(false);
    }
  };

  const filteredDocs = documents.filter((d) => {
    const matchesSearch =
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-6xl h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">
                Knowledge Base & Dokumen SOP
              </h2>
              <p className="text-xs text-slate-400">
                Pusat referensi SOP, arsitektur, prompt template, dan dokumentasi kerja AI Team
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleStartCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Dokumen</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body: Sidebar + Main Viewer */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar: Filters & List */}
          <div className="w-80 border-r border-slate-800 bg-slate-900/60 flex flex-col">
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
          <div className="flex-1 flex flex-col bg-slate-900/40 overflow-hidden">
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
              <div className="flex-1 p-6 flex flex-col space-y-4 overflow-y-auto">
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
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as DocumentCategory)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
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
                    <select
                      value={formProjectId}
                      onChange={(e) => setFormProjectId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-purple-500"
                    >
                      <option value="">(Tanpa Proyek Khusus)</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
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
                <div className="p-6 border-b border-slate-800/80 bg-slate-850/40 flex items-start justify-between">
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
