import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Brain,
  Network,
  Share2,
  Trash2,
  Plus,
  Search,
  RefreshCw,
  Sliders,
  X,
  Layers,
  Bot,
  Sparkles,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  GitMerge
} from 'lucide-react';
import { api } from '../../services/api.js';
import { useFeedback } from '../../components/common/FeedbackContext.js';
import {
  AIAgent,
  MemoryGraphData,
  MemoryGraphNode,
  MemoryGraphEdge,
  AgentMemoryType,
  StoreMemoryRequest,
  PruneMemoriesRequest,
  ShareMemoryRequest,
  ConsolidateMemoriesRequest
} from '../../../../shared/types.js';

interface MemoryGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  agents: AIAgent[];
}

export const MemoryGraphModal: React.FC<MemoryGraphModalProps> = ({
  isOpen,
  onClose,
  agents
}) => {
  const { toast } = useFeedback();
  const notify = useCallback((msg: string, type: 'success' | 'error' | 'warning' = 'success') => {
    if (type === 'success') toast.success(msg);
    else if (type === 'error') toast.error(msg);
    else if (type === 'warning') toast.warning(msg);
  }, [toast]);

  // Graph state
  const [graphData, setGraphData] = useState<MemoryGraphData | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('ALL');
  const [selectedMemoryType, setSelectedMemoryType] = useState<string>('ALL');
  const [minSimilarity, setMinSimilarity] = useState<number>(0.30);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Interaction state
  const [selectedNode, setSelectedNode] = useState<MemoryGraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<MemoryGraphNode | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);

  // Sub-dialogs
  const [isTeachOpen, setIsTeachOpen] = useState(false);
  const [isPruneOpen, setIsPruneOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isConsolidateOpen, setIsConsolidateOpen] = useState(false);

  // Teach Agent Form State
  const [teachAgentId, setTeachAgentId] = useState<string>('');
  const [teachType, setTeachType] = useState<AgentMemoryType>('FACTUAL');
  const [teachKeyPoint, setTeachKeyPoint] = useState<string>('');
  const [teachContext, setTeachContext] = useState<string>('');
  const [teachImportance, setTeachImportance] = useState<number>(0.8);
  const [isSubmittingTeach, setIsSubmittingTeach] = useState(false);

  // Prune State
  const [pruneThreshold, setPruneThreshold] = useState<number>(0.4);
  const [isPruning, setIsPruning] = useState(false);

  // Share State
  const [shareTargetAgentIds, setShareTargetAgentIds] = useState<string[]>([]);
  const [isSharing, setIsSharing] = useState(false);

  // Consolidate State
  const [consolidateSecondId, setConsolidateSecondId] = useState<string>('');
  const [consolidateType, setConsolidateType] = useState<AgentMemoryType>('FACTUAL');
  const [consolidateKeyPoint, setConsolidateKeyPoint] = useState<string>('');
  const [isConsolidating, setIsConsolidating] = useState(false);

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Escape key listener for modal interaction contract
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isTeachOpen) setIsTeachOpen(false);
        else if (isPruneOpen) setIsPruneOpen(false);
        else if (isShareOpen) setIsShareOpen(false);
        else if (isConsolidateOpen) setIsConsolidateOpen(false);
        else if (selectedNode) setSelectedNode(null);
        else onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isTeachOpen, isPruneOpen, isShareOpen, isConsolidateOpen, selectedNode, onClose]);

  // Load Graph Data
  const loadGraph = useCallback(async () => {
    if (!isOpen) return;
    try {
      setLoading(true);
      const res = await api.getMemoryGraph({
        agentId: selectedAgentId === 'ALL' ? undefined : selectedAgentId,
        memoryType: selectedMemoryType === 'ALL' ? undefined : selectedMemoryType,
        minSimilarity,
        searchQuery: searchQuery.trim() || undefined
      });
      setGraphData(res);
    } catch (err: any) {
      notify(err?.message || 'Gagal memuat memory graph', 'error');
    } finally {
      setLoading(false);
    }
  }, [isOpen, selectedAgentId, selectedMemoryType, minSimilarity, searchQuery, notify]);

  useEffect(() => {
    if (isOpen) {
      loadGraph();
      if (agents.length > 0 && !teachAgentId) {
        setTeachAgentId(agents[0].id);
      }
    }
  }, [isOpen, loadGraph, agents]);

  // Simple Spring physics stabilization loop
  useEffect(() => {
    if (!graphData || graphData.nodes.length === 0) return;

    let animId: number;
    let iteration = 0;
    const maxIterations = 25; // Pre-warm layout quickly

    const stepSimulation = () => {
      if (iteration >= maxIterations) return;
      iteration++;

      setGraphData(prev => {
        if (!prev) return null;
        const nodes = [...prev.nodes];
        const edges = prev.edges;

        // Apply edge attraction
        for (const edge of edges) {
          const source = nodes.find(n => n.id === edge.source);
          const target = nodes.find(n => n.id === edge.target);
          if (source && target && source.x !== undefined && source.y !== undefined && target.x !== undefined && target.y !== undefined) {
            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const targetDist = edge.edgeType === 'AGENT_MEMORY' ? 120 : 160;
            const force = (dist - targetDist) * 0.04 * (edge.weight || 0.5);

            if (source.type !== 'AGENT') {
              source.x += (dx / dist) * force;
              source.y += (dy / dist) * force;
            }
            if (target.type !== 'AGENT') {
              target.x -= (dx / dist) * force;
              target.y -= (dy / dist) * force;
            }
          }
        }

        // Apply node-node repulsion
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const n1 = nodes[i];
            const n2 = nodes[j];
            if (n1.x !== undefined && n1.y !== undefined && n2.x !== undefined && n2.y !== undefined) {
              const dx = n2.x - n1.x;
              const dy = n2.y - n1.y;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              if (dist < 100) {
                const repulse = ((100 - dist) / 100) * 1.5;
                if (n1.type !== 'AGENT') {
                  n1.x -= (dx / dist) * repulse;
                  n1.y -= (dy / dist) * repulse;
                }
                if (n2.type !== 'AGENT') {
                  n2.x += (dx / dist) * repulse;
                  n2.y += (dy / dist) * repulse;
                }
              }
            }
          }
        }

        return { ...prev, nodes };
      });

      animId = requestAnimationFrame(stepSimulation);
    };

    animId = requestAnimationFrame(stepSimulation);
    return () => cancelAnimationFrame(animId);
  }, [graphData?.edges.length]);

  // Handle Teach (Inject Memory)
  const handleTeachSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teachAgentId || !teachKeyPoint.trim()) {
      notify('Pilih agen dan isi poin memori utama.', 'warning');
      return;
    }
    try {
      setIsSubmittingTeach(true);
      await api.storeAgentMemory({
        agentId: teachAgentId,
        memoryType: teachType,
        keyPoint: teachKeyPoint.trim(),
        context: teachContext.trim() || undefined,
        importanceScore: teachImportance
      });
      notify('Memori baru berhasil diinjeksikan ke dalam kognisi agen.', 'success');
      setTeachKeyPoint('');
      setTeachContext('');
      setIsTeachOpen(false);
      await loadGraph();
    } catch (err: any) {
      notify(err?.message || 'Gagal menyimpan memori', 'error');
    } finally {
      setIsSubmittingTeach(false);
    }
  };

  // Handle Prune
  const handlePruneSubmit = async () => {
    try {
      setIsPruning(true);
      const res = await api.pruneMemories({
        thresholdScore: pruneThreshold,
        agentId: selectedAgentId === 'ALL' ? undefined : selectedAgentId
      });
      notify(res.message, 'success');
      setIsPruneOpen(false);
      setSelectedNode(null);
      await loadGraph();
    } catch (err: any) {
      notify(err?.message || 'Gagal memangkas memori', 'error');
    } finally {
      setIsPruning(false);
    }
  };

  // Handle Share
  const handleShareSubmit = async () => {
    if (!selectedNode || shareTargetAgentIds.length === 0) return;
    try {
      setIsSharing(true);
      const res = await api.shareMemory({
        memoryId: selectedNode.id,
        targetAgentIds: shareTargetAgentIds
      });
      notify(res.message, 'success');
      setIsShareOpen(false);
      setShareTargetAgentIds([]);
      await loadGraph();
    } catch (err: any) {
      notify(err?.message || 'Gagal membagikan memori', 'error');
    } finally {
      setIsSharing(false);
    }
  };

  // Handle Consolidate
  const handleConsolidateSubmit = async () => {
    if (!selectedNode || !consolidateSecondId || !consolidateKeyPoint.trim()) {
      notify('Pilih memori kedua dan isi poin sintesis.', 'warning');
      return;
    }
    try {
      setIsConsolidating(true);
      const res = await api.consolidateMemories({
        memoryIds: [selectedNode.id, consolidateSecondId],
        targetMemoryType: consolidateType,
        newKeyPoint: consolidateKeyPoint.trim(),
        targetAgentId: selectedNode.agentId
      });
      notify(res.message, 'success');
      setIsConsolidateOpen(false);
      setConsolidateSecondId('');
      setConsolidateKeyPoint('');
      setSelectedNode(null);
      await loadGraph();
    } catch (err: any) {
      notify(err?.message || 'Gagal mengonsolidasi memori', 'error');
    } finally {
      setIsConsolidating(false);
    }
  };

  // Handle Delete Memory
  const handleDeleteSelectedMemory = async () => {
    if (!selectedNode || selectedNode.type !== 'MEMORY') return;
    if (!window.confirm(`Hapus memori "${selectedNode.label}"?`)) return;
    try {
      await api.deleteAgentMemory(selectedNode.id);
      notify('Memori berhasil dihapus.', 'success');
      setSelectedNode(null);
      await loadGraph();
    } catch (err: any) {
      notify(err?.message || 'Gagal menghapus memori', 'error');
    }
  };

  // Node Dragging & SVG Pan
  const handleMouseDownSvg = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.target === svgRef.current || (e.target as HTMLElement).tagName === 'rect') {
      setIsPanning(true);
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  };

  const handleMouseMoveSvg = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    } else if (draggingNodeId && graphData) {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const clientX = (e.clientX - rect.left - panOffset.x) / zoomLevel;
      const clientY = (e.clientY - rect.top - panOffset.y) / zoomLevel;

      setGraphData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          nodes: prev.nodes.map(n =>
            n.id === draggingNodeId ? { ...n, x: Math.round(clientX), y: Math.round(clientY) } : n
          )
        };
      });
    }
  };

  const handleMouseUpSvg = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  // Connected edges and nodes for selected node
  const connectedEdgeSet = useMemo(() => {
    const set = new Set<string>();
    if (!selectedNode || !graphData) return set;
    graphData.edges.forEach(e => {
      if (e.source === selectedNode.id || e.target === selectedNode.id) {
        set.add(e.id);
      }
    });
    return set;
  }, [selectedNode, graphData]);

  const connectedNodeIds = useMemo(() => {
    const set = new Set<string>();
    if (!selectedNode || !graphData) return set;
    set.add(selectedNode.id);
    graphData.edges.forEach(e => {
      if (e.source === selectedNode.id) set.add(e.target);
      if (e.target === selectedNode.id) set.add(e.source);
    });
    return set;
  }, [selectedNode, graphData]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="memory-graph-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-hidden animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-7xl h-[92vh] flex flex-col shadow-2xl overflow-hidden relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-cyan-600 to-indigo-600 rounded-xl shadow-lg shadow-cyan-500/20 text-white">
              <Brain className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="memory-graph-title" className="text-xl font-bold text-white tracking-wide">
                  Cognitive Memory Graph Explorer
                </h2>
                <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-full">
                  Mind Map 2.0
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Visualisasi graf kognisi otonom, asosiasi vektor semantik, & retensi memori lintas agen
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsTeachOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Teach Agent
            </button>
            <button
              type="button"
              onClick={() => setIsPruneOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Prune Stale
            </button>
            <button
              type="button"
              onClick={loadGraph}
              disabled={loading}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              title="Refresh Graph"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter & Telemetry Bar */}
        <div className="px-6 py-2.5 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Agent filter */}
            <div className="flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5 text-slate-400" />
              <select
                aria-label="Filter berdasarkan Agen"
                value={selectedAgentId}
                onChange={e => setSelectedAgentId(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-slate-200 rounded-md px-2 py-1 focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">Semua Agen</option>
                {agents.map(a => (
                  <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
                ))}
              </select>
            </div>

            {/* Memory type pills */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              {(['ALL', 'EPISODIC', 'FACTUAL', 'PREFERENCE', 'GOAL'] as const).map(type => (
                <button
                  type="button"
                  key={type}
                  onClick={() => setSelectedMemoryType(type)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                    selectedMemoryType === type
                      ? 'bg-cyan-500/20 text-cyan-300 font-semibold shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Similarity threshold slider */}
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-2.5 py-1 rounded-lg">
              <Sliders className="w-3 h-3 text-cyan-400" />
              <span className="text-slate-400">Min Similarity:</span>
              <input
                type="range"
                min="0.1"
                max="0.8"
                step="0.05"
                value={minSimilarity}
                onChange={e => setMinSimilarity(parseFloat(e.target.value))}
                className="w-16 accent-cyan-500 cursor-pointer"
              />
              <span className="font-mono text-cyan-400 font-bold">{Math.round(minSimilarity * 100)}%</span>
            </div>

            {/* Search query */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari konsep memori..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="bg-slate-800/80 border border-slate-700/80 rounded-md pl-8 pr-3 py-1 text-slate-200 text-xs w-44 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Quick Stats Badges */}
          {graphData && (
            <div className="flex items-center gap-3">
              <span className="text-slate-400">
                Memori: <strong className="text-white">{graphData.stats.totalMemories}</strong>
              </span>
              <span className="text-slate-400">
                Agen: <strong className="text-cyan-400">{graphData.stats.totalAgents}</strong>
              </span>
              <span className="text-slate-400">
                Sinapsis: <strong className="text-indigo-400">{graphData.stats.totalEdges}</strong>
              </span>
              <span className="text-slate-400">
                Rata-rata Skor: <strong className="text-amber-400">{graphData.stats.averageImportance * 100}%</strong>
              </span>
            </div>
          )}
        </div>

        {/* Graph Canvas Container */}
        <div className="flex-1 relative overflow-hidden bg-slate-950 flex">
          {/* Zoom & View Controls Floating Widget */}
          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1 bg-slate-900/90 border border-slate-700/80 p-1 rounded-xl shadow-lg backdrop-blur">
            <button
              type="button"
              onClick={() => setZoomLevel(prev => Math.min(prev + 0.15, 2.5))}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(prev => Math.max(prev - 0.15, 0.4))}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoomLevel(1);
                setPanOffset({ x: 0, y: 0 });
              }}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
              title="Reset View"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Legend Floating Widget */}
          <div className="absolute top-4 left-4 z-20 bg-slate-900/80 border border-slate-800/80 px-3 py-2 rounded-xl backdrop-blur shadow-md text-[11px] space-y-1">
            <div className="font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <Network className="w-3 h-3 text-cyan-400" />
              Node Kategori
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-sm" />
              <span className="text-slate-400">Agent Core</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm" />
              <span className="text-slate-400">Episodic (Pengalaman)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
              <span className="text-slate-400">Factual (Pengetahuan)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-sm" />
              <span className="text-slate-400">Preference (Konstrain)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm" />
              <span className="text-slate-400">Goal (Tujuan Jangka Panjang)</span>
            </div>
          </div>

          {/* SVG Visualizer */}
          <div className="flex-1 h-full cursor-grab active:cursor-grabbing select-none relative">
            <svg
              ref={svgRef}
              className="w-full h-full"
              onMouseDown={handleMouseDownSvg}
              onMouseMove={handleMouseMoveSvg}
              onMouseUp={handleMouseUpSvg}
            >
              <defs>
                {/* Glow Filter */}
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                {/* Agent Radial Gradient */}
                <radialGradient id="agentGradient" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#0891b2" stopOpacity="0.3" />
                </radialGradient>
              </defs>

              {/* Background Grid Pattern */}
              <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${zoomLevel})`}>
                {/* Edges */}
                {graphData?.edges.map(edge => {
                  const source = graphData.nodes.find(n => n.id === edge.source);
                  const target = graphData.nodes.find(n => n.id === edge.target);
                  if (!source || !target || source.x === undefined || source.y === undefined || target.x === undefined || target.y === undefined) {
                    return null;
                  }

                  const isConnected = connectedEdgeSet.has(edge.id);
                  const isDimmed = selectedNode && !isConnected;

                  let strokeColor = '#334155'; // default slate-700
                  let strokeWidth = 1;
                  let strokeDash = undefined;

                  if (edge.edgeType === 'AGENT_MEMORY') {
                    strokeColor = '#0284c7'; // sky-600
                    strokeWidth = 1.2;
                  } else if (edge.edgeType === 'SEMANTIC_SIMILARITY') {
                    strokeColor = '#818cf8'; // indigo-400
                    strokeWidth = Math.max(1, (edge.similarity || 0.4) * 3);
                    strokeDash = '4,3';
                  } else if (edge.edgeType === 'TASK_COOCCURRENCE') {
                    strokeColor = '#eab308'; // yellow-500
                    strokeWidth = 1;
                    strokeDash = '2,2';
                  }

                  if (isConnected) {
                    strokeColor = '#38bdf8';
                    strokeWidth = 2.5;
                  }

                  return (
                    <g key={edge.id} opacity={isDimmed ? 0.15 : 0.85}>
                      <line
                        x1={source.x}
                        y1={source.y}
                        x2={target.x}
                        y2={target.y}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        strokeDasharray={strokeDash}
                        strokeLinecap="round"
                      />
                      {edge.label && edge.similarity && (
                        <text
                          x={(source.x + target.x) / 2}
                          y={(source.y + target.y) / 2 - 4}
                          fill="#94a3b8"
                          fontSize="9"
                          textAnchor="middle"
                          className="font-mono select-none"
                        >
                          {edge.label}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* Nodes */}
                {graphData?.nodes.map(node => {
                  if (node.x === undefined || node.y === undefined) return null;
                  const isSelected = selectedNode?.id === node.id;
                  const isHovered = hoveredNode?.id === node.id;
                  const isConnected = !selectedNode || connectedNodeIds.has(node.id);
                  const isDimmed = selectedNode && !isConnected;

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      opacity={isDimmed ? 0.2 : 1}
                      className="cursor-pointer transition-opacity duration-200"
                      onMouseEnter={() => setHoveredNode(node)}
                      onMouseLeave={() => setHoveredNode(null)}
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedNode(node);
                      }}
                      onMouseDown={e => {
                        e.stopPropagation();
                        setDraggingNodeId(node.id);
                      }}
                    >
                      {/* Active/Selected Ring */}
                      {(isSelected || isHovered) && (
                        <circle
                          r={node.radius + 6}
                          fill="none"
                          stroke={node.color}
                          strokeWidth="2"
                          strokeDasharray="4,2"
                          className="animate-spin"
                          style={{ animationDuration: '8s' }}
                        />
                      )}

                      {/* Main Node Body */}
                      <circle
                        r={node.radius}
                        fill={node.type === 'AGENT' ? 'url(#agentGradient)' : '#0f172a'}
                        stroke={node.color}
                        strokeWidth={node.type === 'AGENT' ? 3 : 2}
                        filter={isSelected || isHovered ? 'url(#glow)' : undefined}
                      />

                      {/* Node Icon or Center Dot */}
                      {node.type === 'AGENT' ? (
                        <g transform="translate(-8, -8)">
                          <Bot className="w-4 h-4 text-cyan-200" />
                        </g>
                      ) : (
                        <circle
                          r={Math.max(3, (node.importanceScore || 0.5) * 6)}
                          fill={node.color}
                          opacity="0.8"
                        />
                      )}

                      {/* Node Label Text */}
                      <text
                        y={node.radius + 14}
                        fill={isSelected ? '#ffffff' : '#cbd5e1'}
                        fontSize={node.type === 'AGENT' ? '12' : '10'}
                        fontWeight={node.type === 'AGENT' ? 'bold' : 'normal'}
                        textAnchor="middle"
                        className="select-none pointer-events-none drop-shadow-md"
                      >
                        {node.label.length > 28 ? `${node.label.slice(0, 26)}...` : node.label}
                      </text>

                      {/* Sub-label for agents */}
                      {node.type === 'AGENT' && (
                        <text
                          y={node.radius + 26}
                          fill="#94a3b8"
                          fontSize="9"
                          textAnchor="middle"
                          className="select-none pointer-events-none"
                        >
                          {node.subLabel}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>

            {/* Hover Tooltip */}
            {hoveredNode && hoveredNode.x !== undefined && hoveredNode.y !== undefined && (
              <div
                className="absolute z-30 pointer-events-none bg-slate-900/95 border border-slate-700 text-xs rounded-xl p-3 shadow-xl max-w-xs backdrop-blur"
                style={{
                  left: Math.min(window.innerWidth - 320, Math.max(10, hoveredNode.x * zoomLevel + panOffset.x + 20)),
                  top: Math.min(window.innerHeight - 200, Math.max(10, hoveredNode.y * zoomLevel + panOffset.y - 20))
                }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: hoveredNode.color }}
                  />
                  <span className="font-semibold text-white uppercase text-[10px] tracking-wider">
                    {hoveredNode.memoryType || hoveredNode.type}
                  </span>
                  {hoveredNode.agentName && (
                    <span className="text-slate-400 text-[10px]">({hoveredNode.agentName})</span>
                  )}
                </div>
                <p className="text-slate-200 font-medium leading-relaxed">{hoveredNode.label}</p>
                {hoveredNode.importanceScore !== undefined && (
                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-800 pt-1.5">
                    <span>Importance:</span>
                    <span className="font-mono font-bold text-amber-400">
                      {Math.round(hoveredNode.importanceScore * 100)}%
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Node Inspector Drawer / Sidebar */}
          {selectedNode && (
            <div className="w-80 border-l border-slate-800 bg-slate-900/95 backdrop-blur flex flex-col h-full z-20 shadow-2xl animate-fadeIn">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: selectedNode.color }}
                  />
                  <h3 className="font-bold text-white text-sm">
                    {selectedNode.type === 'AGENT' ? 'Agent Identity' : 'Memory Synapse'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedNode(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 flex-1 overflow-y-auto space-y-4 text-xs">
                {/* Header Info */}
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    {selectedNode.type === 'AGENT' ? 'Agent Name' : 'Poin Memori Utama'}
                  </span>
                  <p className="text-sm font-semibold text-white mt-1 leading-snug">
                    {selectedNode.label}
                  </p>
                </div>

                {/* Sub-label & Type */}
                <div className="flex items-center gap-2">
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
                    style={{
                      backgroundColor: `${selectedNode.color}22`,
                      color: selectedNode.color,
                      border: `1px solid ${selectedNode.color}55`
                    }}
                  >
                    {selectedNode.memoryType || selectedNode.subLabel || selectedNode.type}
                  </span>
                  {selectedNode.agentName && (
                    <span className="text-slate-400 text-[11px]">
                      Milik: <strong className="text-slate-200">{selectedNode.agentName}</strong>
                    </span>
                  )}
                </div>

                {/* Importance Meter */}
                {selectedNode.importanceScore !== undefined && (
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <div className="flex justify-between text-slate-400 mb-1.5">
                      <span>Importance & Retention Score:</span>
                      <strong className="text-amber-400 font-mono">
                        {Math.round(selectedNode.importanceScore * 100)}%
                      </strong>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full transition-all duration-300"
                        style={{ width: `${selectedNode.importanceScore * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Context Details */}
                {selectedNode.context && (
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Konteks & Latar Belakang
                    </span>
                    <p className="mt-1 text-slate-300 leading-relaxed bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/80">
                      {selectedNode.context}
                    </p>
                  </div>
                )}

                {/* Associated Task */}
                {selectedNode.taskTitle && (
                  <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">Terkait Task:</span>
                    <p className="text-cyan-300 font-medium mt-0.5">{selectedNode.taskTitle}</p>
                  </div>
                )}

                {/* Connected Edges */}
                <div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Asosiasi Terhubung ({connectedEdgeSet.size})
                  </span>
                  <div className="mt-1.5 space-y-1.5">
                    {graphData?.edges
                      .filter(e => e.source === selectedNode.id || e.target === selectedNode.id)
                      .slice(0, 6)
                      .map(e => {
                        const otherId = e.source === selectedNode.id ? e.target : e.source;
                        const otherNode = graphData.nodes.find(n => n.id === otherId);
                        if (!otherNode) return null;
                        return (
                          <div
                            key={e.id}
                            onClick={() => setSelectedNode(otherNode)}
                            className="p-2 bg-slate-800/60 hover:bg-slate-800 rounded-lg cursor-pointer transition border border-slate-700/50 flex items-center justify-between"
                          >
                            <div className="truncate pr-2">
                              <span
                                className="inline-block w-1.5 h-1.5 rounded-full mr-1.5"
                                style={{ backgroundColor: otherNode.color }}
                              />
                              <span className="text-slate-200 font-medium truncate">{otherNode.label}</span>
                            </div>
                            {e.similarity && (
                              <span className="text-indigo-400 font-mono text-[10px] shrink-0">
                                {Math.round(e.similarity * 100)}%
                              </span>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Actions */}
                {selectedNode.type === 'MEMORY' && (
                  <div className="pt-3 border-t border-slate-800 space-y-2">
                    <button
                      type="button"
                      onClick={() => setIsShareOpen(true)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-medium rounded-lg transition"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      Bagikan ke Agen Lain...
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsConsolidateOpen(true)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-indigo-300 font-medium rounded-lg transition"
                    >
                      <GitMerge className="w-3.5 h-3.5" />
                      Konsolidasi Memori...
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteSelectedMemory}
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-medium rounded-lg transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Hapus / Lupakan Memori
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* =========================================================================
            SUB-MODAL: TEACH AGENT (Inject Memory)
        ========================================================================= */}
        {isTeachOpen && (
          <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div
              className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-bold text-white text-base">Teach Agent (Inject Cognition)</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTeachOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleTeachSubmit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Target AI Agent</label>
                  <select
                    value={teachAgentId}
                    onChange={e => setTeachAgentId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2 focus:outline-none focus:border-cyan-500"
                  >
                    {agents.map(a => (
                      <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Kategori Memori</label>
                  <select
                    value={teachType}
                    onChange={e => setTeachType(e.target.value as AgentMemoryType)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="FACTUAL">FACTUAL (Pengetahuan / Ground Truth)</option>
                    <option value="PREFERENCE">PREFERENCE (Preferensi & Batasan Gaya)</option>
                    <option value="GOAL">GOAL (Tujuan Jangka Panjang)</option>
                    <option value="EPISODIC">EPISODIC (Pengalaman Eksekusi)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Poin Memori Utama</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Always check Docker socket permissions before running tests"
                    value={teachKeyPoint}
                    onChange={e => setTeachKeyPoint(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Konteks / Penjelasan Tambahan</label>
                  <textarea
                    rows={3}
                    placeholder="Konteks teknis atau alasan di balik memori ini..."
                    value={teachContext}
                    onChange={e => setTeachContext(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2 focus:outline-none focus:border-cyan-500 resize-none"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>Tingkat Kepentingan (Importance):</span>
                    <strong className="text-amber-400 font-mono">{Math.round(teachImportance * 100)}%</strong>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max="1.0"
                    step="0.05"
                    value={teachImportance}
                    onChange={e => setTeachImportance(parseFloat(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsTeachOpen(false)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingTeach}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg shadow-sm transition disabled:opacity-50"
                  >
                    {isSubmittingTeach ? 'Menyimpan...' : 'Injeksi Memori'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* =========================================================================
            SUB-MODAL: PRUNE STALE MEMORIES
        ========================================================================= */}
        {isPruneOpen && (
          <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div
              className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-400" />
                  <h3 className="font-bold text-white text-base">Cognitive Memory Pruning</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPruneOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-300">
                <p>
                  Memangkas memori yang memiliki skor kepentingan rendah atau usang untuk mengoptimalkan
                  retensi kognisi dan kecepatan penalaran semantik agen.
                </p>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="flex justify-between text-slate-400 mb-1.5">
                    <span>Pangkas memori dengan skor &le;:</span>
                    <strong className="text-amber-400 font-mono">{Math.round(pruneThreshold * 100)}%</strong>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="0.7"
                    step="0.05"
                    value={pruneThreshold}
                    onChange={e => setPruneThreshold(parseFloat(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPruneOpen(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isPruning}
                  onClick={handlePruneSubmit}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {isPruning ? 'Memangkas...' : 'Konfirmasi Pangkas'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            SUB-MODAL: SHARE MEMORY WITH AGENTS
        ========================================================================= */}
        {isShareOpen && selectedNode && (
          <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div
              className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-cyan-400" />
                  <h3 className="font-bold text-white text-base">Bagikan Memori Lintas Agen</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsShareOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Memori Sumber:</span>
                  <p className="text-white font-medium mt-1">{selectedNode.label}</p>
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1.5">Pilih Agen Penerima:</label>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {agents
                      .filter(a => a.id !== selectedNode.agentId)
                      .map(a => {
                        const isChecked = shareTargetAgentIds.includes(a.id);
                        return (
                          <label
                            key={a.id}
                            className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition ${
                              isChecked
                                ? 'bg-cyan-500/10 border-cyan-500/50 text-cyan-300'
                                : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                if (e.target.checked) {
                                  setShareTargetAgentIds(prev => [...prev, a.id]);
                                } else {
                                  setShareTargetAgentIds(prev => prev.filter(id => id !== a.id));
                                }
                              }}
                              className="accent-cyan-500 rounded"
                            />
                            <span>{a.name} ({a.role})</span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsShareOpen(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isSharing || shareTargetAgentIds.length === 0}
                  onClick={handleShareSubmit}
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {isSharing ? 'Membagikan...' : `Bagikan (${shareTargetAgentIds.length})`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            SUB-MODAL: CONSOLIDATE MEMORIES
        ========================================================================= */}
        {isConsolidateOpen && selectedNode && (
          <div className="absolute inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div
              className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <GitMerge className="w-5 h-5 text-indigo-400" />
                  <h3 className="font-bold text-white text-base">Konsolidasi Memori Menjadi Aturan</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsConsolidateOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Memori 1:</span>
                  <p className="text-white font-medium mt-0.5">{selectedNode.label}</p>
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Pilih Memori 2 untuk Digabungkan:</label>
                  <select
                    value={consolidateSecondId}
                    onChange={e => setConsolidateSecondId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">-- Pilih Memori --</option>
                    {graphData?.nodes
                      .filter(n => n.type === 'MEMORY' && n.id !== selectedNode.id)
                      .map(n => (
                        <option key={n.id} value={n.id}>
                          [{n.memoryType}] {n.label.slice(0, 50)}...
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Hasil Sintesis Utama (Key Point)</label>
                  <input
                    type="text"
                    placeholder="Poin sintesis atau kaidah permanen hasil gabungan..."
                    value={consolidateKeyPoint}
                    onChange={e => setConsolidateKeyPoint(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg p-2 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsConsolidateOpen(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isConsolidating || !consolidateSecondId || !consolidateKeyPoint.trim()}
                  onClick={handleConsolidateSubmit}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {isConsolidating ? 'Menyintesis...' : 'Konsolidasi'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
