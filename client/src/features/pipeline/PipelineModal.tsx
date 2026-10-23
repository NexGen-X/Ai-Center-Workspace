import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Workflow as WorkflowIcon,
  Sparkles,
  ArrowRight,
  Play,
  CheckCircle2,
  Clock,
  AlertCircle,
  Cpu,
  Bot,
  Copy,
  Check,
  Layers,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  Plus,
  Trash2,
  Database,
  GitBranch,
  Terminal,
  Plug,
  Bell,
  UserCheck,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Save,
  Download
} from 'lucide-react';
import {
  AIAgent,
  Project,
  PipelineTemplate,
  PipelineExecutionResult,
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeType,
  WorkflowExecution,
  McpServer
} from '../../../../shared/types.js';
import { api } from '../../services/api.js';
import { useFeedback } from '../../components/common/FeedbackContext.js';
import { CustomSelect } from '../../components/common/CustomSelect.js';

interface PipelineModalProps {
  isOpen: boolean;
  onClose: () => void;
  agents: AIAgent[];
  projects: Project[];
  onPipelineCompleted?: () => void;
}

const NODE_PALETTE: Array<{
  type: WorkflowNodeType;
  label: string;
  description: string;
  color: string;
  badgeBg: string;
  borderColor: string;
  icon: any;
  defaultConfig: Record<string, any>;
}> = [
  {
    type: 'TRIGGER',
    label: 'Manual / Event Trigger',
    description: 'Titik awal alur kerja dengan payload data awal',
    color: 'text-cyan-400',
    badgeBg: 'bg-cyan-950/80 border-cyan-800/60',
    borderColor: 'border-cyan-500/50',
    icon: Play,
    defaultConfig: { triggerType: 'MANUAL', initialPayload: { target: 'Production' } }
  },
  {
    type: 'AGENT',
    label: 'AI Agent / LLM Inference',
    description: 'Menugaskan tugas penalaran ke agen kecerdasan buatan',
    color: 'text-indigo-400',
    badgeBg: 'bg-indigo-950/80 border-indigo-800/60',
    borderColor: 'border-indigo-500/50',
    icon: Bot,
    defaultConfig: { agentId: '', promptTemplate: 'Selesaikan tugas berikut berdasarkan data masukan:\n\n{trigger.target}' }
  },
  {
    type: 'RAG',
    label: 'RAG Knowledge Query',
    description: 'Pencarian semantik pada memori vektor pgvector',
    color: 'text-emerald-400',
    badgeBg: 'bg-emerald-950/80 border-emerald-800/60',
    borderColor: 'border-emerald-500/50',
    icon: Database,
    defaultConfig: { query: 'Kebijakan dan arsitektur sistem', limit: 3 }
  },
  {
    type: 'CONDITION',
    label: 'Condition / Branching',
    description: 'Percabangan logika (True / False branch)',
    color: 'text-amber-400',
    badgeBg: 'bg-amber-950/80 border-amber-800/60',
    borderColor: 'border-amber-500/50',
    icon: GitBranch,
    defaultConfig: { expression: 'output.toLowerCase().includes("ok") || output.length > 20' }
  },
  {
    type: 'ACTION',
    label: 'Action / Sandbox Tool',
    description: 'Eksekusi perintah aman (bash, file_read, file_write)',
    color: 'text-rose-400',
    badgeBg: 'bg-rose-950/80 border-rose-800/60',
    borderColor: 'border-rose-500/50',
    icon: Terminal,
    defaultConfig: { toolName: 'bash_exec', params: { command: 'echo "Pipeline Step Executed"' } }
  },
  {
    type: 'MCP_TOOL',
    label: 'MCP Protocol Tool',
    description: 'Memanggil tool dari server Model Context Protocol',
    color: 'text-purple-400',
    badgeBg: 'bg-purple-950/80 border-purple-800/60',
    borderColor: 'border-purple-500/50',
    icon: Plug,
    defaultConfig: { serverId: '', toolName: '', args: {} }
  },
  {
    type: 'HUMAN_APPROVAL',
    label: 'Human Approval Gate',
    description: 'Hentikan eksekusi hingga dikonfirmasi operator manusia',
    color: 'text-yellow-400',
    badgeBg: 'bg-yellow-950/80 border-yellow-800/60',
    borderColor: 'border-yellow-500/50',
    icon: UserCheck,
    defaultConfig: { reason: 'Persetujuan eksekusi tindakan berisiko' }
  },
  {
    type: 'ALERT',
    label: 'Outbound Notification',
    description: 'Kirim notifikasi ke Discord, Slack, atau Telegram',
    color: 'text-sky-400',
    badgeBg: 'bg-sky-950/80 border-sky-800/60',
    borderColor: 'border-sky-500/50',
    icon: Bell,
    defaultConfig: { title: 'Workflow Alert', message: 'Alur kerja selesai dengan sukses', eventType: 'CUSTOM' }
  }
];

