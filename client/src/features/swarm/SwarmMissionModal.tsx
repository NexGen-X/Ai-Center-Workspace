import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Play,
  CheckCircle2,
  Clock,
  AlertCircle,
  Bot,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  GitBranch,
  Network,
  ArrowRight,
  Activity,
  Layers,
  StopCircle,
  MessageSquare,
  FileText,
  Share2,
  RotateCw,
  TrendingUp,
  LayoutGrid,
  Download,
  GitPullRequest,
  FileCode,
  Terminal,
  ExternalLink
} from 'lucide-react';
import {
  AIAgent,
  SwarmMission,
  SwarmSubtask,
  SwarmMessage,
  SwarmMissionStatus,
  SwarmArtifactBundle,
  CreateGitBranchResponse,
  CreateGitHubPRResponse
} from '../../../../shared/types.js';
import { api } from '../../services/api.js';
import { useFeedback } from '../../components/common/FeedbackContext.js';
import { SandboxTerminalViewer, SandboxExecutionResult } from '../../components/common/SandboxTerminalViewer.js';

interface SwarmMissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  agents: AIAgent[];
  onMissionLaunched?: () => void;
}

/**
 * Interactive Topological DAG Visual Canvas Component
 * Renders hierarchical dependency nodes with directional dynamic vectors
 */
