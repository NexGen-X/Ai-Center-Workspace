import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { Navbar } from './components/Navbar.js';
import { StatCards } from './components/StatCards.js';
import { AgentCard } from './features/team/AgentCard.js';
import { AddAgentModal } from './features/team/AddAgentModal.js';
import { AgentDetailModal } from './features/team/AgentDetailModal.js';
import { ManageTeamModal } from './features/team/ManageTeamModal.js';
import { LoginModal } from './components/LoginModal.js';
import { LoginPage } from './features/auth/LoginPage.js';
import { ForcePasswordChangeModal } from './features/auth/ForcePasswordChangeModal.js';
import { TaskList } from './features/tasks/TaskList.js';
import { CreateTaskModal } from './features/tasks/CreateTaskModal.js';
import { TaskDetailModal } from './features/tasks/TaskDetailModal.js';
import { TasksModal } from './features/tasks/TasksModal.js';
import { Workspace3D } from './features/workspace3d/Workspace3D.js';
import { Workspace2DView } from './features/workspace3d/Workspace2DView.js';
import { ActivityFeed } from './components/ActivityFeed.js';
import { ServerMonitoringWidget } from './components/ServerMonitoringWidget.js';
import { ActionApprovalModal } from './features/actions/ActionApprovalModal.js';
import { ActionHistoryModal } from './features/actions/ActionHistoryModal.js';

// Code-split heavy modals with React.lazy to minimize initial client payload
const CalendarModal = React.lazy(() => import('./features/calendar/CalendarModal.js').then(m => ({ default: m.CalendarModal })));
const ReportsModal = React.lazy(() => import('./features/reports/ReportsModal.js').then(m => ({ default: m.ReportsModal })));
const DocumentsModal = React.lazy(() => import('./features/documents/DocumentsModal.js').then(m => ({ default: m.DocumentsModal })));
const ProjectsModal = React.lazy(() => import('./features/projects/ProjectsModal.js').then(m => ({ default: m.ProjectsModal })));
const SettingsModal = React.lazy(() => import('./features/settings/SettingsModal.js').then(m => ({ default: m.SettingsModal })));
const ManageProvidersModal = React.lazy(() => import('./features/providers/ManageProvidersModal.js').then(m => ({ default: m.ManageProvidersModal })));
const PlaygroundModal = React.lazy(() => import('./features/playground/PlaygroundModal.js').then(m => ({ default: m.PlaygroundModal })));
const PipelineModal = React.lazy(() => import('./features/pipeline/PipelineModal.js').then(m => ({ default: m.PipelineModal })));
const SwarmMissionModal = React.lazy(() => import('./features/swarm/SwarmMissionModal.js').then(m => ({ default: m.SwarmMissionModal })));
const WarRoomModal = React.lazy(() => import('./features/warroom/WarRoomModal.js').then(m => ({ default: m.WarRoomModal })));
const DataAnalystModal = React.lazy(() => import('./features/data-analyst/DataAnalystModal.js').then(m => ({ default: m.DataAnalystModal })));
const SkillStudioModal = React.lazy(() => import('./features/skills/SkillStudioModal.js').then(m => ({ default: m.SkillStudioModal })));
const MemoryGraphModal = React.lazy(() => import('./features/memory/MemoryGraphModal.js').then(m => ({ default: m.MemoryGraphModal })));
const WorkspaceModal = React.lazy(() => import('./features/workspace/WorkspaceModal.js').then(m => ({ default: m.WorkspaceModal })));
const PricingModal = React.lazy(() => import('./features/billing/PricingModal.js').then(m => ({ default: m.PricingModal })));
const GuidedTourModal = React.lazy(() => import('./features/demo-tour/GuidedTourModal.js').then(m => ({ default: m.GuidedTourModal })));
const FinOpsModal = React.lazy(() => import('./features/finops/FinOpsModal.js').then(m => ({ default: m.FinOpsModal })));
const GitHubConnectorModal = React.lazy(() => import('./features/integrations/GitHubConnectorModal.js').then(m => ({ default: m.GitHubConnectorModal })));
import { useFeedback } from './components/common/FeedbackContext.js';
import { ErrorBoundary } from './components/common/ErrorBoundary.js';
import { api } from './services/api.js';
import { AIAgent, Task, Activity, DashboardSummary, Project, ModelProviderConfig, AgentAction } from '../../shared/types.js';
import { 
  Bot, Plus, RefreshCw, Zap, Layers, Users, CheckSquare, Workflow,
  Menu, X, Swords, FlaskConical, LineChart, Brain, Wrench, FolderKanban,
  Calendar as CalendarIcon, FileText, Sliders, DollarSign, GitPullRequest,
  Settings, Building2, Sparkles, Box, LayoutGrid
} from 'lucide-react';
import { ThemeProvider, useTheme } from './context/ThemeContext.js';
import { useResponsive } from './hooks/useResponsive.js';