export const PipelineModal: React.FC<PipelineModalProps> = ({
  isOpen,
  onClose,
  agents,
  projects,
  onPipelineCompleted
}) => {
  const { toast, confirm } = useFeedback();

  // Mode tab
  const [activeTab, setActiveTab] = useState<'DAG' | 'SEQUENTIAL'>('DAG');

  // Visual DAG Studio States
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);

  // DAG Canvas Interactive States
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  // Execution States
  const [activeExecution, setActiveExecution] = useState<WorkflowExecution | null>(null);
  const [isExecutingDag, setIsExecutingDag] = useState(false);
  const [approvingExecution, setApprovingExecution] = useState(false);

  // Sequential Pipelines States (Legacy Compatibility)
  const [templates, setTemplates] = useState<PipelineTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('feature-swarm');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [isDecomposing, setIsDecomposing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [decomposedStages, setDecomposedStages] = useState<any[]>([]);
  const [expandedStages, setExpandedStages] = useState<Record<number, boolean>>({});
  const [executionResult, setExecutionResult] = useState<PipelineExecutionResult | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Handle Escape key dismissal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Load Workflows & Templates on Open
  useEffect(() => {
    if (isOpen) {
      loadWorkflowsData();
      api.getPipelineTemplates()
        .then((res) => {
          setTemplates(res.templates || []);
          if (res.templates?.length > 0 && !selectedTemplateId) {
            setSelectedTemplateId(res.templates[0].id);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const loadWorkflowsData = async () => {
    setLoadingWorkflows(true);
    try {
      const [wfs, servers, tmpls] = await Promise.all([
        api.getWorkflows(),
        api.getMcpServers(),
        api.getWorkflowTemplates()
      ]);
      setMcpServers(servers || []);

      if (wfs && wfs.length > 0) {
        setWorkflows(wfs);
        if (!selectedWorkflow) {
          setSelectedWorkflow(wfs[0]);
        }
      } else if (tmpls && tmpls.length > 0) {
        // Auto-seed first template if empty
        const seeded = await api.createWorkflow({
          name: tmpls[0].name || 'Security Audit DAG',
          description: tmpls[0].description,
          nodes: tmpls[0].nodes || [],
          edges: tmpls[0].edges || []
        });
        setWorkflows([seeded]);
        setSelectedWorkflow(seeded);
      }
    } catch {
      // ignore
    } finally {
      setLoadingWorkflows(false);
    }
  };

  // Poll active execution status
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (activeExecution && (activeExecution.status === 'RUNNING' || activeExecution.status === 'WAITING_APPROVAL')) {
      timer = setInterval(async () => {
        try {
          const fresh = await api.getWorkflowExecution(activeExecution.id);
          setActiveExecution(fresh);
          if (fresh.status === 'COMPLETED' || fresh.status === 'FAILED') {
            setIsExecutingDag(false);
            if (fresh.status === 'COMPLETED') {
              toast.success('Alur kerja DAG selesai dieksekusi dengan sukses!');
              if (onPipelineCompleted) onPipelineCompleted();
            } else {
              toast.error('Alur kerja DAG berhenti dengan status kegagalan.');
            }
          }
        } catch {
          // ignore
        }
      }, 1500);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activeExecution]);

  // Handle Dragging Nodes on Canvas
  const handleMouseDownNode = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setSelectedNodeId(nodeId);

    const node = selectedWorkflow?.nodes.find((n) => n.id === nodeId);
    if (!node || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - canvasRect.left) / canvasZoom;
    const mouseY = (e.clientY - canvasRect.top) / canvasZoom;

    setDraggingNodeId(nodeId);
    setDragOffset({
      x: mouseX - node.position.x,
      y: mouseY - node.position.y
    });
  };

  const handleMouseMoveCanvas = (e: React.MouseEvent) => {
    if (!draggingNodeId || !selectedWorkflow || !canvasRef.current) return;

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - canvasRect.left) / canvasZoom;
    const mouseY = (e.clientY - canvasRect.top) / canvasZoom;

    const newX = Math.max(20, Math.round(mouseX - dragOffset.x));
    const newY = Math.max(20, Math.round(mouseY - dragOffset.y));

    const updatedNodes = selectedWorkflow.nodes.map((n) => {
      if (n.id === draggingNodeId) {
        return { ...n, position: { x: newX, y: newY } };
      }
      return n;
    });

    setSelectedWorkflow({
      ...selectedWorkflow,
      nodes: updatedNodes
    });
  };

  const handleMouseUpCanvas = () => {
    setDraggingNodeId(null);
  };

  // Add Node from Palette
  const handleAddNode = (type: WorkflowNodeType) => {
    if (!selectedWorkflow) return;
    const paletteItem = NODE_PALETTE.find((p) => p.type === type);
    if (!paletteItem) return;

    const newId = `node-${type.toLowerCase()}-${Date.now().toString().slice(-4)}`;
    const newNode: WorkflowNode = {
      id: newId,
      type,
      label: paletteItem.label,
      position: {
        x: 100 + (selectedWorkflow.nodes.length % 5) * 60,
        y: 100 + (selectedWorkflow.nodes.length % 5) * 40
      },
      config: { ...paletteItem.defaultConfig }
    };

    const updated = {
      ...selectedWorkflow,
      nodes: [...selectedWorkflow.nodes, newNode]
    };
    setSelectedWorkflow(updated);
    setSelectedNodeId(newId);
    toast.success(`Node "${paletteItem.label}" ditambahkan ke canvas.`);
  };

  // Edge Connection Handling
  const handleConnectPort = (nodeId: string, handle = 'output') => {
    if (!connectingSourceId) {
      setConnectingSourceId(nodeId);
      toast.info('Pilih node tujuan untuk menghubungkan garis aliran...');
    } else {
      if (connectingSourceId === nodeId) {
        setConnectingSourceId(null);
        return;
      }

      if (!selectedWorkflow) return;

      // Check if edge already exists
      const exists = selectedWorkflow.edges.some(
        (e) => e.source === connectingSourceId && e.target === nodeId
      );

      if (exists) {
        toast.error('Koneksi antar kedua node ini sudah ada.');
        setConnectingSourceId(null);
        return;
      }

      const newEdge: WorkflowEdge = {
        id: `e-${connectingSourceId}-${nodeId}-${Date.now().toString().slice(-3)}`,
        source: connectingSourceId,
        target: nodeId,
        sourceHandle: handle
      };

      const updated = {
        ...selectedWorkflow,
        edges: [...selectedWorkflow.edges, newEdge]
      };
      setSelectedWorkflow(updated);
      setConnectingSourceId(null);
      toast.success('Node berhasil dihubungkan!');
    }
  };

  const handleDeleteNode = (nodeId: string) => {
    if (!selectedWorkflow) return;
    const updatedNodes = selectedWorkflow.nodes.filter((n) => n.id !== nodeId);
    const updatedEdges = selectedWorkflow.edges.filter((e) => e.source !== nodeId && e.target !== nodeId);

    setSelectedWorkflow({
      ...selectedWorkflow,
      nodes: updatedNodes,
      edges: updatedEdges
    });
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
    toast.info('Node dihapus.');
  };

  const handleDeleteEdge = (edgeId: string) => {
    if (!selectedWorkflow) return;
    const updatedEdges = selectedWorkflow.edges.filter((e) => e.id !== edgeId);
    setSelectedWorkflow({
      ...selectedWorkflow,
      edges: updatedEdges
    });
    toast.info('Koneksi garis dihapus.');
  };

  const handleSaveWorkflow = async () => {
    if (!selectedWorkflow) return;
    try {
      await api.updateWorkflow(selectedWorkflow.id, {
        name: selectedWorkflow.name,
        description: selectedWorkflow.description,
        nodes: selectedWorkflow.nodes,
        edges: selectedWorkflow.edges,
        isActive: selectedWorkflow.isActive
      });
      toast.success('Alur kerja DAG berhasil disimpan ke database!');
      loadWorkflowsData();
    } catch (err: any) {
      toast.error('Gagal menyimpan alur kerja: ' + err.message);
    }
  };

  const handleExecuteDag = async () => {
    if (!selectedWorkflow) return;
    setIsExecutingDag(true);
    setActiveExecution(null);

    try {
      const exec = await api.executeWorkflow(selectedWorkflow.id, {
        operator: 'Yulian',
        initiatedAt: new Date().toISOString()
      });
      setActiveExecution(exec);
      toast.success('Eksekusi DAG alur kerja dimulai!');
    } catch (err: any) {
      toast.error('Gagal mengeksekusi alur kerja: ' + err.message);
      setIsExecutingDag(false);
    }
  };

  const handleApproveGate = async (approved: boolean) => {
    if (!activeExecution) return;
    setApprovingExecution(true);
    try {
      const updated = await api.approveWorkflowExecution(activeExecution.id, approved, 'Yulian');
      setActiveExecution(updated);
      toast.info(approved ? 'Gerbang persetujuan disetujui. Melanjutkan alur kerja...' : 'Alur kerja dibatalkan.');
    } catch (err: any) {
      toast.error('Gagal memproses persetujuan: ' + err.message);
    } finally {
      setApprovingExecution(false);
    }
  };

  const handleLoadTemplate = async (tmplId: string) => {
    try {
      const tmpls = await api.getWorkflowTemplates();
      const target = tmpls.find((t) => t.id === tmplId);
      if (!target) return;

      const created = await api.createWorkflow({
        name: target.name || 'New Template Workflow',
        description: target.description,
        nodes: target.nodes || [],
        edges: target.edges || []
      });

      setWorkflows([created, ...workflows]);
      setSelectedWorkflow(created);
      setSelectedNodeId(null);
      toast.success(`Template "${created.name}" dimuat ke studio!`);
    } catch (err: any) {
      toast.error('Gagal memuat template: ' + err.message);
    }
  };

  // Helper to render SVG Bezier Connections
  const renderSvgEdges = () => {
    if (!selectedWorkflow) return null;

    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 8 5 L 0 9 z" fill="#38bdf8" />
          </marker>
          <marker
            id="arrow-green"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 8 5 L 0 9 z" fill="#34d399" />
          </marker>
          <marker
            id="arrow-red"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 8 5 L 0 9 z" fill="#f87171" />
          </marker>
        </defs>

        {selectedWorkflow.edges.map((edge) => {
          const sourceNode = selectedWorkflow.nodes.find((n) => n.id === edge.source);
          const targetNode = selectedWorkflow.nodes.find((n) => n.id === edge.target);
          if (!sourceNode || !targetNode) return null;

          const isConditionTrue = edge.sourceHandle === 'true';
          const isConditionFalse = edge.sourceHandle === 'false';

          const strokeColor = isConditionTrue
            ? '#34d399'
            : isConditionFalse
            ? '#f87171'
            : '#0ea5e9';

          const markerId = isConditionTrue
            ? 'url(#arrow-green)'
            : isConditionFalse
            ? 'url(#arrow-red)'
            : 'url(#arrow)';

          // Compute connection anchor coordinates
          const x1 = sourceNode.position.x + 220;
          const y1 = sourceNode.position.y + 40;
          const x2 = targetNode.position.x;
          const y2 = targetNode.position.y + 40;

          const dx = Math.abs(x2 - x1) * 0.5;
          const pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

          return (
            <g key={edge.id} className="pointer-events-auto group">
              <path
                d={pathD}
                fill="none"
                stroke={strokeColor}
                strokeWidth="2.5"
                strokeDasharray={isConditionFalse ? '4 4' : 'none'}
                markerEnd={markerId}
                className="transition-all hover:stroke-cyan-300 hover:stroke-[3.5px] cursor-pointer"
                onClick={() => handleDeleteEdge(edge.id)}
              />
              {edge.label && (
                <text
                  x={(x1 + x2) / 2}
                  y={(y1 + y2) / 2 - 8}
                  fill={strokeColor}
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="middle"
                  className="bg-slate-950 px-1 font-bold"
                >
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    );
  };

  // Node Inspector Component
  const selectedNode = selectedWorkflow?.nodes.find((n) => n.id === selectedNodeId);

  // Sequential pipeline handlers
  const handleApplyPreset = (text: string) => {
    setObjective(text);
    if (!title) setTitle(text.slice(0, 45));
  };

  const handleDecompose = async () => {
    if (!objective.trim()) {
      toast.error('Silakan isi tujuan/objektif tugas terlebih dahulu.');
      return;
    }
    setIsDecomposing(true);
    setExecutionResult(null);
    try {
      const res = await api.decomposePipeline({
        title: title || undefined,
        objective,
        templateId: selectedTemplateId,
        projectId: selectedProjectId || undefined
      });
      setDecomposedStages(res.stages || []);
      setExpandedStages({ 0: true });
      toast.success(`Dekomposisi berhasil: ${res.stages.length} tahap kolaborasi terbentuk.`);
    } catch (err: any) {
      toast.error(err.message || 'Gagal mendekomposisi swarm pipeline.');
    } finally {
      setIsDecomposing(false);
    }
  };

  const handleExecuteSequentialPipeline = async () => {
    if (decomposedStages.length === 0) return;
    setIsExecuting(true);
    try {
      const res = await api.executePipeline({
        title: title || 'Full-Stack Autonomous Swarm Mission',
        objective,
        templateId: selectedTemplateId,
        projectId: selectedProjectId || undefined,
        stages: decomposedStages
      });
      setExecutionResult(res);
      toast.success('Pipeline Swarm selesai dieksekusi dengan sukses!');
      if (onPipelineCompleted) onPipelineCompleted();
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengeksekusi pipeline.');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCopySummary = () => {
    if (!executionResult?.finalSummary) return;
    navigator.clipboard.writeText(executionResult.finalSummary);
    setCopiedSummary(true);
    toast.info('Laporan ringkasan disalin ke clipboard.');
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-7xl h-[92vh] flex flex-col bg-[#09090b] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between px-3.5 sm:px-6 py-2.5 sm:py-3 border-b border-zinc-800 bg-[#09090b] gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 shrink-0">
              <WorkflowIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white truncate">
                  Visual Workflow Studio
                </h3>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30 uppercase tracking-wider font-mono">
                  No-Code DAG Engine
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-zinc-400 truncate hidden sm:block">
                Rancang alur kerja multi-agent, percabangan logika, integrasi RAG & MCP tool secara visual.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Tab Switcher */}
            <div className="flex p-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('DAG')}
                className={`px-2.5 sm:px-3 py-1 rounded-md transition text-xs ${
                  activeTab === 'DAG'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                DAG Canvas
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('SEQUENTIAL')}
                className={`px-2.5 sm:px-3 py-1 rounded-md transition text-xs ${
                  activeTab === 'SEQUENTIAL'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Sekuensial
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              title="Tutup Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab 1: Visual DAG Canvas Studio */}
        {activeTab === 'DAG' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-zinc-800 bg-[#09090b] text-xs gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-zinc-400 text-[11px] uppercase tracking-wider hidden sm:inline">Workflow:</span>
                <select
                  value={selectedWorkflow?.id || ''}
                  onChange={(e) => {
                    const found = workflows.find((w) => w.id === e.target.value);
                    if (found) {
                      setSelectedWorkflow(found);
                      setSelectedNodeId(null);
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-white font-semibold focus:outline-none focus:border-purple-500 max-w-[160px] sm:max-w-none truncate"
                >
                  {workflows.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.nodes?.length || 0} nodes)
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={async () => {
                    const name = prompt('Masukkan nama workflow baru:', 'Custom Multi-Agent Workflow');
                    if (!name) return;
                    const created = await api.createWorkflow({
                      name,
                      nodes: [
                        { id: 'node-trig-1', type: 'TRIGGER', label: 'Start Trigger', position: { x: 80, y: 150 }, config: {} }
                      ],
                      edges: []
                    });
                    setWorkflows([created, ...workflows]);
                    setSelectedWorkflow(created);
                    setSelectedNodeId(null);
                    toast.success('Workflow baru dibuat!');
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Baru</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPaletteOpen(!isPaletteOpen)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 transition text-xs font-semibold lg:hidden"
                  title="Buka Node Palette"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Node</span>
                </button>

                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleLoadTemplate(e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs focus:outline-none max-w-[140px] sm:max-w-none truncate hidden sm:block"
                  defaultValue=""
                >
                  <option value="" disabled>✦ Muat Template Cepat...</option>
                  <option value="wf-security-audit-dag">Automated Security Audit & Hotfix DAG</option>
                  <option value="wf-rag-research-dag">Multi-Agent Research & Synthesis DAG</option>
                </select>
              </div>

              {/* Action Buttons & Zoom */}
              <div className="flex items-center gap-2">
                {/* Zoom Controls */}
                <div className="hidden sm:flex items-center bg-zinc-900 rounded-lg border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setCanvasZoom(Math.max(0.6, canvasZoom - 0.1))}
                    className="p-1.5 hover:text-white text-zinc-400"
                    title="Perkecil"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] font-mono px-1.5 text-zinc-300">
                    {Math.round(canvasZoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setCanvasZoom(Math.min(1.4, canvasZoom + 0.1))}
                    className="p-1.5 hover:text-white text-zinc-400"
                    title="Perbesar"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCanvasZoom(1)}
                    className="p-1.5 hover:text-white text-zinc-400 border-l border-zinc-800"
                    title="Reset Zoom"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSaveWorkflow}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 font-semibold transition"
                >
                  <Save className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="hidden sm:inline">Simpan</span>
                </button>

                <button
                  type="button"
                  onClick={handleExecuteDag}
                  disabled={isExecutingDag}
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-purple-900/30 transition disabled:opacity-50 text-xs"
                >
                  <Play className={`w-3.5 h-3.5 ${isExecutingDag ? 'animate-spin' : 'fill-white'}`} />
                  <span>{isExecutingDag ? 'Mengeksekusi...' : 'Jalankan DAG'}</span>
                </button>
              </div>
            </div>

            {/* Main Studio Area (Palette + Canvas + Inspector) */}
            <div className="flex-1 flex overflow-hidden relative">
              {/* Left Sidebar: Node Palette - Responsive Drawer on Mobile */}
              <div className={`
                ${isPaletteOpen ? 'fixed inset-y-0 left-0 z-40 w-64 bg-[#09090b]/98 shadow-2xl border-r border-zinc-800' : 'hidden lg:flex'}
                lg:static lg:w-56 lg:border-r lg:border-zinc-800 lg:bg-[#09090b] p-3 flex flex-col gap-2 overflow-y-auto shrink-0 z-20
              `}>
                <div className="flex items-center justify-between pb-1 border-b border-zinc-800 lg:border-none">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-1 mb-1">
                    Node Palette
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsPaletteOpen(false)}
                    className="p-1 rounded text-zinc-400 hover:text-white lg:hidden"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {NODE_PALETTE.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => {
                        handleAddNode(item.type);
                        setIsPaletteOpen(false);
                      }}
                      className="flex items-center gap-2 p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-left transition group hover:scale-[1.02]"
                    >
                      <div className={`p-1.5 rounded-lg ${item.badgeBg} border ${item.color} shrink-0`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-white block truncate group-hover:text-cyan-300">
                          {item.label}
                        </span>
                        <span className="text-[10px] text-zinc-400 block truncate">
                          {item.description}
                        </span>
                      </div>
                    </button>
                  );
                })}

                <div className="mt-auto p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-[10px] text-zinc-400 space-y-1">
                  <span className="font-bold text-slate-300 block">💡 Tips Studio:</span>
                  <p>• Klik & seret node untuk mengubah posisi.</p>
                  <p>• Klik port <strong>[+]</strong> pada node untuk menghubungkan garis alur.</p>
                  <p>• Klik garis untuk menghapus koneksi.</p>
                </div>
              </div>

              {/* Center Canvas */}
              <div
                ref={canvasRef}
                onMouseMove={handleMouseMoveCanvas}
                onMouseUp={handleMouseUpCanvas}
                className="flex-1 bg-[#0b0f19] bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] relative overflow-hidden select-none"
              >
                {/* SVG Connections Overlay */}
                <div
                  style={{
                    transform: `scale(${canvasZoom})`,
                    transformOrigin: '0 0',
                    width: '3000px',
                    height: '2000px',
                    position: 'absolute'
                  }}
                >
                  {renderSvgEdges()}

                  {/* Render Workflow Nodes */}
                  {selectedWorkflow?.nodes.map((node) => {
                    const isSelected = selectedNodeId === node.id;
                    const paletteInfo = NODE_PALETTE.find((p) => p.type === node.type);
                    const Icon = paletteInfo?.icon || Bot;
                    const nodeState = activeExecution?.nodeStates[node.id];

                    // Determine state styling
                    let statusBorder = paletteInfo?.borderColor || 'border-slate-700';
                    let statusBadge = null;

                    if (nodeState) {
                      if (nodeState.status === 'RUNNING') {
                        statusBorder = 'border-amber-400 ring-2 ring-amber-400/40 shadow-xl shadow-amber-950/50 animate-pulse';
                        statusBadge = <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />;
                      } else if (nodeState.status === 'COMPLETED') {
                        statusBorder = 'border-emerald-500 ring-1 ring-emerald-500/40 shadow-xl shadow-emerald-950/50';
                        statusBadge = <Check className="w-3.5 h-3.5 text-emerald-400" />;
                      } else if (nodeState.status === 'WAITING_APPROVAL') {
                        statusBorder = 'border-yellow-400 ring-2 ring-yellow-400/50 shadow-xl shadow-yellow-950/50 animate-bounce';
                        statusBadge = <Clock className="w-3.5 h-3.5 text-yellow-400" />;
                      } else if (nodeState.status === 'FAILED') {
                        statusBorder = 'border-rose-500 ring-1 ring-rose-500/40';
                        statusBadge = <AlertCircle className="w-3.5 h-3.5 text-rose-400" />;
                      } else if (nodeState.status === 'SKIPPED') {
                        statusBorder = 'border-slate-800 opacity-40';
                      }
                    }

                    return (
                      <div
                        key={node.id}
                        onMouseDown={(e) => handleMouseDownNode(e, node.id)}
                        style={{
                          left: `${node.position.x}px`,
                          top: `${node.position.y}px`
                        }}
                        className={`absolute w-56 rounded-xl bg-slate-900/95 backdrop-blur-md border p-3 cursor-move shadow-2xl transition-shadow z-20 ${statusBorder} ${
                          isSelected ? 'ring-2 ring-cyan-400' : ''
                        }`}
                      >
                        {/* Node Card Header */}
                        <div className="flex items-center justify-between pb-2 border-b border-slate-800 gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className={`p-1 rounded-md ${paletteInfo?.badgeBg} text-white shrink-0`}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-xs font-bold text-white truncate font-mono">
                              {node.label}
                            </span>
                          </div>
                          {statusBadge}
                        </div>

                        {/* Node Body Info */}
                        <div className="pt-2 text-[11px] text-slate-400 space-y-1">
                          {node.type === 'AGENT' && (
                            <span className="block truncate text-indigo-300 font-mono">
                              Agent: {node.config?.agentId ? agents.find((a) => a.id === node.config.agentId)?.name || node.config.agentId : 'Auto-Select'}
                            </span>
                          )}
                          {node.type === 'RAG' && (
                            <span className="block truncate text-emerald-300 font-mono">
                              Query: {node.config?.query || 'Top-k search'}
                            </span>
                          )}
                          {node.type === 'CONDITION' && (
                            <span className="block truncate text-amber-300 font-mono text-[10px]">
                              {node.config?.expression || 'Condition'}
                            </span>
                          )}
                          {node.type === 'ACTION' && (
                            <span className="block truncate text-rose-300 font-mono">
                              Tool: {node.config?.toolName || 'bash_exec'}
                            </span>
                          )}
                          {node.type === 'MCP_TOOL' && (
                            <span className="block truncate text-purple-300 font-mono">
                              MCP: {node.config?.toolName || 'Custom Tool'}
                            </span>
                          )}
                          {node.type === 'HUMAN_APPROVAL' && (
                            <span className="block truncate text-yellow-300 font-mono text-[10px]">
                              Gate: {node.config?.reason || 'Approval Gate'}
                            </span>
                          )}
                          {node.type === 'ALERT' && (
                            <span className="block truncate text-sky-300 font-mono">
                              {node.config?.title || 'Alert Dispatch'}
                            </span>
                          )}

                          {nodeState?.output && (
                            <div className="mt-1 p-1 rounded bg-slate-950/80 border border-slate-800 text-[10px] font-mono text-slate-300 line-clamp-2">
                              {typeof nodeState.output === 'object'
                                ? JSON.stringify(nodeState.output)
                                : String(nodeState.output)}
                            </div>
                          )}
                        </div>

                        {/* Ports / Handles */}
                        {/* Output Handle */}
                        {node.type === 'CONDITION' ? (
                          <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-800 text-[10px] font-mono">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConnectPort(node.id, 'true');
                              }}
                              className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 hover:bg-emerald-900"
                              title="Hubungkan cabang TRUE"
                            >
                              True ➔
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConnectPort(node.id, 'false');
                              }}
                              className="px-1.5 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 hover:bg-rose-900"
                              title="Hubungkan cabang FALSE"
                            >
                              False ➔
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end pt-2 mt-2 border-t border-slate-800">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConnectPort(node.id, 'output');
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition ${
                                connectingSourceId === node.id
                                  ? 'bg-cyan-500 text-white animate-pulse'
                                  : 'bg-slate-800 hover:bg-cyan-600/30 text-slate-300 hover:text-cyan-200'
                              }`}
                              title="Klik untuk membuat koneksi dari node ini"
                            >
                              <Plus className="w-2.5 h-2.5" />
                              <span>Hubungkan</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Floating Human Approval Gate Alert Banner */}
                {activeExecution?.status === 'WAITING_APPROVAL' && (
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 max-w-lg w-[calc(100%-32px)] p-3.5 rounded-2xl bg-yellow-950/95 backdrop-blur-md border border-yellow-500/60 shadow-2xl shadow-yellow-950/70 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <UserCheck className="w-5 h-5 text-yellow-400 shrink-0 animate-bounce" />
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-white block">
                          Persetujuan Manusia Diperlukan
                        </span>
                        <p className="text-[11px] text-yellow-200 truncate">
                          Alur kerja dihentikan sementara menunggu persetujuan tindakan dari operator.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleApproveGate(true)}
                        disabled={approvingExecution}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition"
                      >
                        Setujui
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApproveGate(false)}
                        disabled={approvingExecution}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md transition"
                      >
                        Tolak
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Sidebar: Node Config Inspector (Mobile Bottom Sheet / Desktop Sidebar) */}
              {selectedNode && (
                <div className="fixed inset-x-0 bottom-0 max-h-[75vh] md:static md:w-80 border-t md:border-t-0 md:border-l border-zinc-800 bg-[#09090b]/98 md:bg-[#09090b] p-4 rounded-t-2xl md:rounded-none flex flex-col justify-between gap-4 overflow-y-auto shrink-0 z-30 shadow-2xl md:shadow-none animate-in fade-in slide-in-from-bottom-2 md:slide-in-from-right-2">
                  <div className="space-y-4 text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">Konfigurasi Node</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800">
                          {selectedNode.type}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedNodeId(null)}
                        className="text-slate-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-slate-300 font-semibold block">Label Node</label>
                      <input
                        type="text"
                        value={selectedNode.label}
                        onChange={(e) => {
                          const updated = selectedWorkflow!.nodes.map((n) =>
                            n.id === selectedNode.id ? { ...n, label: e.target.value } : n
                          );
                          setSelectedWorkflow({ ...selectedWorkflow!, nodes: updated });
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    {/* Node Type Specific Configurations */}
                    {selectedNode.type === 'AGENT' && (
                      <>
                        <div className="space-y-1.5">
                          <label className="text-slate-300 font-semibold block">Pilih Agen Pelaksana</label>
                          <select
                            value={selectedNode.config?.agentId || ''}
                            onChange={(e) => {
                              const updated = selectedWorkflow!.nodes.map((n) =>
                                n.id === selectedNode.id
                                  ? { ...n, config: { ...n.config, agentId: e.target.value } }
                                  : n
                              );
                              setSelectedWorkflow({ ...selectedWorkflow!, nodes: updated });
                            }}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none"
                          >
                            <option value="">-- Otomatis Pilih Agen Aktif --</option>
                            {agents.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name} ({a.role})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-slate-300 font-semibold block">Template Prompt</label>
                          <textarea
                            value={selectedNode.config?.promptTemplate || ''}
                            onChange={(e) => {
                              const updated = selectedWorkflow!.nodes.map((n) =>
                                n.id === selectedNode.id
                                  ? { ...n, config: { ...n.config, promptTemplate: e.target.value } }
                                  : n
                              );
                              setSelectedWorkflow({ ...selectedWorkflow!, nodes: updated });
                            }}
                            rows={4}
                            placeholder="Gunakan variabel seperti {trigger.target} atau {node_id.output}"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono text-[11px] focus:outline-none"
                          />
                        </div>
                      </>
                    )}

                    {selectedNode.type === 'RAG' && (
                      <div className="space-y-1.5">
                        <label className="text-slate-300 font-semibold block">Query Pencarian Vektor</label>
                        <textarea
                          value={selectedNode.config?.query || ''}
                          onChange={(e) => {
                            const updated = selectedWorkflow!.nodes.map((n) =>
                              n.id === selectedNode.id
                                ? { ...n, config: { ...n.config, query: e.target.value } }
                                : n
                            );
                            setSelectedWorkflow({ ...selectedWorkflow!, nodes: updated });
                          }}
                          rows={2}
                          placeholder="Pertanyaan semantik atau konsep SOP..."
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-[11px] focus:outline-none"
                        />
                      </div>
                    )}

                    {selectedNode.type === 'CONDITION' && (
                      <div className="space-y-1.5">
                        <label className="text-slate-300 font-semibold block">Ekspresi Logika JavaScript</label>
                        <input
                          type="text"
                          value={selectedNode.config?.expression || ''}
                          onChange={(e) => {
                            const updated = selectedWorkflow!.nodes.map((n) =>
                              n.id === selectedNode.id
                                ? { ...n, config: { ...n.config, expression: e.target.value } }
                                : n
                            );
                            setSelectedWorkflow({ ...selectedWorkflow!, nodes: updated });
                          }}
                          placeholder="output.includes('OK') || score > 80"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono text-[11px] focus:outline-none"
                        />
                      </div>
                    )}

                    {selectedNode.type === 'ACTION' && (
                      <div className="space-y-2">
                        <label className="text-slate-300 font-semibold block">Pilih Tool Sandbox</label>
                        <select
                          value={selectedNode.config?.toolName || 'bash_exec'}
                          onChange={(e) => {
                            const updated = selectedWorkflow!.nodes.map((n) =>
                              n.id === selectedNode.id
                                ? { ...n, config: { ...n.config, toolName: e.target.value } }
                                : n
                            );
                            setSelectedWorkflow({ ...selectedWorkflow!, nodes: updated });
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none"
                        >
                          <option value="bash_exec">bash_exec (Perintah Terminal)</option>
                          <option value="file_read">file_read (Baca Berkas)</option>
                          <option value="file_write">file_write (Tulis Berkas)</option>
                          <option value="http_request">http_request (Panggilan Web/API)</option>
                        </select>
                      </div>
                    )}

                    {selectedNode.type === 'MCP_TOOL' && (
                      <div className="space-y-2">
                        <label className="text-slate-300 font-semibold block">Pilih Server MCP</label>
                        <select
                          value={selectedNode.config?.serverId || ''}
                          onChange={(e) => {
                            const updated = selectedWorkflow!.nodes.map((n) =>
                              n.id === selectedNode.id
                                ? { ...n, config: { ...n.config, serverId: e.target.value } }
                                : n
                            );
                            setSelectedWorkflow({ ...selectedWorkflow!, nodes: updated });
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none"
                        >
                          <option value="">-- Pilih MCP Server --</option>
                          {mcpServers.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.toolsCache?.length || 0} tools)
                            </option>
                          ))}
                        </select>

                        <label className="text-slate-300 font-semibold block">Nama Tool MCP</label>
                        <input
                          type="text"
                          value={selectedNode.config?.toolName || ''}
                          onChange={(e) => {
                            const updated = selectedWorkflow!.nodes.map((n) =>
                              n.id === selectedNode.id
                                ? { ...n, config: { ...n.config, toolName: e.target.value } }
                                : n
                            );
                            setSelectedWorkflow({ ...selectedWorkflow!, nodes: updated });
                          }}
                          placeholder="read_file, fetch, query..."
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono text-[11px] focus:outline-none"
                        />
                      </div>
                    )}

                    {selectedNode.type === 'HUMAN_APPROVAL' && (
                      <div className="space-y-1.5">
                        <label className="text-slate-300 font-semibold block">Alasan / Instruksi Persetujuan</label>
                        <input
                          type="text"
                          value={selectedNode.config?.reason || ''}
                          onChange={(e) => {
                            const updated = selectedWorkflow!.nodes.map((n) =>
                              n.id === selectedNode.id
                                ? { ...n, config: { ...n.config, reason: e.target.value } }
                                : n
                            );
                            setSelectedWorkflow({ ...selectedWorkflow!, nodes: updated });
                          }}
                          placeholder="Konfirmasi tindakan sebelum lanjut..."
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none"
                        />
                      </div>
                    )}

                    {selectedNode.type === 'ALERT' && (
                      <div className="space-y-1.5">
                        <label className="text-slate-300 font-semibold block">Judul Alert</label>
                        <input
                          type="text"
                          value={selectedNode.config?.title || ''}
                          onChange={(e) => {
                            const updated = selectedWorkflow!.nodes.map((n) =>
                              n.id === selectedNode.id
                                ? { ...n, config: { ...n.config, title: e.target.value } }
                                : n
                            );
                            setSelectedWorkflow({ ...selectedWorkflow!, nodes: updated });
                          }}
                          placeholder="Judul notifikasi insiden..."
                          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none"
                        />
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteNode(selectedNode.id)}
                    className="w-full py-2 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 font-semibold text-xs transition flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Node Ini</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Sequential Pipelines (Legacy Preset View) */}
        {activeTab === 'SEQUENTIAL' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* Template Selector Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  1. Pilih Template Swarm Pipeline
                </label>
                <CustomSelect
                  value={selectedTemplateId}
                  onChange={(val) => {
                    setSelectedTemplateId(val);
                    setDecomposedStages([]);
                    setExecutionResult(null);
                  }}
                  options={templates.map((t) => ({
                    value: t.id,
                    label: `${t.name} (${t.stages?.length || 0} Tahap)`
                  }))}
                />
                <p className="text-xs text-slate-400 leading-relaxed">
                  {templates.find((t) => t.id === selectedTemplateId)?.description || 'Pilih template untuk melihat struktur kolaborasi.'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block">
                  2. Proyek Tujuan (Opsional)
                </label>
                <CustomSelect
                  value={selectedProjectId}
                  onChange={(val) => setSelectedProjectId(val)}
                  options={[
                    { value: '', label: '✦ Tanpa Proyek Spesifik' },
                    ...projects.map((p) => ({ value: p.id, label: p.name }))
                  ]}
                />
                <p className="text-xs text-slate-400 leading-relaxed">
                  Hasil keluaran swarm pipeline akan otomatis ditautkan ke repositori dan riwayat proyek yang dipilih.
                </p>
              </div>
            </div>

            {/* Objective Input Form */}
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  3. Sasaran & Objektif Tugas Bersama
                </label>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span>Preset Cepat:</span>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('Bangun fitur SSO OAuth2 Google & GitHub dengan JWT tokens dan rate limiting.')}
                    className="text-purple-400 hover:underline"
                  >
                    OAuth2 SSO
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('Investigasi kendala query PostgreSQL yang lambat dan buatkan indeks optimasi.')}
                    className="text-purple-400 hover:underline"
                  >
                    Optimasi DB
                  </button>
                </div>
              </div>

              <textarea
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                rows={3}
                placeholder="Tuliskan tujuan spesifik yang ingin diselesaikan oleh tim agen AI..."
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleDecompose}
                  disabled={isDecomposing || !objective.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-lg shadow-purple-600/20 transition disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isDecomposing ? 'animate-spin' : ''}`} />
                  <span>{isDecomposing ? 'Mendekomposisi Swarm...' : '✦ Dekomposisi Tahap Swarm'}</span>
                </button>
              </div>
            </div>

            {/* Stages & Execution Review */}
            {decomposedStages.length > 0 && (
              <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Tahapan Kolaborasi Swarm ({decomposedStages.length} Tahap)
                  </h4>
                  <button
                    type="button"
                    onClick={handleExecuteSequentialPipeline}
                    disabled={isExecuting}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg transition disabled:opacity-50"
                  >
                    <Play className={`w-3.5 h-3.5 ${isExecuting ? 'animate-spin' : 'fill-white'}`} />
                    <span>{isExecuting ? 'Mengeksekusi Pipeline...' : 'Jalankan Pipeline Sekarang'}</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {decomposedStages.map((stage, idx) => (
                    <div
                      key={stage.id || idx}
                      className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-purple-950 border border-purple-800 text-purple-300 text-[10px] font-bold flex items-center justify-center font-mono">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-white">{stage.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({stage.agentName || stage.role})
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-300 font-mono bg-slate-950 p-2 rounded-lg border border-slate-800 whitespace-pre-wrap">
                        {stage.stagePromptTemplate || stage.prompt}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Execution Result */}
            {executionResult && (
              <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Hasil Eksekusi Selesai ({executionResult.status})</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleCopySummary}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-xs border border-slate-700"
                  >
                    {copiedSummary ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSummary ? 'Tersalin' : 'Salin Hasil'}</span>
                  </button>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs text-slate-200 whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {executionResult.finalSummary}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-2.5 border-t border-slate-800 bg-slate-900/90 flex justify-between items-center text-xs">
          <span className="text-slate-500 font-mono">
            Autonomous DAG & MCP Multi-Agent Flow Studio
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