const TopologicalDAGCanvas: React.FC<{
  subtasks: SwarmSubtask[];
  activeSubtaskId?: string | null;
  onSelectSubtask?: (subtask: SwarmSubtask) => void;
}> = ({ subtasks, activeSubtaskId, onSelectSubtask }) => {
  if (!subtasks || subtasks.length === 0) return null;

  // 1. Calculate topological rank / depth for each subtask
  const ranks = new Map<string, number>();
  const getRank = (stId: string, visited = new Set<string>()): number => {
    if (ranks.has(stId)) return ranks.get(stId)!;
    if (visited.has(stId)) return 0;
    visited.add(stId);

    const st = subtasks.find(t => t.id === stId);
    if (!st || !st.dependencies || st.dependencies.length === 0) {
      ranks.set(stId, 0);
      return 0;
    }

    let maxDepRank = 0;
    for (const depId of st.dependencies) {
      maxDepRank = Math.max(maxDepRank, getRank(depId, visited));
    }
    const r = maxDepRank + 1;
    ranks.set(stId, r);
    return r;
  };

  subtasks.forEach(st => getRank(st.id));

  // 2. Group subtasks by rank
  const rankGroups = new Map<number, SwarmSubtask[]>();
  subtasks.forEach(st => {
    const r = ranks.get(st.id) || 0;
    if (!rankGroups.has(r)) rankGroups.set(r, []);
    rankGroups.get(r)!.push(st);
  });

  const maxRank = Math.max(...Array.from(rankGroups.keys()), 0);

  // 3. Compute coordinates
  const nodeCoords = new Map<string, { x: number; y: number }>();
  const nodeWidth = 160;
  const nodeHeight = 68;
  const colSpacing = 210;
  const rowSpacing = 95;

  Array.from(rankGroups.entries()).forEach(([r, tasksInRank]) => {
    const totalInCol = tasksInRank.length;
    const startY = Math.max(25, (290 - (totalInCol * rowSpacing)) / 2);

    tasksInRank.forEach((st, i) => {
      const x = 30 + r * colSpacing;
      const y = startY + i * rowSpacing;
      nodeCoords.set(st.id, { x, y });
    });
  });

  const canvasWidth = Math.max(720, (maxRank + 1) * colSpacing + 60);
  const canvasHeight = 310;

  return (
    <div className="w-full overflow-x-auto bg-[#09090b] border border-zinc-800 rounded-2xl p-3 sm:p-4 relative shadow-inner custom-scrollbar">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800/80 text-[11px] text-zinc-400">
        <span className="flex items-center gap-1.5 font-semibold text-zinc-300">
          <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
          <span>Topological DAG Graph Visualizer</span>
        </span>
        <span className="text-[10px] text-zinc-500 hidden sm:inline">Klik node untuk melihat detail</span>
        <span className="text-[10px] text-indigo-400 font-mono sm:hidden">Geser horizontal ↔</span>
      </div>

      <svg
        width={canvasWidth}
        height={canvasHeight}
        className="w-full h-auto min-w-[680px] select-none"
        viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
      >
        <defs>
          <marker
            id="dag-arrow"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#6366f1" />
          </marker>
          <marker
            id="dag-arrow-active"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 9 5 L 0 9 z" fill="#38bdf8" />
          </marker>
        </defs>

        {/* 1. Connecting Vector Paths */}
        {subtasks.map(st => {
          const targetCoord = nodeCoords.get(st.id);
          if (!targetCoord) return null;

          return st.dependencies.map(depId => {
            const srcCoord = nodeCoords.get(depId);
            if (!srcCoord) return null;

            const x1 = srcCoord.x + nodeWidth;
            const y1 = srcCoord.y + nodeHeight / 2;
            const x2 = targetCoord.x;
            const y2 = targetCoord.y + nodeHeight / 2;
            const cx1 = x1 + (x2 - x1) * 0.45;
            const cx2 = x1 + (x2 - x1) * 0.55;

            const pathD = `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;
            const isTargetRunning = st.status === 'RUNNING';
            const isTargetDone = st.status === 'COMPLETED';

            return (
              <g key={`${depId}->${st.id}`}>
                <path
                  d={pathD}
                  fill="none"
                  stroke={isTargetRunning ? '#38bdf8' : isTargetDone ? '#10b981' : '#334155'}
                  strokeWidth={isTargetRunning ? 2.5 : 1.5}
                  strokeDasharray={isTargetRunning ? '6,4' : 'none'}
                  markerEnd={isTargetRunning ? 'url(#dag-arrow-active)' : 'url(#dag-arrow)'}
                  className={isTargetRunning ? 'animate-pulse' : ''}
                />
              </g>
            );
          });
        })}

        {/* 2. Interactive SVG Nodes */}
        {subtasks.map((st, idx) => {
          const coord = nodeCoords.get(st.id);
          if (!coord) return null;

          const isRunning = st.status === 'RUNNING';
          const isDone = st.status === 'COMPLETED';
          const isFailed = st.status === 'FAILED';
          const hasRevisions = (st.feedbackLoopCount || 0) > 0;
          const isSelected = activeSubtaskId === st.id;

          return (
            <g
              key={st.id}
              transform={`translate(${coord.x}, ${coord.y})`}
              className="cursor-pointer group"
              onClick={() => onSelectSubtask?.(st)}
            >
              {/* Outer Glow Halo for Active / Running */}
              {isRunning && (
                <rect
                  x="-3"
                  y="-3"
                  width={nodeWidth + 6}
                  height={nodeHeight + 6}
                  rx="14"
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="2"
                  className="animate-ping opacity-40"
                />
              )}

              {/* Node Card Rectangle */}
              <rect
                x="0"
                y="0"
                width={nodeWidth}
                height={nodeHeight}
                rx="12"
                fill="#0f172a"
                stroke={
                  isSelected
                    ? '#818cf8'
                    : isRunning
                    ? '#6366f1'
                    : isDone
                    ? '#10b981'
                    : isFailed
                    ? '#ef4444'
                    : '#1e293b'
                }
                strokeWidth={isSelected || isRunning ? 2 : 1}
                className="transition-colors group-hover:stroke-indigo-400 shadow-md"
              />

              {/* Step Number Circle */}
              <circle
                cx="16"
                cy="18"
                r="8"
                fill={isDone ? '#065f46' : isRunning ? '#312e81' : '#1e293b'}
              />
              <text
                x="16"
                y="21.5"
                fill={isDone ? '#34d399' : isRunning ? '#a5b4fc' : '#94a3b8'}
                fontSize="9"
                fontWeight="bold"
                textAnchor="middle"
              >
                {idx + 1}
              </text>

              {/* Role Badge */}
              <text
                x="30"
                y="21"
                fill="#94a3b8"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="bold"
              >
                {st.role.slice(0, 15)}
              </text>

              {/* Title */}
              <text
                x="12"
                y="39"
                fill="#f1f5f9"
                fontSize="10"
                fontWeight="bold"
              >
                {st.title.length > 21 ? `${st.title.slice(0, 20)}…` : st.title}
              </text>

              {/* Assigned Agent Name */}
              <text
                x="12"
                y="55"
                fill="#818cf8"
                fontSize="9"
              >
                ✦ {st.assignedAgentName || 'Spesialis'}
              </text>

              {/* Self-Correction Badge */}
              {hasRevisions && (
                <g transform="translate(112, 5)">
                  <rect x="0" y="0" width="42" height="13" rx="4" fill="#78350f" />
                  <text x="21" y="9.5" fill="#fde68a" fontSize="7.5" fontWeight="bold" textAnchor="middle">
                    Rev #{st.feedbackLoopCount}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export const SwarmMissionModal: React.FC<SwarmMissionModalProps> = ({
  isOpen,
  onClose,
  agents,
  onMissionLaunched
}) => {
  const { toast } = useFeedback();

  // Active Tab: 'planner' | 'monitor' | 'feed' | 'artifacts' | 'archive'
  const [activeTab, setActiveTab] = useState<'planner' | 'monitor' | 'feed' | 'artifacts' | 'archive'>('planner');

  // View modes
  const [plannerViewMode, setPlannerViewMode] = useState<'graph' | 'cards'>('graph');
  const [monitorViewMode, setMonitorViewMode] = useState<'graph' | 'cards'>('graph');

  // Planner form state
  const [objective, setObjective] = useState('');
  const [title, setTitle] = useState('');
  const [isPlanning, setIsPlanning] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [plannedSubtasks, setPlannedSubtasks] = useState<SwarmSubtask[]>([]);
  const [coordinatorAgent, setCoordinatorAgent] = useState<AIAgent | null>(null);

  // Active & selected mission state
  const [activeMission, setActiveMission] = useState<SwarmMission | null>(null);
  const [missionMessages, setMissionMessages] = useState<SwarmMessage[]>([]);
  const [pastMissions, setPastMissions] = useState<SwarmMission[]>([]);
  const [loadingPastMissions, setLoadingPastMissions] = useState(false);
  const [isResuming, setIsResuming] = useState(false);

  // Swarm Artifacts State
  const [artifactBundle, setArtifactBundle] = useState<SwarmArtifactBundle | null>(null);
  const [loadingArtifacts, setLoadingArtifacts] = useState(false);
  const [artifactSubTab, setArtifactSubTab] = useState<'report' | 'files' | 'patch'>('report');
  const [copiedPatch, setCopiedPatch] = useState(false);
  const [copiedFileIndex, setCopiedFileIndex] = useState<number | null>(null);
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [gitBranchResult, setGitBranchResult] = useState<CreateGitBranchResponse | null>(null);
  const [customBranchName, setCustomBranchName] = useState('');
  const [customCommitMessage, setCustomCommitMessage] = useState('');
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);

  // GitHub PR Bot State
  const [isPRModalOpen, setIsPRModalOpen] = useState(false);
  const [isCreatingPR, setIsCreatingPR] = useState(false);
  const [gitPRResult, setGitPRResult] = useState<CreateGitHubPRResponse | null>(null);
  const [githubRepoOwner, setGithubRepoOwner] = useState(() => localStorage.getItem('swarm_gh_owner') || 'NexGen-X');
  const [githubRepoName, setGithubRepoName] = useState(() => localStorage.getItem('swarm_gh_repo') || 'Ai-Center-Workspace');
  const [githubBaseBranch, setGithubBaseBranch] = useState('main');
  const [githubPRTitle, setGithubPRTitle] = useState('');
  const [githubToken, setGithubToken] = useState(() => localStorage.getItem('swarm_gh_token') || '');

  // Sandbox Runner for extracted code files
  const [sandboxResults, setSandboxResults] = useState<Record<number, SandboxExecutionResult>>({});
  const [executingSandboxIndex, setExecutingSandboxIndex] = useState<number | null>(null);

  const handleTestFileInSandbox = async (filePath: string, language: string, content: string, index: number) => {
    setExecutingSandboxIndex(index);
    try {
      const res = await api.runCodeInSandbox({ language, code: content, timeoutMs: 25000 });
      setSandboxResults(prev => ({ ...prev, [index]: res }));
      if (res.success) {
        toast.success(`Uji sandbox untuk [${filePath}] sukses (Exit: 0, ${res.durationMs}ms)!`);
      } else {
        toast.error(`Uji sandbox [${filePath}] selesai dengan kode keluar ${res.exitCode}.`);
      }
    } catch (err: any) {
      toast.error(`Gagal menguji file di sandbox: ${err.message}`);
    } finally {
      setExecutingSandboxIndex(null);
    }
  };

  // Subtask accordion expansion in monitor
  const [expandedSubtasks, setExpandedSubtasks] = useState<Record<string, boolean>>({});
  const [copiedSynthesis, setCopiedSynthesis] = useState(false);

  // Chat feed scroll ref
  const feedEndRef = useRef<HTMLDivElement>(null);

  // Load past missions when modal opens or archive tab activated
  const fetchPastMissions = async () => {
    setLoadingPastMissions(true);
    try {
      const res = await api.getSwarmMissions();
      setPastMissions(res.missions || []);
    } catch (err: any) {
      console.error('Failed to load past missions:', err);
    } finally {
      setLoadingPastMissions(false);
    }
  };

  const fetchArtifacts = async (missionId: string) => {
    setLoadingArtifacts(true);
    setGitBranchResult(null);
    try {
      const res = await api.getSwarmArtifacts(missionId);
      if (res && res.data) {
        setArtifactBundle(res.data);
      }
    } catch (err: any) {
      console.error('Failed to load artifacts:', err);
      toast.error('Gagal memuat artefak: ' + (err.message || err));
    } finally {
      setLoadingArtifacts(false);
    }
  };

  const handleCreateGitBranch = async () => {
    if (!activeMission) return;
    try {
      setIsCreatingBranch(true);
      const res = await api.createSwarmGitBranch(activeMission.id, {
        branchName: customBranchName.trim() || undefined,
        commitMessage: customCommitMessage.trim() || undefined
      });
      setGitBranchResult(res);
      setIsBranchModalOpen(false);
      toast.success(`Branch Git "${res.branchName}" berhasil dibuat (${res.commitHash.slice(0, 7)})!`);
    } catch (err: any) {
      toast.error(`Gagal membuat branch Git: ${err.message || err}`);
    } finally {
      setIsCreatingBranch(false);
    }
  };

  const handleCreateGitHubPR = async () => {
    if (!activeMission) return;
    try {
      setIsCreatingPR(true);
      localStorage.setItem('swarm_gh_owner', githubRepoOwner.trim());
      localStorage.setItem('swarm_gh_repo', githubRepoName.trim());
      if (githubToken.trim()) {
        localStorage.setItem('swarm_gh_token', githubToken.trim());
      }
      const res = await api.createSwarmGitHubPR(activeMission.id, {
        repoOwner: githubRepoOwner.trim(),
        repoName: githubRepoName.trim(),
        baseBranch: githubBaseBranch.trim() || 'main',
        prTitle: githubPRTitle.trim() || `feat(swarm): ${activeMission.title}`,
        githubToken: githubToken.trim() || undefined
      });
      setGitPRResult(res);
      setIsPRModalOpen(false);
      toast.success(res.message);
    } catch (err: any) {
      toast.error(`Gagal membuka GitHub PR: ${err.message || err}`);
    } finally {
      setIsCreatingPR(false);
    }
  };

  const handleDownloadMarkdown = () => {
    if (!activeMission) return;
    window.open(`/api/swarm/missions/${activeMission.id}/artifacts/markdown`, '_blank');
  };

  const handleCopyPatch = () => {
    if (!artifactBundle?.unifiedPatch) return;
    navigator.clipboard.writeText(artifactBundle.unifiedPatch);
    setCopiedPatch(true);
    setTimeout(() => setCopiedPatch(false), 2000);
    toast.success('Unified patch disalin ke clipboard!');
  };

  const handleCopyFileContent = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedFileIndex(index);
    setTimeout(() => setCopiedFileIndex(null), 2000);
    toast.success('Kode berhasil disalin!');
  };

  useEffect(() => {
    if (isOpen) {
      fetchPastMissions();
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Auto-scroll inter-agent feed when new messages arrive
  useEffect(() => {
    if (activeTab === 'feed') {
      feedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [missionMessages, activeTab]);

  // SSE Listener for real-time mission updates
  useEffect(() => {
    if (!isOpen) return;

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/realtime');

      eventSource.addEventListener('swarm.mission_started', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data.mission) {
            setActiveMission(data.mission);
          }
        } catch {}
      });

      eventSource.addEventListener('swarm.subtask_dispatched', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setActiveMission(prev => {
            if (!prev || prev.id !== data.missionId) return prev;
            const updated = prev.subtasks.map(st =>
              st.id === data.subtask.id ? data.subtask : st
            );
            return { ...prev, subtasks: updated };
          });
        } catch {}
      });

      eventSource.addEventListener('swarm.agent_handoff', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          const handoffMsg: SwarmMessage = {
            id: `handoff-${Date.now()}`,
            missionId: data.missionId,
            fromAgentId: data.fromAgentId,
            fromAgentName: data.fromAgentName,
            toAgentId: data.toAgentId,
            toAgentName: data.toAgentName,
            messageType: 'HANDOFF',
            content: data.summary,
            createdAt: new Date().toISOString()
          };
          setMissionMessages(prev => [...prev, handoffMsg]);
        } catch {}
      });

      eventSource.addEventListener('swarm.agent_feedback_loop', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          const feedbackMsg: SwarmMessage = {
            id: `feedback-loop-${Date.now()}`,
            missionId: data.missionId,
            fromAgentId: data.fromAgentId,
            fromAgentName: data.fromAgentName,
            toAgentId: data.toAgentId,
            toAgentName: data.toAgentName,
            messageType: 'FEEDBACK',
            content: `🔄 [SELF-CORRECTION LOOP] QA Sentinel meminta perbaikan: "${data.critique}"`,
            createdAt: new Date().toISOString()
          };
          setMissionMessages(prev => [...prev, feedbackMsg]);
          toast.info(`🔄 Self-Correction: ${data.fromAgentName} meminta revisi ke ${data.toAgentName}`);
        } catch {}
      });

      eventSource.addEventListener('swarm.subtask_completed', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setActiveMission(prev => {
            if (!prev || prev.id !== data.missionId) return prev;
            const updated = prev.subtasks.map(st =>
              st.id === data.subtask.id ? data.subtask : st
            );
            return { ...prev, subtasks: updated };
          });

          if (data.missionId) {
            api.getSwarmMission(data.missionId).then(res => {
              setMissionMessages(res.messages || []);
            }).catch(() => {});
          }
        } catch {}
      });

      eventSource.addEventListener('swarm.mission_completed', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setActiveMission(prev => {
            if (!prev || prev.id !== data.missionId) return prev;
            return {
              ...prev,
              status: data.status,
              totalDurationMs: data.totalDurationMs,
              finalSynthesis: data.finalSynthesis
            };
          });
          fetchPastMissions();
          toast.success(`Misi Swarm telah selesai (${data.status})!`);
        } catch {}
      });

      eventSource.addEventListener('swarm.mission_cancelled', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setActiveMission(prev => {
            if (!prev || prev.id !== data.missionId) return prev;
            return { ...prev, status: 'CANCELLED' };
          });
          toast.info('Misi Swarm dijeda atau dibatalkan.');
        } catch {}
      });
    } catch {}

    return () => {
      eventSource?.close();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Preset prompts
  const presets = [
    {
      title: 'Full-Stack Security Audit & Hardening',
      desc: 'Analisis celah injeksi, rancang mitigasi, implementasi sanitasi input, dan verifikasi batas tepi.',
      prompt: 'Lakukan audit keamanan menyeluruh terhadap sistem otentikasi dan API Command Center. Identifikasi potensi SSRF, broken access control, dan data leak. Buat rancangan patch hardening, implementasikan perbaikan, serta lakukan uji penetrasi empiris.'
    },
    {
      title: 'Autonomous Microservice & API Scaffold',
      desc: 'Rancang spesifikasi OpenAPI, scaffold service modular, validasi integritas schema DB.',
      prompt: 'Rancang dan implementasikan microservice telemetri baru untuk mengumpulkan metrik GPU & RAM secara real-time. Tentukan kontrak endpoint REST, bangun handler yang efisien, dan sediakan acceptance test otomatis.'
    },
    {
      title: 'Incident Triage & Root-Cause Patch',
      desc: 'Diagnosis anomali runtime, investigasi log stack trace, terbitkan hotfix, dan verifikasi regresi.',
      prompt: 'Terjadi anomali timeout koneksi pada salah satu model provider lokal saat konkurensi tinggi. Lakukan root cause analysis pada adapter pooling, buat skenario reproduksi, berikan patch mitigasi circuit breaker, dan verifikasi kestabilan.'
    }
  ];

  const handleApplyPreset = (prompt: string, presetTitle: string) => {
    setObjective(prompt);
    setTitle(presetTitle);
  };

  // Plan dynamic DAG
  const handleGeneratePlan = async () => {
    if (!objective.trim()) {
      toast.error('Silakan isi objektif misi terlebih dahulu.');
      return;
    }

    setIsPlanning(true);
    try {
      const plan = await api.planSwarm(objective.trim());
      setPlannedSubtasks(plan.subtasks || []);
      setCoordinatorAgent(plan.coordinatorAgent);
      if (!title) {
        setTitle(plan.title);
      }
      toast.success('Rencana Dynamic DAG berhasil didekomposisi oleh Lead Coordinator!');
    } catch (err: any) {
      toast.error(err.message || 'Gagal merancang dynamic DAG swarm.');
    } finally {
      setIsPlanning(false);
    }
  };

  // Dispatch swarm mission
  const handleDispatchSwarm = async () => {
    if (!objective.trim()) {
      toast.error('Silakan isi objektif misi terlebih dahulu.');
      return;
    }

    setIsDispatching(true);
    try {
      const mission = await api.dispatchSwarm({
        objective: objective.trim(),
        title: title.trim() || undefined,
        subtasks: plannedSubtasks.length > 0 ? plannedSubtasks : undefined,
        coordinatorAgentId: coordinatorAgent?.id
      });

      setActiveMission(mission);
      setActiveTab('monitor');
      onMissionLaunched?.();
      toast.success('🚀 Autonomous Multi-Agent Swarm berhasil diluncurkan!');

      api.getSwarmMission(mission.id).then(res => {
        setMissionMessages(res.messages || []);
      }).catch(() => {});
    } catch (err: any) {
      toast.error(err.message || 'Gagal meluncurkan misi swarm.');
    } finally {
      setIsDispatching(false);
    }
  };

  // Cancel mission
  const handleCancelMission = async () => {
    if (!activeMission) return;
    try {
      await api.cancelSwarmMission(activeMission.id);
      toast.info('Permintaan pembatalan misi telah dikirim.');
    } catch (err: any) {
      toast.error(err.message || 'Gagal membatalkan misi.');
    }
  };

  // Resume paused or interrupted mission
  const handleResumeMission = async () => {
    if (!activeMission) return;
    setIsResuming(true);
    try {
      const res = await api.resumeSwarmMission(activeMission.id);
      setActiveMission(res.mission);
      toast.success('Misi Swarm dilanjutkan kembali dari checkpoint!');
    } catch (err: any) {
      toast.error(err.message || 'Gagal melanjutkan misi swarm.');
    } finally {
      setIsResuming(false);
    }
  };

  // View past mission
  const handleSelectPastMission = async (m: SwarmMission) => {
    try {
      const res = await api.getSwarmMission(m.id);
      setActiveMission(res.mission);
      setMissionMessages(res.messages || []);
      setActiveTab('monitor');
    } catch (err: any) {
      toast.error(err.message || 'Gagal memuat data misi arsip.');
    }
  };

  // Toggle subtask accordion
  const toggleSubtaskAccordion = (id: string) => {
    setExpandedSubtasks(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Copy final synthesis
  const handleCopySynthesis = () => {
    if (!activeMission?.finalSynthesis) return;
    navigator.clipboard.writeText(activeMission.finalSynthesis);
    setCopiedSynthesis(true);
    setTimeout(() => setCopiedSynthesis(false), 2000);
    toast.success('Laporan sintesis disalin ke clipboard!');
  };

  // Calculations for progress
  const totalSubtasks = activeMission?.subtasks?.length || 0;
  const completedSubtasks = activeMission?.subtasks?.filter(s => s.status === 'COMPLETED').length || 0;
  const progressPercent = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-[#09090b] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header */}
        <div className="flex items-start sm:items-center justify-between gap-3 px-4 sm:px-5 py-3 sm:py-4 border-b border-zinc-800 bg-[#09090b]">
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            <div className="p-2 sm:p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0 mt-0.5 sm:mt-0">
              <Network className="w-4 h-4 sm:w-5 sm:h-5 animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight truncate sm:whitespace-normal">
                  Autonomous Multi-Agent Swarm
                </h2>
                <span className="hidden sm:inline text-sm sm:text-base font-bold text-white tracking-tight">
                  & Hierarchical Mesh
                </span>
                <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold tracking-wider uppercase rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Dynamic DAG
                </span>
                <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-semibold tracking-wider uppercase rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Self-Correction
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-zinc-400 line-clamp-1 sm:line-clamp-none mt-0.5">
                Dekomposisi tugas otonom, siklus perbaikan mandiri, dan koordinasi visual multi-agen real-time.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition shrink-0 ml-1"
            title="Tutup Swarm Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-3 sm:px-5 border-b border-zinc-800 bg-zinc-950/70 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('planner')}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'planner'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Perencana Misi (DAG Planner)</span>
          </button>

          <button
            onClick={() => setActiveTab('monitor')}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'monitor'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Monitor DAG Real-Time</span>
            {activeMission && activeMission.status === 'EXECUTING' && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('feed')}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'feed'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Transkrip Handoff Antar-Agen</span>
            {missionMessages.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-indigo-300 font-mono">
                {missionMessages.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('artifacts');
              if (activeMission) {
                fetchArtifacts(activeMission.id);
              }
            }}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'artifacts'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            <span>Artefak & Ekspor Git</span>
            {artifactBundle?.extractedFiles && artifactBundle.extractedFiles.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-mono">
                {artifactBundle.extractedFiles.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setActiveTab('archive');
              fetchPastMissions();
            }}
            className={`flex items-center gap-2 py-3 px-3.5 text-xs font-semibold border-b-2 transition whitespace-nowrap ${
              activeTab === 'archive'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Arsip Misi & Sintesis</span>
            {pastMissions.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-400 font-mono">
                {pastMissions.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* TAB 1: PLANNER & DAG BUILDER */}
          {activeTab === 'planner' && (
            <div className="space-y-5">
              {/* Objective Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <span>Tujuan / Objektif Misi (Instruksi Bebas)</span>
                  <span className="text-[11px] font-normal text-slate-400">
                    Coordinator Agent akan memecah instruksi ini menjadi DAG subtugas otonom
                  </span>
                </label>
                <textarea
                  value={objective}
                  onChange={e => setObjective(e.target.value)}
                  placeholder="Contoh: Rancang sistem audit keamanan API terintegrasi, temukan celah, implementasikan patch, dan buat pengujian otomatis..."
                  className="w-full h-28 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder:text-slate-500 text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition resize-none leading-relaxed"
                />
              </div>

              {/* Title Input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">
                  Judul Misi (Opsional)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Dihasilkan otomatis jika dibiarkan kosong"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 placeholder:text-slate-500 text-xs focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              {/* Presets */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Preset Misi Populer:
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {presets.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPreset(p.prompt, p.title)}
                      className="p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 text-left transition group space-y-1"
                    >
                      <div className="text-xs font-bold text-slate-200 group-hover:text-indigo-400 transition flex items-center justify-between">
                        <span>{p.title}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition" />
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                        {p.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Plan Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={handleGeneratePlan}
                  disabled={isPlanning || !objective.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-indigo-300 text-xs font-semibold border border-indigo-500/30 transition"
                >
                  <Sparkles className={`w-4 h-4 ${isPlanning ? 'animate-spin' : ''}`} />
                  <span>{isPlanning ? 'Menganalisis & Mendekomposisi...' : '✦ Rancang Dynamic DAG (Preview)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDispatchSwarm}
                  disabled={isDispatching || !objective.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition active:scale-95 disabled:opacity-50"
                >
                  <Play className={`w-4 h-4 ${isDispatching ? 'animate-spin' : 'fill-white'}`} />
                  <span>{isDispatching ? 'Menyiapkan Swarm...' : 'Luncurkan Autonomous Swarm 🚀'}</span>
                </button>
              </div>

              {/* Planned Subtasks Preview with Mode Toggle */}
              {plannedSubtasks.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-slate-800">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-indigo-400" />
                      <h3 className="text-xs font-bold text-slate-200">
                        Pratinjau Dynamic Directed Acyclic Graph (DAG)
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-300 font-mono">
                        {plannedSubtasks.length} Subtugas
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {coordinatorAgent && (
                        <span className="text-[11px] text-slate-400 hidden sm:inline">
                          Koordinator: <strong className="text-indigo-300">{coordinatorAgent.name}</strong>
                        </span>
                      )}
                      <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                        <button
                          onClick={() => setPlannerViewMode('graph')}
                          className={`px-2 py-1 rounded text-[10px] font-semibold transition ${
                            plannerViewMode === 'graph' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Graf DAG
                        </button>
                        <button
                          onClick={() => setPlannerViewMode('cards')}
                          className={`px-2 py-1 rounded text-[10px] font-semibold transition ${
                            plannerViewMode === 'cards' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Kartu
                        </button>
                      </div>
                    </div>
                  </div>

                  {plannerViewMode === 'graph' ? (
                    <TopologicalDAGCanvas subtasks={plannedSubtasks} />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {plannedSubtasks.map((st, idx) => (
                        <div
                          key={st.id}
                          className="p-3.5 rounded-xl bg-slate-900 border border-slate-800/90 space-y-2 relative"
                        >
                          <div className="flex items-center justify-between">
                            <span className="w-5 h-5 rounded-lg bg-indigo-500/20 text-indigo-400 text-[11px] font-bold flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                              {st.role}
                            </span>
                          </div>

                          <div className="text-xs font-bold text-slate-200">
                            {st.title}
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span>
                              Agen:{' '}
                              <strong className="text-slate-300">
                                {st.assignedAgentName || 'Spesialis'}
                              </strong>
                            </span>
                            {st.dependencies.length > 0 ? (
                              <span className="text-amber-400/90 text-[10px]">
                                Tergantung: {st.dependencies.join(', ')}
                              </span>
                            ) : (
                              <span className="text-emerald-400/90 text-[10px]">
                                Root Node
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-slate-400 italic line-clamp-2 bg-slate-950/40 p-2 rounded-lg border border-slate-800/50">
                            {st.promptTemplate}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LIVE DAG MONITOR */}
          {activeTab === 'monitor' && (
            <div className="space-y-5">
              {!activeMission ? (
                <div className="py-16 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                    <Activity className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-300">
                    Belum Ada Misi Swarm yang Aktif
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Kunjungi tab Perencana Misi untuk meluncurkan swarm otonom baru, atau pilih salah satu dari arsip.
                  </p>
                  <button
                    onClick={() => setActiveTab('planner')}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition"
                  >
                    Buka Perencana Misi
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Mission Summary Card */}
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white">
                            {activeMission.title}
                          </h3>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                              activeMission.status === 'EXECUTING'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                                : activeMission.status === 'COMPLETED'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : activeMission.status === 'CANCELLED'
                                ? 'bg-slate-700 text-slate-300'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            }`}
                          >
                            {activeMission.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {activeMission.objective}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {activeMission.status === 'EXECUTING' && (
                          <button
                            onClick={handleCancelMission}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition"
                          >
                            <StopCircle className="w-3.5 h-3.5" />
                            <span>Jeda / Batalkan</span>
                          </button>
                        )}
                        {activeMission.status === 'CANCELLED' && (
                          <button
                            onClick={handleResumeMission}
                            disabled={isResuming}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition"
                          >
                            <RotateCw className={`w-3.5 h-3.5 ${isResuming ? 'animate-spin' : ''}`} />
                            <span>Lanjutkan Eksekusi</span>
                          </button>
                        )}
                        {activeMission.finalSynthesis && (
                          <button
                            onClick={handleCopySynthesis}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                          >
                            {copiedSynthesis ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>Salin Laporan</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar & Stats */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>
                          Kemajuan Koordinasi DAG: <strong className="text-slate-200">{completedSubtasks}/{totalSubtasks} Subtugas</strong>
                        </span>
                        <span>{progressPercent}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-400 transition-all duration-500"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* DAG View Mode Controls */}
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Alur Eksekusi Subtugas Multi-Agen
                    </h4>
                    <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                      <button
                        onClick={() => setMonitorViewMode('graph')}
                        className={`px-2 py-1 rounded text-[10px] font-semibold transition flex items-center gap-1 ${
                          monitorViewMode === 'graph' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <GitBranch className="w-3 h-3" />
                        <span>Graf DAG</span>
                      </button>
                      <button
                        onClick={() => setMonitorViewMode('cards')}
                        className={`px-2 py-1 rounded text-[10px] font-semibold transition flex items-center gap-1 ${
                          monitorViewMode === 'cards' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <LayoutGrid className="w-3 h-3" />
                        <span>Daftar Subtugas</span>
                      </button>
                    </div>
                  </div>

                  {/* Topological DAG Visual Canvas */}
                  {monitorViewMode === 'graph' && (
                    <TopologicalDAGCanvas
                      subtasks={activeMission.subtasks}
                      onSelectSubtask={st => toggleSubtaskAccordion(st.id)}
                    />
                  )}

                  {/* Subtask Cards & Accordion */}
                  <div className="space-y-2.5">
                    {activeMission.subtasks.map((st, idx) => {
                      const isExpanded = expandedSubtasks[st.id] ?? false;
                      const hasRevisions = (st.feedbackLoopCount || 0) > 0;

                      return (
                        <div
                          key={st.id}
                          className={`rounded-xl border transition overflow-hidden ${
                            st.status === 'RUNNING'
                              ? 'bg-indigo-950/20 border-indigo-500/50 shadow-md shadow-indigo-950/50'
                              : st.status === 'COMPLETED'
                              ? 'bg-slate-900 border-emerald-500/30'
                              : st.status === 'FAILED'
                              ? 'bg-slate-900 border-rose-500/30'
                              : 'bg-slate-900/60 border-slate-800 opacity-70'
                          }`}
                        >
                          {/* Card Header */}
                          <div
                            onClick={() => toggleSubtaskAccordion(st.id)}
                            className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-800/40 transition gap-2"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center">
                                {st.status === 'COMPLETED' ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                ) : st.status === 'RUNNING' ? (
                                  <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
                                ) : st.status === 'FAILED' ? (
                                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                                ) : (
                                  <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                                )}
                              </div>

                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-200">
                                    #{idx + 1} {st.title}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                                    {st.role}
                                  </span>
                                  {hasRevisions && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                                      🔄 Self-Corrected ({st.feedbackLoopCount}x)
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                  <span>Agen: <strong className="text-indigo-300">{st.assignedAgentName || 'Spesialis'}</strong></span>
                                  {st.durationMs ? (
                                    <span>• {(st.durationMs / 1000).toFixed(1)} detik</span>
                                  ) : null}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {st.status === 'RUNNING' && (
                                <span className="text-[10px] font-bold text-indigo-400 animate-pulse">
                                  SEDANG BERJALAN...
                                </span>
                              )}
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                          </div>

                          {/* Card Details (Accordion) */}
                          {isExpanded && (
                            <div className="px-4 pb-4 pt-1 border-t border-slate-800/60 bg-slate-950/30 space-y-3">
                              <div className="space-y-1">
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                  Instruksi / Prompt Subtugas:
                                </span>
                                <p className="text-[11px] font-mono text-slate-300 bg-slate-900 p-2.5 rounded-lg border border-slate-800 whitespace-pre-wrap">
                                  {st.promptTemplate}
                                </p>
                              </div>

                              {/* Revision History Box */}
                              {st.revisions && st.revisions.length > 0 && (
                                <div className="space-y-2 p-3 rounded-lg bg-amber-950/20 border border-amber-500/30">
                                  <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                                    <RotateCw className="w-3 h-3 text-amber-400" />
                                    <span>Siklus Perbaikan Mandiri (Self-Correction Audit Trail):</span>
                                  </span>
                                  {st.revisions.map((rev, rIdx) => (
                                    <div key={rIdx} className="text-[11px] text-slate-300 space-y-1 pl-2 border-l-2 border-amber-500/40">
                                      <p className="font-semibold text-amber-200">
                                        Iterasi #{rev.iteration} — {new Date(rev.timestamp).toLocaleTimeString('id-ID')}
                                      </p>
                                      <p className="italic text-slate-400 bg-slate-900/60 p-2 rounded border border-slate-800">
                                        Critique: {rev.critique}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {st.outputResult && (
                                <div className="space-y-1">
                                  <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
                                    Hasil Keluaran Agen:
                                  </span>
                                  <div className="text-xs text-slate-200 bg-slate-900/90 p-3 rounded-lg border border-emerald-500/20 max-h-60 overflow-y-auto whitespace-pre-wrap leading-relaxed font-sans">
                                    {st.outputResult}
                                  </div>
                                </div>
                              )}

                              {st.error && (
                                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                                  <strong>Kendala:</strong> {st.error}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LIVE INTER-AGENT HANDOFF FEED */}
          {activeTab === 'feed' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-indigo-400" />
                    <span>Transkrip Handoff & Komunikasi Antar-Agen</span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Aliran pesan koordinasi real-time saat agen membagikan artefak, feedback revisi, dan delegasi subtugas.
                  </p>
                </div>
              </div>

              {missionMessages.length === 0 ? (
                <div className="py-16 text-center text-xs text-slate-500">
                  Belum ada pesan komunikasi antar-agen yang tercatat untuk misi ini.
                </div>
              ) : (
                <div className="space-y-3">
                  {missionMessages.map(msg => {
                    const isHandoff = msg.messageType === 'HANDOFF';
                    const isDelegation = msg.messageType === 'DELEGATION';
                    const isSynthesis = msg.messageType === 'SYNTHESIS';

                    return (
                      <div
                        key={msg.id}
                        className={`p-3.5 rounded-xl border space-y-1.5 transition ${
                          isHandoff
                            ? 'bg-cyan-950/20 border-cyan-500/30'
                            : isDelegation
                            ? 'bg-indigo-950/20 border-indigo-500/30'
                            : isSynthesis
                            ? 'bg-emerald-950/20 border-emerald-500/30'
                            : 'bg-slate-900 border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold uppercase font-mono ${
                                isHandoff
                                  ? 'bg-cyan-500/20 text-cyan-300'
                                  : isDelegation
                                  ? 'bg-indigo-500/20 text-indigo-300'
                                  : isSynthesis
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {msg.messageType}
                            </span>
                            <span className="font-semibold text-slate-300">
                              {msg.fromAgentName || 'Lead Coordinator'}
                              {msg.toAgentName ? ` ➔ ${msg.toAgentName}` : ''}
                            </span>
                          </div>
                          <span className="text-slate-500 font-mono text-[10px]">
                            {new Date(msg.createdAt).toLocaleTimeString('id-ID')}
                          </span>
                        </div>

                        <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                          {msg.content}
                        </p>
                      </div>
                    );
                  })}
                  <div ref={feedEndRef} />
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ARTIFACTS & GIT PR GENERATOR */}
          {activeTab === 'artifacts' && (
            <div className="space-y-4">
              {!activeMission ? (
                <div className="text-center py-16 border border-dashed border-slate-800 rounded-2xl p-6 bg-slate-950/20 space-y-3">
                  <GitBranch className="w-10 h-10 text-slate-600 mx-auto" />
                  <h3 className="text-sm font-semibold text-slate-300">Belum ada Misi Swarm yang dipilih</h3>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Jalankan misi baru di tab Perencana atau pilih salah satu misi yang telah selesai di tab Arsip untuk meninjau laporan eksekutif, mengekstrak kode, dan membuat Git branch otomatis.
                  </p>
                  {pastMissions.length > 0 && (
                    <div className="pt-2">
                      <button
                        onClick={() => {
                          const latest = pastMissions[0];
                          handleSelectPastMission(latest);
                          fetchArtifacts(latest.id);
                        }}
                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-lg"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Pilih Misi Terakhir: "{pastMissions[0].title.slice(0, 30)}..."</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : loadingArtifacts ? (
                <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-3">
                  <RotateCw className="w-7 h-7 animate-spin text-indigo-400" />
                  <span className="text-xs font-medium">Mengompilasi artefak & mengekstrak file kode dari subtask...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Top Header Card */}
                  <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {activeMission.status}
                        </span>
                        <h3 className="text-sm font-bold text-white">{activeMission.title}</h3>
                      </div>
                      <p className="text-xs text-slate-400 font-mono text-[11px]">
                        ID: {activeMission.id} | Subtask: {activeMission.subtasks?.length || 0} | File Terekstraksi: {artifactBundle?.extractedFiles?.length || 0}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={handleDownloadMarkdown}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition shadow-sm"
                        title="Unduh laporan markdown"
                      >
                        <Download className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Unduh .md</span>
                      </button>

                      <button
                        onClick={handleCopyPatch}
                        disabled={!artifactBundle?.unifiedPatch}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition shadow-sm disabled:opacity-50"
                        title="Salin unified diff patch ke clipboard"
                      >
                        {copiedPatch ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-purple-400" />}
                        <span>Salin .patch</span>
                      </button>

                      <button
                        onClick={() => {
                          setCustomBranchName(`feature/swarm-${activeMission.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 25)}`);
                          setCustomCommitMessage(`feat(swarm): automated deliverables for "${activeMission.title}"`);
                          setIsBranchModalOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition shadow-sm"
                        title="Buat Git branch dan commit file secara lokal di server"
                      >
                        <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Commit ke Branch</span>
                      </button>

                      <button
                        onClick={() => {
                          setGithubPRTitle(`feat(swarm): ${activeMission.title}`);
                          setIsPRModalOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold transition shadow-md"
                        title="Buka automated GitHub Pull Request dengan seluruh artefak kode misi ini"
                      >
                        <GitPullRequest className="w-3.5 h-3.5" />
                        <span>⚡ Buka GitHub PR</span>
                      </button>
                    </div>
                  </div>

                  {/* GitHub PR Created Callout */}
                  {gitPRResult && (
                    <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 text-xs space-y-2 animate-in fade-in">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2 font-bold text-white">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>{gitPRResult.isSimulated ? 'Tautan Perbandingan GitHub Siap!' : `Pull Request #${gitPRResult.prNumber} Berhasil Dibuka!`}</span>
                        </div>
                        <a
                          href={gitPRResult.prUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow"
                        >
                          <span>Buka di GitHub</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                      <div className="text-[11px] text-slate-300">
                        {gitPRResult.message}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-mono text-emerald-400/80 flex-wrap">
                        <span>Branch: <code className="bg-black/50 px-1 py-0.5 rounded text-white">{gitPRResult.branchName}</code></span>
                        <span>Target: <code className="bg-black/50 px-1 py-0.5 rounded text-white">{githubBaseBranch}</code></span>
                        <span>Repo: <code className="bg-black/50 px-1 py-0.5 rounded text-white">{githubRepoOwner}/{githubRepoName}</code></span>
                      </div>
                    </div>
                  )}

                  {/* Git Branch Created Callout */}
                  {gitBranchResult && (
                    <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/40 text-indigo-300 text-xs space-y-1.5 animate-in fade-in">
                      <div className="flex items-center gap-2 font-bold text-white">
                        <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                        <span>Branch Git Berhasil Dibuat & Di-commit!</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-mono text-indigo-300/90">
                        <span>Branch: <code className="bg-black/40 px-1.5 py-0.5 rounded text-white">{gitBranchResult.branchName}</code></span>
                        <span>Commit: <code className="bg-black/40 px-1.5 py-0.5 rounded text-white">{gitBranchResult.commitHash.slice(0, 7)}</code></span>
                      </div>
                      <div className="flex items-center gap-2 pt-1 font-mono text-[10px] text-slate-400">
                        <Terminal className="w-3 h-3 text-slate-500" />
                        <span>Perintah lokal: <code className="text-indigo-300">git checkout {gitBranchResult.branchName}</code></span>
                      </div>
                    </div>
                  )}

                  {/* Sub-tab Navigation */}
                  <div className="flex items-center gap-1 border-b border-slate-800 pb-2">
                    <button
                      onClick={() => setArtifactSubTab('report')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        artifactSubTab === 'report'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:text-white bg-slate-900/60'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5 inline mr-1" />
                      Laporan Eksekutif (Markdown)
                    </button>
                    <button
                      onClick={() => setArtifactSubTab('files')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        artifactSubTab === 'files'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:text-white bg-slate-900/60'
                      }`}
                    >
                      <FileCode className="w-3.5 h-3.5 inline mr-1" />
                      File Kode ({artifactBundle?.extractedFiles?.length || 0})
                    </button>
                    <button
                      onClick={() => setArtifactSubTab('patch')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        artifactSubTab === 'patch'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-400 hover:text-white bg-slate-900/60'
                      }`}
                    >
                      <GitBranch className="w-3.5 h-3.5 inline mr-1" />
                      Unified Git Patch
                    </button>
                  </div>

                  {/* Sub-tab Content: Report */}
                  {artifactSubTab === 'report' && (
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-200 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto">
                      {artifactBundle?.markdownReport || 'Tidak ada konten laporan.'}
                    </div>
                  )}

                  {/* Sub-tab Content: Extracted Code Files */}
                  {artifactSubTab === 'files' && (
                    <div className="space-y-3">
                      {!artifactBundle?.extractedFiles || artifactBundle.extractedFiles.length === 0 ? (
                        <div className="py-12 text-center text-xs text-slate-500">
                          Tidak ada file kode terpisah yang terdeteksi dalam artefak misi ini.
                        </div>
                      ) : (
                        artifactBundle.extractedFiles.map((file, idx) => (
                          <div key={idx} className="rounded-xl border border-slate-800 bg-[#0B0F17] overflow-hidden">
                            <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-800 bg-slate-900/80">
                              <div className="flex items-center gap-2">
                                <FileCode className="w-4 h-4 text-indigo-400" />
                                <span className="text-xs font-bold text-white font-mono">{file.filePath}</span>
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono uppercase bg-slate-800 text-slate-400">
                                  {file.language}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-zinc-400 hidden sm:inline">
                                  {file.sourceAgentRole}
                                </span>
                                <button
                                  onClick={() => handleTestFileInSandbox(file.filePath, file.language, file.content, idx)}
                                  disabled={executingSandboxIndex === idx}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 text-[10px] font-mono border border-emerald-500/30 transition shadow-sm disabled:opacity-50"
                                  title="Eksekusi file kode ini langsung di Sandbox runtime"
                                >
                                  <Play className={`w-3 h-3 ${executingSandboxIndex === idx ? 'animate-spin' : 'fill-emerald-400'}`} />
                                  <span>{executingSandboxIndex === idx ? 'Menguji...' : '⚡ Uji di Sandbox'}</span>
                                </button>
                                <button
                                  onClick={() => handleCopyFileContent(file.content, idx)}
                                  className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
                                  title="Salin kode"
                                >
                                  {copiedFileIndex === idx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>
                            <pre className="p-3 text-[11px] font-mono text-zinc-200 overflow-x-auto max-h-72 leading-relaxed bg-black/60">
                              <code>{file.content}</code>
                            </pre>

                            {/* Live Sandbox Terminal Viewer for this file */}
                            {sandboxResults[idx] && (
                              <div className="p-2.5 bg-black border-t border-zinc-800">
                                <SandboxTerminalViewer
                                  result={sandboxResults[idx]}
                                  loading={executingSandboxIndex === idx}
                                  title={`Sandbox: ${file.filePath}`}
                                  onClose={() => {
                                    const updated = { ...sandboxResults };
                                    delete updated[idx];
                                    setSandboxResults(updated);
                                  }}
                                  onReRun={() => handleTestFileInSandbox(file.filePath, file.language, file.content, idx)}
                                  initialCode={file.content}
                                />
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Sub-tab Content: Unified Patch */}
                  {artifactSubTab === 'patch' && (
                    <div className="rounded-xl border border-slate-800 bg-black/60 p-4 max-h-[500px] overflow-y-auto">
                      {!artifactBundle?.unifiedPatch ? (
                        <div className="py-8 text-center text-xs text-slate-500">
                          Tidak ada perubahan diff yang tersedia.
                        </div>
                      ) : (
                        <pre className="text-[11px] font-mono leading-relaxed overflow-x-auto">
                          {artifactBundle.unifiedPatch.split('\n').map((line, lidx) => {
                            const isAdded = line.startsWith('+') && !line.startsWith('+++');
                            const isRemoved = line.startsWith('-') && !line.startsWith('---');
                            const isHeader = line.startsWith('diff --git') || line.startsWith('@@');

                            return (
                              <div
                                key={lidx}
                                className={
                                  isAdded
                                    ? 'text-emerald-400 bg-emerald-950/20'
                                    : isRemoved
                                    ? 'text-rose-400 bg-rose-950/20'
                                    : isHeader
                                    ? 'text-indigo-400 font-bold'
                                    : 'text-slate-400'
                                }
                              >
                                {line || ' '}
                              </div>
                            );
                          })}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: ARCHIVE & SYNTHESIS REPORT */}
          {activeTab === 'archive' && (
            <div className="space-y-5">
              {activeMission?.finalSynthesis && (
                <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-xs font-bold text-white">
                        Laporan Sintesis Akhir Misi Terpilih
                      </h4>
                    </div>
                    <button
                      onClick={handleCopySynthesis}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                    >
                      {copiedSynthesis ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>Salin Laporan</span>
                    </button>
                  </div>

                  <div className="text-xs text-slate-200 bg-slate-950/60 p-4 rounded-lg border border-slate-800 font-sans leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto">
                    {activeMission.finalSynthesis}
                  </div>
                </div>
              )}

              {/* Past Missions List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Riwayat Misi Swarm Sebelumnya
                  </h4>
                  <button
                    onClick={fetchPastMissions}
                    className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
                    title="Segarkan Riwayat"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingPastMissions ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {pastMissions.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-500">
                    Belum ada riwayat misi tersimpan.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {pastMissions.map(m => (
                      <div
                        key={m.id}
                        onClick={() => {
                          handleSelectPastMission(m);
                          fetchArtifacts(m.id);
                        }}
                        className="p-3.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/40 transition cursor-pointer space-y-2 group"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              m.status === 'COMPLETED'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : m.status === 'EXECUTING'
                                ? 'bg-amber-500/20 text-amber-300 animate-pulse'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {m.status}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(m.createdAt).toLocaleDateString('id-ID')}
                          </span>
                        </div>

                        <div className="text-xs font-bold text-slate-200 group-hover:text-indigo-400 transition line-clamp-1">
                          {m.title}
                        </div>

                        <p className="text-[11px] text-slate-400 line-clamp-2">
                          {m.objective}
                        </p>

                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/60">
                          <span>Subtugas: {m.subtasks?.length || 0}</span>
                          <span>Durasi: {((m.totalDurationMs || 0) / 1000).toFixed(1)}s</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal: Git Branch Creation Dialog */}
        {isBranchModalOpen && (
          <div
            onClick={() => setIsBranchModalOpen(false)}
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-[#101726] border border-slate-700 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <GitPullRequest className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">Buat Git Branch & Commit Deliverables</h3>
                </div>
                <button
                  onClick={() => setIsBranchModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Nama Branch Git</label>
                  <input
                    type="text"
                    value={customBranchName}
                    onChange={(e) => setCustomBranchName(e.target.value)}
                    placeholder="feature/swarm-task-name"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Pesan Commit</label>
                  <input
                    type="text"
                    value={customCommitMessage}
                    onChange={(e) => setCustomCommitMessage(e.target.value)}
                    placeholder="feat(swarm): automated deliverables"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <p className="text-[11px] text-slate-500">
                  Sistem akan membuat branch baru secara lokal, menulis laporan deliverables ke <code className="text-indigo-300">docs/swarm-reports/</code>, membuat commit git otomatis, dan kembali ke branch aktif.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsBranchModalOpen(false)}
                  className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isCreatingBranch}
                  onClick={handleCreateGitBranch}
                  className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-md flex items-center gap-1.5"
                >
                  {isCreatingBranch && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Buat Branch & Commit</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: GitHub Pull Request Bot Dialog */}
        {isPRModalOpen && (
          <div
            onClick={() => setIsPRModalOpen(false)}
            className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0b0f17] border border-zinc-800 rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-2xl text-slate-200"
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <GitPullRequest className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Buka Automated GitHub Pull Request</h3>
                    <p className="text-[11px] text-slate-400">Ekspor deliverable hasil kerja agent swarm ke remote GitHub repository</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsPRModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-zinc-800 text-slate-400 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">GitHub Owner / Org</label>
                    <input
                      type="text"
                      value={githubRepoOwner}
                      onChange={(e) => setGithubRepoOwner(e.target.value)}
                      placeholder="e.g. NexGen-X"
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-semibold block mb-1">Repository Name</label>
                    <input
                      type="text"
                      value={githubRepoName}
                      onChange={(e) => setGithubRepoName(e.target.value)}
                      placeholder="e.g. Ai-Center-Workspace"
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1">
                    <label className="text-slate-300 font-semibold block mb-1">Target Base</label>
                    <input
                      type="text"
                      value={githubBaseBranch}
                      onChange={(e) => setGithubBaseBranch(e.target.value)}
                      placeholder="main"
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-slate-300 font-semibold block mb-1">Judul Pull Request</label>
                    <input
                      type="text"
                      value={githubPRTitle}
                      onChange={(e) => setGithubPRTitle(e.target.value)}
                      placeholder="feat(swarm): automated deliverables"
                      className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-semibold">GitHub Personal Access Token (Opsional)</label>
                    <span className="text-[10px] text-zinc-500">repo scope</span>
                  </div>
                  <input
                    type="password"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx (opsional)"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    💡 <strong className="text-slate-300">Tips:</strong> Jika token diisi, bot akan langsung membuka PR melalui REST API. Jika dikosongkan, branch lokal akan di-commit dan tautan perbandingan (GitHub Compare & PR) otomatis disiapkan untuk Anda buka dengan 1 klik!
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsPRModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-slate-300 text-xs font-semibold transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isCreatingPR || !githubRepoOwner.trim() || !githubRepoName.trim()}
                  onClick={handleCreateGitHubPR}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950/40 flex items-center gap-2 disabled:opacity-50 transition"
                >
                  {isCreatingPR ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Menghubungi GitHub...</span>
                    </>
                  ) : (
                    <>
                      <GitPullRequest className="w-3.5 h-3.5" />
                      <span>Luncurkan Pull Request</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <span>Autonomous Swarm Mesh Active</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
          >
            Tutup Panel
          </button>
        </div>
      </div>
    </div>
  );
};