export const AppContent: React.FC = () => {
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const { accent } = useTheme();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [providers, setProviders] = useState<ModelProviderConfig[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  const [loading, setLoading] = useState(true);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);

  // Auto-adapt 2D vs 3D based on device: Mobile auto-switches to 2D touch mode for performance & smooth scrolling; Desktop uses 3D
  const [viewMode, setViewMode] = useState<'3D' | '2D'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return '2D';
    }
    return '3D';
  });
  const [hasUserToggledView, setHasUserToggledView] = useState(false);

  useEffect(() => {
    if (!hasUserToggledView) {
      setViewMode(isMobile ? '2D' : '3D');
    }
  }, [isMobile, hasUserToggledView]);

  const toggleViewMode = () => {
    setHasUserToggledView(true);
    setViewMode((prev) => (prev === '3D' ? '2D' : '3D'));
  };

  // Mobile Drawer & Launcher Sheet
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);

  // Modals state
  const [isTasksModalOpen, setIsTasksModalOpen] = useState(false);
  const [isManageTeamOpen, setIsManageTeamOpen] = useState(false);
  const [isProvidersModalOpen, setIsProvidersModalOpen] = useState(false);
  const [isPlaygroundOpen, setIsPlaygroundOpen] = useState(false);
  const [isPipelineOpen, setIsPipelineOpen] = useState(false);
  const [isSwarmModalOpen, setIsSwarmModalOpen] = useState(false);
  const [isWarRoomOpen, setIsWarRoomOpen] = useState(false);
  const [isDataAnalystOpen, setIsDataAnalystOpen] = useState(false);
  const [isSkillsOpen, setIsSkillsOpen] = useState(false);
  const [isMemoryGraphOpen, setIsMemoryGraphOpen] = useState(false);
  const [isAddAgentOpen, setIsAddAgentOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [isDocumentsOpen, setIsDocumentsOpen] = useState(false);
  const [isProjectsOpen, setIsProjectsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedProjectIdForTask, setSelectedProjectIdForTask] = useState<string | undefined>(undefined);
  const [pendingAction, setPendingAction] = useState<AgentAction | null>(null);
  const [isActionHistoryOpen, setIsActionHistoryOpen] = useState(false);
  const [pendingActionCount, setPendingActionCount] = useState(0);

  // Multi-Tenant Workspace State
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(() => {
    return localStorage.getItem('ai_center_workspace_id') || 'ws-default-command-center';
  });
  const [activeWorkspaceName, setActiveWorkspaceName] = useState<string>(() => {
    return localStorage.getItem('ai_center_workspace_name') || 'Default Workspace';
  });

  // SaaS Billing & Quota State
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<string>('FREE');

  // Commercial SaaS Excellence Modals (Guided Tour, FinOps, GitHub Webhook)
  const [isGuidedTourOpen, setIsGuidedTourOpen] = useState(false);
  const [isFinOpsOpen, setIsFinOpsOpen] = useState(false);
  const [isGitHubOpen, setIsGitHubOpen] = useState(false);

  const { toast } = useFeedback();

  const handleWorkspaceSwitched = (newWsId: string, newWsName: string) => {
    localStorage.setItem('ai_center_workspace_id', newWsId);
    localStorage.setItem('ai_center_workspace_name', newWsName);
    setActiveWorkspaceId(newWsId);
    setActiveWorkspaceName(newWsName);
    toast.success(`Beralih ke workspace "${newWsName}". Memuat ulang data organisasi...`);
    refreshAllData();
  };

  const refreshAllData = useCallback(async () => {
    try {
      const [sumData, agentsData, tasksData, projsData, actsData, provData] = await Promise.all([
        api.getDashboardSummary(),
        api.getAgents(),
        api.getTasks(),
        api.getProjects().catch(() => []),
        api.getActivities(30),
        api.getProviders().catch(() => [])
      ]);
      setSummary(sumData);
      setAgents(agentsData);
      setTasks(tasksData);
      setProjects(projsData);
      setActivities(actsData);
      setProviders(provData);

      api.getPendingActionsCount().then(res => setPendingActionCount(res.pendingCount)).catch(() => {});
      api.getBillingUsage().then(usage => {
        if (usage && usage.plan) setCurrentPlan(usage.plan);
      }).catch(() => {});
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Check auth session on mount
  useEffect(() => {
    // Check if auth_token is provided via URL query parameter (e.g. from landing page handoff)
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const queryToken = urlParams.get('auth_token');
      if (queryToken) {
        localStorage.setItem('ai_center_token', queryToken);
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    }

    const token = localStorage.getItem('ai_center_token');
    if (!token) {
      setIsAuthChecking(false);
      return;
    }

    api.getMe()
      .then((res) => {
        if (res.authenticated && res.user) {
          setCurrentUser(res.user);
        } else {
          localStorage.removeItem('ai_center_token');
          setCurrentUser(null);
        }
      })
      .catch(() => {
        localStorage.removeItem('ai_center_token');
        setCurrentUser(null);
      })
      .finally(() => {
        setIsAuthChecking(false);
      });
  }, []);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {}
    localStorage.removeItem('ai_center_token');
    setCurrentUser(null);
    toast.info('Sesi ditutup. Anda telah keluar dari Command Center.');
  };

  // Initial load once authenticated
  useEffect(() => {
    if (currentUser) {
      refreshAllData();

      // Sync active workspace name & ensure valid workspace
      api.getWorkspaces().then(list => {
        if (!list || list.length === 0) return;
        const current = list.find(w => w.id === activeWorkspaceId);
        if (current) {
          setActiveWorkspaceName(current.name);
          localStorage.setItem('ai_center_workspace_name', current.name);
        } else {
          setActiveWorkspaceId(list[0].id);
          setActiveWorkspaceName(list[0].name);
          localStorage.setItem('ai_center_workspace_id', list[0].id);
          localStorage.setItem('ai_center_workspace_name', list[0].name);
        }
      }).catch(() => {});
    }
  }, [currentUser, activeWorkspaceId, refreshAllData]);

  // Server-Sent Events (SSE) setup
  useEffect(() => {
    if (!currentUser) return;
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;
    let reconnectDelay = 1000;

    const connectSSE = () => {
      if (eventSource) {
        eventSource.close();
      }
      eventSource = new EventSource('/api/realtime');

      eventSource.addEventListener('connected', () => {
        setIsRealtimeConnected(true);
        reconnectDelay = 1000; // Reset backoff on successful connection
      });

      eventSource.addEventListener('agent.status_changed', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        setAgents((prev) =>
          prev.map((ag) => (ag.id === data.agentId ? { ...ag, status: data.status } : ag))
        );
      });

      eventSource.addEventListener('agent.registered', () => {
        refreshAllData();
      });

      eventSource.addEventListener('agent.updated', () => {
        refreshAllData();
      });

      eventSource.addEventListener('agent.deleted', () => {
        refreshAllData();
      });

      eventSource.addEventListener('task.created', () => {
        refreshAllData();
      });

      eventSource.addEventListener('task.updated', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        setTasks((prev) =>
          prev.map((t) => (t.id === data.taskId ? { ...t, status: data.status || t.status } : t))
        );
      });

      eventSource.addEventListener('task.deleted', () => {
        refreshAllData();
      });

      eventSource.addEventListener('project.created', () => {
        refreshAllData();
      });

      eventSource.addEventListener('project.updated', () => {
        refreshAllData();
      });

      eventSource.addEventListener('project.deleted', () => {
        refreshAllData();
      });

      eventSource.addEventListener('provider.created', () => {
        refreshAllData();
      });

      eventSource.addEventListener('provider.updated', () => {
        refreshAllData();
      });

      eventSource.addEventListener('provider.deleted', () => {
        refreshAllData();
      });

      eventSource.addEventListener('activity.created', (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        setActivities((prev) => [
          {
            id: `act-live-${Date.now()}`,
            workspaceId: 'ws-default-command-center',
            actorType: 'AGENT',
            actorName: data.actorName,
            eventType: 'live.event',
            summary: data.summary,
            createdAt: new Date().toISOString()
          },
          ...prev.slice(0, 29)
        ]);
      });

      eventSource.addEventListener('action.approval_requested', (e: MessageEvent) => {
        try {
          const actionData: AgentAction = JSON.parse(e.data);
          setPendingAction(actionData);
          setPendingActionCount((prev) => prev + 1);
          toast.warning(`Aksi "${actionData.toolName}" memerlukan otorisasi Anda.`, 'Otorisasi Agen Diperlukan');
        } catch {
          // ignore
        }
      });

      eventSource.addEventListener('action.executed', () => {
        refreshAllData();
        api.getPendingActionsCount().then((res) => setPendingActionCount(res.pendingCount)).catch(() => {});
      });

      eventSource.addEventListener('action.rejected', () => {
        api.getPendingActionsCount().then((res) => setPendingActionCount(res.pendingCount)).catch(() => {});
      });

      eventSource.onerror = () => {
        setIsRealtimeConnected(false);
        eventSource?.close();
        reconnectTimeout = setTimeout(() => {
          connectSSE();
        }, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 1.5, 10000);
      };
    };

    connectSSE();

    return () => {
      eventSource?.close();
      clearTimeout(reconnectTimeout);
    };
  }, [currentUser, refreshAllData]);

  const handleOpenCreateTaskForProject = (projId: string) => {
    setSelectedProjectIdForTask(projId);
    setIsCreateTaskOpen(true);
  };

  const handleSelectTask = (task: Task) => {
    setSelectedTaskId(task.id);
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#000000] text-zinc-100 font-sans">
        <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-lg mb-3">
          <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
        </div>
        <p className="text-xs font-mono text-zinc-400 tracking-wider uppercase animate-pulse">
          Memverifikasi Sesi Otorisasi...
        </p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginPage
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          toast.success(`Selamat datang, ${user.displayName || 'Operator'}!`);
        }}
      />
    );
  }

  if (currentUser?.mustChangePassword) {
    return (
      <ForcePasswordChangeModal
        currentUser={currentUser}
        onSuccess={(updatedUser) => {
          setCurrentUser(updatedUser);
          toast.success('Kredensial keamanan berhasil diperbarui! Selamat bertugas.');
        }}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#000000] text-neutral-900 dark:text-neutral-100 flex flex-col font-sans select-none antialiased transition-colors duration-200 relative">
      {/* Vercel / Railway Minimal Dot Matrix Background */}
      <div className="fixed inset-0 bg-[radial-gradient(#d4d4d8_1px,transparent_1px)] dark:bg-[radial-gradient(#1f1f1f_1px,transparent_1px)] bg-[size:1.75rem_1.75rem] pointer-events-none opacity-80 z-0" />
      <div 
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[50rem] h-[15rem] rounded-full blur-3xl pointer-events-none opacity-30 z-0" 
        style={{ background: `radial-gradient(ellipse at top, ${accent.hex}30, transparent 70%)` }}
      />

      {/* Top Navigation */}
      <Navbar
        onOpenAddAgent={() => setIsAddAgentOpen(true)}
        onOpenManageTeam={() => setIsManageTeamOpen(true)}
        onOpenProviders={() => setIsProvidersModalOpen(true)}
        onOpenTasks={() => setIsTasksModalOpen(true)}
        onOpenCreateTask={() => {
          setSelectedProjectIdForTask(undefined);
          setIsCreateTaskOpen(true);
        }}
        onOpenCalendar={() => setIsCalendarOpen(true)}
        onOpenReports={() => setIsReportsOpen(true)}
        onOpenDocuments={() => setIsDocumentsOpen(true)}
        onOpenProjects={() => setIsProjectsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenPlayground={() => setIsPlaygroundOpen(true)}
        onOpenPipeline={() => setIsPipelineOpen(true)}
        onOpenSwarm={() => setIsSwarmModalOpen(true)}
        onOpenWarRoom={() => setIsWarRoomOpen(true)}
        onOpenDataAnalyst={() => setIsDataAnalystOpen(true)}
        onOpenSkills={() => setIsSkillsOpen(true)}
        onOpenMemoryGraph={() => setIsMemoryGraphOpen(true)}
        onOpenActions={() => setIsActionHistoryOpen(true)}
        pendingActionCount={pendingActionCount}
        onOpenLogin={() => setIsLoginOpen(true)}
        onLogout={handleLogout}
        currentUser={currentUser}
        isRealtimeConnected={isRealtimeConnected}
        systemStatus={summary?.systemStatus || 'OPERATIONAL'}
        unreadActivityCount={activities.length}
        activeWorkspaceName={activeWorkspaceName}
        onOpenWorkspaces={() => setIsWorkspaceModalOpen(true)}
        currentPlan={currentPlan}
        onOpenPricing={() => setIsPricingModalOpen(true)}
        onOpenGuidedTour={() => setIsGuidedTourOpen(true)}
        onOpenFinOps={() => setIsFinOpsOpen(true)}
        onOpenGitHub={() => setIsGitHubOpen(true)}
      />

      {/* Main Content Area - Responsive padding to prevent mobile dock occlusion */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto px-3 lg:px-6 py-4 space-y-6 pb-24 lg:pb-8">
        {/* 3D Virtual Workspace Cockpit & 2D Fallback */}
        <section aria-label="Virtual Workspace">
          {viewMode === '3D' ? (
            <ErrorBoundary
              fallbackTitle="3D Workspace Mengalami Kendala Grafis"
              fallbackDescription="Gagal memuat visualisasi 3D WebGL. Menampilkan tampilan 2D alternatif untuk menjaga kelancaran operasi."
              fallback={
                <Workspace2DView
                  agents={agents}
                  onSelectAgent={(agent) => setSelectedAgent(agent)}
                  onSwitchTo3D={() => setViewMode('3D')}
                />
              }
            >
              <Workspace3D
                agents={agents}
                summary={summary}
                activities={activities}
                currentUser={currentUser}
                onSelectAgent={(agent) => setSelectedAgent(agent)}
                onOpenCreateTask={() => {
                  setSelectedProjectIdForTask(undefined);
                  setIsCreateTaskOpen(true);
                }}
                onOpenTasks={() => setIsTasksModalOpen(true)}
                onOpenProjects={() => setIsProjectsOpen(true)}
                onOpenManageTeam={() => setIsManageTeamOpen(true)}
                onOpenSwarm={() => setIsSwarmModalOpen(true)}
                onOpenCalendar={() => setIsCalendarOpen(true)}
                onOpenDocuments={() => setIsDocumentsOpen(true)}
                onOpenPlayground={() => setIsPlaygroundOpen(true)}
                onOpenSettings={() => setIsSettingsOpen(true)}
                onOpenPipeline={() => setIsPipelineOpen(true)}
                onFallbackTo2D={() => setViewMode('2D')}
              />
            </ErrorBoundary>
          ) : (
            <Workspace2DView
              agents={agents}
              onSelectAgent={(agent) => setSelectedAgent(agent)}
              onSwitchTo3D={() => setViewMode('3D')}
            />
          )}
        </section>

        {/* AI Team / Agent Registry Section */}
        <section className="space-y-3" aria-label="AI Team Registry">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-blue-400" />
                <h2 className="text-base font-black tracking-tight text-white">
                  AI TEAM REGISTRY
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold">
                  {agents.length} Model / Agent
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Seluruh anggota tim adalah entitas AI (LLM / Agent Runtime). Pengguna manusia berperan sebagai operator.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={refreshAllData}
                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition"
                title="Segarkan Data"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-400' : ''}`} />
              </button>

              <button
                onClick={() => setIsManageTeamOpen(true)}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition"
                title="Buka Panel Kelola AI Team"
              >
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Kelola Semua Tim</span>
                <span className="sm:hidden">Kelola</span>
              </button>

              <button
                onClick={() => setIsAddAgentOpen(true)}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">+ Anggota Baru</span>
                <span className="sm:hidden">+ Baru</span>
              </button>
            </div>
          </div>

          {/* Agents Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onQuickRun={(ag) => setSelectedAgent(ag)}
                onSelect={(ag) => setSelectedAgent(ag)}
              />
            ))}
          </div>
        </section>

        {/* Split Section: Tasks on Left, Server Monitoring & Activity Feed on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <TaskList
              tasks={tasks}
              agents={agents}
              projects={projects}
              onTaskUpdated={refreshAllData}
              onOpenCreateTask={() => {
                setSelectedProjectIdForTask(undefined);
                setIsCreateTaskOpen(true);
              }}
              onSelectTask={handleSelectTask}
            />
          </div>

          <div className="space-y-6">
            <ServerMonitoringWidget
              runningTasksCount={summary?.runningTasksCount || tasks.filter((t) => t.status === 'IN_PROGRESS').length}
              completedTasksCount={summary?.completedTasksCount || tasks.filter((t) => t.status === 'DONE').length}
              onlineAgentsCount={summary?.onlineAgentsCount || agents.filter((a) => a.enabled !== false).length}
              activeProjectsCount={summary?.activeProjectsCount || projects.length}
              onOpenPricing={() => setIsPricingModalOpen(true)}
            />
            <ActivityFeed activities={activities} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 text-center text-xs text-slate-500">
        AI Agent Command Center • Enterprise AI Workforce Platform
      </footer>

      {/* Modals */}
      <ManageTeamModal
        isOpen={isManageTeamOpen}
        onClose={() => setIsManageTeamOpen(false)}
        agents={agents}
        onAgentsUpdated={refreshAllData}
        onOpenAddAgent={() => setIsAddAgentOpen(true)}
        onSelectAgent={(agent) => setSelectedAgent(agent)}
      />

      <AddAgentModal
        isOpen={isAddAgentOpen}
        onClose={() => setIsAddAgentOpen(false)}
        onAgentCreated={refreshAllData}
      />

      <CreateTaskModal
        isOpen={isCreateTaskOpen}
        onClose={() => {
          setIsCreateTaskOpen(false);
          setSelectedProjectIdForTask(undefined);
        }}
        agents={agents}
        projects={projects}
        initialProjectId={selectedProjectIdForTask}
        onTaskCreated={refreshAllData}
      />

      <TaskDetailModal
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        agents={agents}
        projects={projects}
        onTaskUpdated={refreshAllData}
      />

      <TasksModal
        isOpen={isTasksModalOpen}
        onClose={() => setIsTasksModalOpen(false)}
        tasks={tasks}
        agents={agents}
        projects={projects}
        onTaskUpdated={refreshAllData}
        onOpenCreateTask={() => {
          setSelectedProjectIdForTask(undefined);
          setIsCreateTaskOpen(true);
        }}
        onSelectTask={handleSelectTask}
      />

      <AgentDetailModal
        agent={selectedAgent}
        onClose={() => setSelectedAgent(null)}
        onRunFinished={refreshAllData}
      />

      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          refreshAllData();
        }}
      />

      <Suspense fallback={null}>
        {isCalendarOpen && (
          <CalendarModal
            isOpen={isCalendarOpen}
            onClose={() => setIsCalendarOpen(false)}
            tasks={tasks}
            projects={projects}
            onSelectTask={handleSelectTask}
          />
        )}

        {isReportsOpen && (
          <ReportsModal
            isOpen={isReportsOpen}
            onClose={() => setIsReportsOpen(false)}
          />
        )}

        {isDocumentsOpen && (
          <DocumentsModal
            isOpen={isDocumentsOpen}
            onClose={() => setIsDocumentsOpen(false)}
            projects={projects}
          />
        )}

        {isProjectsOpen && (
          <ProjectsModal
            isOpen={isProjectsOpen}
            onClose={() => setIsProjectsOpen(false)}
            onProjectsUpdated={refreshAllData}
            onOpenCreateTaskForProject={handleOpenCreateTaskForProject}
            onSelectTask={handleSelectTask}
          />
        )}

        {isSettingsOpen && (
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            currentUser={currentUser}
            onLogout={handleLogout}
            onOpenManageProviders={() => setIsProvidersModalOpen(true)}
            onWorkspaceRestored={refreshAllData}
          />
        )}

        {isProvidersModalOpen && (
          <ManageProvidersModal
            isOpen={isProvidersModalOpen}
            onClose={() => setIsProvidersModalOpen(false)}
            onProvidersUpdated={refreshAllData}
          />
        )}

        {isPlaygroundOpen && (
          <PlaygroundModal
            isOpen={isPlaygroundOpen}
            onClose={() => setIsPlaygroundOpen(false)}
            providers={providers}
            agents={agents}
          />
        )}

        {isPipelineOpen && (
          <PipelineModal
            isOpen={isPipelineOpen}
            onClose={() => setIsPipelineOpen(false)}
            agents={agents}
            projects={projects}
            onPipelineCompleted={refreshAllData}
          />
        )}

        {isSwarmModalOpen && (
          <SwarmMissionModal
            isOpen={isSwarmModalOpen}
            onClose={() => setIsSwarmModalOpen(false)}
            agents={agents}
            onMissionLaunched={refreshAllData}
          />
        )}

        {isWarRoomOpen && (
          <WarRoomModal
            isOpen={isWarRoomOpen}
            onClose={() => setIsWarRoomOpen(false)}
            agents={agents}
            projects={projects}
            onTaskCreated={refreshAllData}
          />
        )}

        {isDataAnalystOpen && (
          <DataAnalystModal
            isOpen={isDataAnalystOpen}
            onClose={() => setIsDataAnalystOpen(false)}
          />
        )}

        {isSkillsOpen && (
          <SkillStudioModal
            isOpen={isSkillsOpen}
            onClose={() => setIsSkillsOpen(false)}
            agents={agents}
          />
        )}

        {isMemoryGraphOpen && (
          <MemoryGraphModal
            isOpen={isMemoryGraphOpen}
            onClose={() => setIsMemoryGraphOpen(false)}
            agents={agents}
          />
        )}

        {isWorkspaceModalOpen && (
          <WorkspaceModal
            isOpen={isWorkspaceModalOpen}
            onClose={() => setIsWorkspaceModalOpen(false)}
            activeWorkspaceId={activeWorkspaceId}
            onWorkspaceSwitched={handleWorkspaceSwitched}
          />
        )}

        {isPricingModalOpen && (
          <PricingModal
            isOpen={isPricingModalOpen}
            onClose={() => setIsPricingModalOpen(false)}
            onPlanUpgraded={() => {
              api.getBillingUsage().then(usage => {
                if (usage && usage.plan) setCurrentPlan(usage.plan);
              }).catch(() => {});
              refreshAllData();
            }}
          />
        )}

        {isGuidedTourOpen && (
          <GuidedTourModal
            isOpen={isGuidedTourOpen}
            onClose={() => setIsGuidedTourOpen(false)}
            onNavigateToFeature={(feat) => {
              if (feat === 'swarm') setIsSwarmModalOpen(true);
              if (feat === 'warroom') setIsWarRoomOpen(true);
              if (feat === 'memory') setIsMemoryGraphOpen(true);
            }}
          />
        )}

        {isFinOpsOpen && (
          <FinOpsModal
            isOpen={isFinOpsOpen}
            onClose={() => setIsFinOpsOpen(false)}
            activeWorkspaceName={activeWorkspaceName}
          />
        )}

        {isGitHubOpen && (
          <GitHubConnectorModal
            isOpen={isGitHubOpen}
            onClose={() => setIsGitHubOpen(false)}
            onTestTriggered={refreshAllData}
          />
        )}
      </Suspense>

      <ActionApprovalModal
        action={pendingAction}
        onClose={() => setPendingAction(null)}
        onActionHandled={() => {
          setPendingAction(null);
          refreshAllData();
        }}
      />

      <ActionHistoryModal
        isOpen={isActionHistoryOpen}
        onClose={() => setIsActionHistoryOpen(false)}
        onActionApprove={() => refreshAllData()}
      />

      {/* Mobile Docked Bottom Navigation Bar (< 768px) with iOS/Android Safe Area Support */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-[#000000]/95 backdrop-blur-md border-t border-neutral-200 dark:border-zinc-800 px-2 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] flex items-center justify-around shadow-2xl transition-all">
          <button
            onClick={toggleViewMode}
            className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-mono text-cyan-500 dark:text-cyan-400 hover:bg-cyan-500/10 active:scale-95 transition"
            title="Alihkan Tampilan Ruang Kerja 2D / 3D"
          >
            <Box className="w-4 h-4 mb-0.5" />
            <span className="font-bold">{viewMode} Mode</span>
          </button>

          <button
            onClick={() => setIsTasksModalOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-medium text-neutral-600 dark:text-slate-300 hover:text-blue-500 active:scale-95 transition"
          >
            <CheckSquare className="w-4 h-4 mb-0.5 text-blue-500" />
            <span>Tugas</span>
          </button>

          <button
            onClick={() => setIsManageTeamOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-medium text-neutral-600 dark:text-slate-300 hover:text-purple-500 active:scale-95 transition"
          >
            <Users className="w-4 h-4 mb-0.5 text-purple-500" />
            <span>Tim AI</span>
          </button>

          <button
            onClick={() => setIsPipelineOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-medium text-neutral-600 dark:text-slate-300 hover:text-amber-500 active:scale-95 transition"
          >
            <Workflow className="w-4 h-4 mb-0.5 text-amber-500" />
            <span>Pipeline</span>
          </button>

          <button
            onClick={() => setIsSwarmModalOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-medium text-indigo-500 dark:text-indigo-400 hover:text-indigo-300 active:scale-95 transition"
          >
            <Zap className="w-4 h-4 mb-0.5 text-indigo-500" />
            <span>Swarm</span>
          </button>

          <button
            onClick={() => setIsMobileMoreOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-medium text-emerald-500 dark:text-emerald-400 hover:text-emerald-300 active:scale-95 transition"
            title="Buka Seluruh Modul Command Center"
          >
            <Menu className="w-4 h-4 mb-0.5 text-emerald-500" />
            <span>Modul</span>
          </button>
        </div>
      )}

      {/* Mobile Drawer (Native Bottom Sheet) for All Additional Modules */}
      {isMobileMoreOpen && (
        <div 
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsMobileMoreOpen(false)}
        >
          <div 
            className="w-full bg-white dark:bg-[#000000] rounded-t-3xl border-t border-neutral-200 dark:border-zinc-800 p-5 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Swipe Handle */}
            <div className="w-12 h-1.5 bg-neutral-300 dark:bg-zinc-700 rounded-full mx-auto my-1 shrink-0" />

            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold text-sm text-neutral-900 dark:text-white">
                  Seluruh Modul & Fitur AI Command Center
                </h3>
              </div>
              <button
                onClick={() => setIsMobileMoreOpen(false)}
                className="p-1 rounded-full text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Grid of Launcher Tiles */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => { setIsMobileMoreOpen(false); setIsWarRoomOpen(true); }}
                className="p-3 rounded-xl bg-neutral-50 dark:bg-zinc-950 border border-neutral-200 dark:border-zinc-800 text-left space-y-1 hover:border-cyan-500/50 transition"
              >
                <div className="flex items-center gap-2 text-rose-400 font-bold">
                  <Swords className="w-4 h-4" />
                  <span>War Room</span>
                </div>
                <p className="text-[10px] text-neutral-500 dark:text-zinc-400">Kolaborasi multi-agen real-time</p>
              </button>

              <button
                onClick={() => { setIsMobileMoreOpen(false); setIsPlaygroundOpen(true); }}
                className="p-3 rounded-xl bg-neutral-50 dark:bg-zinc-950 border border-neutral-200 dark:border-zinc-800 text-left space-y-1 hover:border-cyan-500/50 transition"
              >
                <div className="flex items-center gap-2 text-amber-400 font-bold">
                  <FlaskConical className="w-4 h-4" />
                  <span>AI Playground</span>
                </div>
                <p className="text-[10px] text-neutral-500 dark:text-zinc-400">Uji prompt & benchmark model</p>
              </button>

              <button
                onClick={() => { setIsMobileMoreOpen(false); setIsDataAnalystOpen(true); }}
                className="p-3 rounded-xl bg-neutral-50 dark:bg-zinc-950 border border-neutral-200 dark:border-zinc-800 text-left space-y-1 hover:border-cyan-500/50 transition"
              >
                <div className="flex items-center gap-2 text-blue-400 font-bold">
                  <LineChart className="w-4 h-4" />
                  <span>Data Analyst</span>
                </div>
                <p className="text-[10px] text-neutral-500 dark:text-zinc-400">Otomasi query & visualisasi</p>
              </button>

              <button
                onClick={() => { setIsMobileMoreOpen(false); setIsMemoryGraphOpen(true); }}
                className="p-3 rounded-xl bg-neutral-50 dark:bg-zinc-950 border border-neutral-200 dark:border-zinc-800 text-left space-y-1 hover:border-cyan-500/50 transition"
              >
                <div className="flex items-center gap-2 text-purple-400 font-bold">
                  <Brain className="w-4 h-4" />
                  <span>Memory Graph</span>
                </div>
                <p className="text-[10px] text-neutral-500 dark:text-zinc-400">Peta memori semantik agen</p>
              </button>

              <button
                onClick={() => { setIsMobileMoreOpen(false); setIsSkillsOpen(true); }}
                className="p-3 rounded-xl bg-neutral-50 dark:bg-zinc-950 border border-neutral-200 dark:border-zinc-800 text-left space-y-1 hover:border-cyan-500/50 transition"
              >
                <div className="flex items-center gap-2 text-emerald-400 font-bold">
                  <Wrench className="w-4 h-4" />
                  <span>Skill Studio</span>
                </div>
                <p className="text-[10px] text-neutral-500 dark:text-zinc-400">Kustomisasi function tools</p>
              </button>

              <button
                onClick={() => { setIsMobileMoreOpen(false); setIsProjectsOpen(true); }}
                className="p-3 rounded-xl bg-neutral-50 dark:bg-zinc-950 border border-neutral-200 dark:border-zinc-800 text-left space-y-1 hover:border-cyan-500/50 transition"
              >
                <div className="flex items-center gap-2 text-cyan-400 font-bold">
                  <FolderKanban className="w-4 h-4" />
                  <span>Proyek</span>
                </div>
                <p className="text-[10px] text-neutral-500 dark:text-zinc-400">Kelola workspace & deliverables</p>
              </button>

              <button
                onClick={() => { setIsMobileMoreOpen(false); setIsFinOpsOpen(true); }}
                className="p-3 rounded-xl bg-neutral-50 dark:bg-zinc-950 border border-neutral-200 dark:border-zinc-800 text-left space-y-1 hover:border-cyan-500/50 transition"
              >
                <div className="flex items-center gap-2 text-emerald-500 font-bold">
                  <DollarSign className="w-4 h-4" />
                  <span>FinOps & Quota</span>
                </div>
                <p className="text-[10px] text-neutral-500 dark:text-zinc-400">Efisiensi biaya token & task</p>
              </button>

              <button
                onClick={() => { setIsMobileMoreOpen(false); setIsCalendarOpen(true); }}
                className="p-3 rounded-xl bg-neutral-50 dark:bg-zinc-950 border border-neutral-200 dark:border-zinc-800 text-left space-y-1 hover:border-cyan-500/50 transition"
              >
                <div className="flex items-center gap-2 text-sky-400 font-bold">
                  <CalendarIcon className="w-4 h-4" />
                  <span>Jadwal / Kalender</span>
                </div>
                <p className="text-[10px] text-neutral-500 dark:text-zinc-400">Cron jobs & trigger berkala</p>
              </button>

              <button
                onClick={() => { setIsMobileMoreOpen(false); setIsDocumentsOpen(true); }}
                className="p-3 rounded-xl bg-neutral-50 dark:bg-zinc-950 border border-neutral-200 dark:border-zinc-800 text-left space-y-1 hover:border-cyan-500/50 transition"
              >
                <div className="flex items-center gap-2 text-indigo-400 font-bold">
                  <FileText className="w-4 h-4" />
                  <span>Dokumen RAG</span>
                </div>
                <p className="text-[10px] text-neutral-500 dark:text-zinc-400">Basis data pengetahuan AI</p>
              </button>

              <button
                onClick={() => { setIsMobileMoreOpen(false); setIsGitHubOpen(true); }}
                className="p-3 rounded-xl bg-neutral-50 dark:bg-zinc-950 border border-neutral-200 dark:border-zinc-800 text-left space-y-1 hover:border-cyan-500/50 transition"
              >
                <div className="flex items-center gap-2 text-violet-400 font-bold">
                  <GitPullRequest className="w-4 h-4" />
                  <span>GitHub Webhook</span>
                </div>
                <p className="text-[10px] text-neutral-500 dark:text-zinc-400">CI/CD & issue automation</p>
              </button>

              <button
                onClick={() => { setIsMobileMoreOpen(false); setIsProvidersModalOpen(true); }}
                className="p-3 rounded-xl bg-neutral-50 dark:bg-zinc-950 border border-neutral-200 dark:border-zinc-800 text-left space-y-1 hover:border-cyan-500/50 transition"
              >
                <div className="flex items-center gap-2 text-pink-400 font-bold">
                  <Sliders className="w-4 h-4" />
                  <span>Model Providers</span>
                </div>
                <p className="text-[10px] text-neutral-500 dark:text-zinc-400">OpenAI, Anthropic, Gemini</p>
              </button>

              <button
                onClick={() => { setIsMobileMoreOpen(false); setIsSettingsOpen(true); }}
                className="p-3 rounded-xl bg-neutral-50 dark:bg-zinc-950 border border-neutral-200 dark:border-zinc-800 text-left space-y-1 hover:border-cyan-500/50 transition"
              >
                <div className="flex items-center gap-2 text-zinc-400 font-bold">
                  <Settings className="w-4 h-4" />
                  <span>Pengaturan</span>
                </div>
                <p className="text-[10px] text-neutral-500 dark:text-zinc-400">Konfigurasi sistem & tenant</p>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};
