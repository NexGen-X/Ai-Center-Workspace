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
import { Bot, Plus, RefreshCw, Zap, Layers, Users, CheckSquare, Workflow } from 'lucide-react';
import { ThemeProvider, useTheme } from './context/ThemeContext.js';
import { useResponsive } from './hooks/useResponsive.js';

export const AppContent: React.FC = () => {
  const { isMobile } = useResponsive();
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
  const [viewMode, setViewMode] = useState<'3D' | '2D'>('3D');

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
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#070A0F] text-slate-100 font-sans">
        <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.3)]">
          <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
        </div>
        <p className="mt-4 text-xs font-mono text-cyan-400 tracking-widest uppercase animate-pulse">
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
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col">
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

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto px-3 lg:px-6 py-4 space-y-6">
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

      {/* Mobile Docked Bottom Navigation Bar (< 768px) */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 dark:bg-[#0B0F17]/95 backdrop-blur-md border-t border-slate-800 px-3 py-1.5 flex items-center justify-around shadow-2xl">
          <button
            onClick={() => setViewMode(viewMode === '3D' ? '2D' : '3D')}
            className="flex flex-col items-center justify-center py-1 px-2.5 text-[10px] font-mono text-cyan-400"
          >
            <span className="font-bold text-xs">{viewMode}</span>
            <span>Switch</span>
          </button>

          <button
            onClick={() => setIsTasksModalOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-2.5 text-[10px] font-medium text-slate-300 hover:text-white"
          >
            <CheckSquare className="w-4 h-4 mb-0.5 text-blue-400" />
            <span>Tugas</span>
          </button>

          <button
            onClick={() => setIsManageTeamOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-2.5 text-[10px] font-medium text-slate-300 hover:text-white"
          >
            <Users className="w-4 h-4 mb-0.5 text-purple-400" />
            <span>Tim AI</span>
          </button>

          <button
            onClick={() => setIsPipelineOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-2.5 text-[10px] font-medium text-slate-300 hover:text-white"
          >
            <Workflow className="w-4 h-4 mb-0.5 text-amber-400" />
            <span>Pipeline</span>
          </button>

          <button
            onClick={() => setIsSwarmModalOpen(true)}
            className="flex flex-col items-center justify-center py-1 px-2.5 text-[10px] font-medium text-indigo-400"
          >
            <Zap className="w-4 h-4 mb-0.5 text-indigo-400" />
            <span>Swarm</span>
          </button>
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
