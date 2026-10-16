import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar.js';
import { StatCards } from './components/StatCards.js';
import { AgentCard } from './features/team/AgentCard.js';
import { AddAgentModal } from './features/team/AddAgentModal.js';
import { AgentDetailModal } from './features/team/AgentDetailModal.js';
import { ManageTeamModal } from './features/team/ManageTeamModal.js';
import { LoginModal } from './components/LoginModal.js';
import { LoginPage } from './features/auth/LoginPage.js';
import { CalendarModal } from './features/calendar/CalendarModal.js';
import { ReportsModal } from './features/reports/ReportsModal.js';
import { DocumentsModal } from './features/documents/DocumentsModal.js';
import { ProjectsModal } from './features/projects/ProjectsModal.js';
import { SettingsModal } from './features/settings/SettingsModal.js';
import { ManageProvidersModal } from './features/providers/ManageProvidersModal.js';
import { TaskList } from './features/tasks/TaskList.js';
import { CreateTaskModal } from './features/tasks/CreateTaskModal.js';
import { TaskDetailModal } from './features/tasks/TaskDetailModal.js';
import { TasksModal } from './features/tasks/TasksModal.js';
import { Workspace3D } from './features/workspace3d/Workspace3D.js';
import { Workspace2DView } from './features/workspace3d/Workspace2DView.js';
import { ActivityFeed } from './components/ActivityFeed.js';
import { ServerMonitoringWidget } from './components/ServerMonitoringWidget.js';
import { ConsoleDrawer } from './components/terminal/ConsoleDrawer.js';
import { PlaygroundModal } from './features/playground/PlaygroundModal.js';
import { PipelineModal } from './features/pipeline/PipelineModal.js';
import { SwarmMissionModal } from './features/swarm/SwarmMissionModal.js';
import { ActionApprovalModal } from './features/actions/ActionApprovalModal.js';
import { ActionHistoryModal } from './features/actions/ActionHistoryModal.js';
import { WarRoomModal } from './features/warroom/WarRoomModal.js';
import { SreModal } from './features/sre/SreModal.js';
import { DataAnalystModal } from './features/data-analyst/DataAnalystModal.js';
import { SkillStudioModal } from './features/skills/SkillStudioModal.js';
import { MemoryGraphModal } from './features/memory/MemoryGraphModal.js';
import { useFeedback } from './components/common/FeedbackContext.js';
import { ErrorBoundary } from './components/common/ErrorBoundary.js';
import { api } from './services/api.js';
import { AIAgent, Task, Activity, DashboardSummary, ServerMetrics, Project, OrchestratorStatus, ModelProviderConfig, AgentAction } from '../../shared/types.js';
import { Bot, Plus, RefreshCw, Zap, Layers, Users } from 'lucide-react';

export const App: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [providers, setProviders] = useState<ModelProviderConfig[]>([]);
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null);
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
  const [isSreOpen, setIsSreOpen] = useState(false);
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
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [orchestratorStatus, setOrchestratorStatus] = useState<OrchestratorStatus | undefined>(undefined);
  const [selectedAgent, setSelectedAgent] = useState<AIAgent | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedProjectIdForTask, setSelectedProjectIdForTask] = useState<string | undefined>(undefined);
  const [pendingAction, setPendingAction] = useState<AgentAction | null>(null);
  const [isActionHistoryOpen, setIsActionHistoryOpen] = useState(false);
  const [pendingActionCount, setPendingActionCount] = useState(0);

  const { toast } = useFeedback();

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
      setMetrics(sumData.serverMetrics);

      api.getOrchestratorStatus().then(st => setOrchestratorStatus(st)).catch(() => {});
      api.getPendingActionsCount().then(res => setPendingActionCount(res.pendingCount)).catch(() => {});
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleToggleOrchestrator = async () => {
    try {
      const res = await api.toggleOrchestrator();
      setOrchestratorStatus(res.status);
      if (res.enabled) {
        toast.success('⚡ Auto-Orchestrator diaktifkan: tugas antrean akan diproses otomatis.');
      } else {
        toast.info('Auto-Orchestrator beralih ke mode standby.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Gagal mengubah status orchestrator.');
    }
  };

  // Check auth session on mount
  useEffect(() => {
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
    }
  }, [currentUser, refreshAllData]);

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

      eventSource.addEventListener('orchestrator.status', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          setOrchestratorStatus(data);
        } catch {
          // ignore
        }
      });

      eventSource.addEventListener('system.restored', () => {
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

    // Fallback polling for server monitoring metrics every 15 seconds
    const metricsInterval = setInterval(async () => {
      try {
        const m = await api.getMonitoringSummary();
        setMetrics(m);
      } catch {
        // ignore
      }
    }, 15000);

    return () => {
      eventSource?.close();
      clearTimeout(reconnectTimeout);
      clearInterval(metricsInterval);
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
        onOpenSre={() => setIsSreOpen(true)}
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
        orchestratorStatus={orchestratorStatus}
        onToggleOrchestrator={handleToggleOrchestrator}
        onToggleConsole={() => setIsConsoleOpen(!isConsoleOpen)}
        isConsoleOpen={isConsoleOpen}
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
                serverMetrics={metrics}
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
            <ServerMonitoringWidget metrics={metrics} onOpenSre={() => setIsSreOpen(true)} />
            <ActivityFeed activities={activities} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-4 text-center text-xs text-slate-500">
        AI Agent Command Center • Berjalan di atas Node.js 20 & PostgreSQL 16 • Route-X AI Gateway Ready
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

      <CalendarModal
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        tasks={tasks}
        projects={projects}
        onSelectTask={handleSelectTask}
      />

      <ReportsModal
        isOpen={isReportsOpen}
        onClose={() => setIsReportsOpen(false)}
      />

      <DocumentsModal
        isOpen={isDocumentsOpen}
        onClose={() => setIsDocumentsOpen(false)}
        projects={projects}
      />

      <ProjectsModal
        isOpen={isProjectsOpen}
        onClose={() => setIsProjectsOpen(false)}
        onProjectsUpdated={refreshAllData}
        onOpenCreateTaskForProject={handleOpenCreateTaskForProject}
        onSelectTask={handleSelectTask}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenManageProviders={() => setIsProvidersModalOpen(true)}
        onWorkspaceRestored={refreshAllData}
      />

      <ManageProvidersModal
        isOpen={isProvidersModalOpen}
        onClose={() => setIsProvidersModalOpen(false)}
        onProvidersUpdated={refreshAllData}
      />

      <PlaygroundModal
        isOpen={isPlaygroundOpen}
        onClose={() => setIsPlaygroundOpen(false)}
        providers={providers}
        agents={agents}
      />

      <PipelineModal
        isOpen={isPipelineOpen}
        onClose={() => setIsPipelineOpen(false)}
        agents={agents}
        projects={projects}
        onPipelineCompleted={refreshAllData}
      />

      <SwarmMissionModal
        isOpen={isSwarmModalOpen}
        onClose={() => setIsSwarmModalOpen(false)}
        agents={agents}
        onMissionLaunched={refreshAllData}
      />

      <WarRoomModal
        isOpen={isWarRoomOpen}
        onClose={() => setIsWarRoomOpen(false)}
        agents={agents}
        projects={projects}
        onTaskCreated={refreshAllData}
      />

      <SreModal
        isOpen={isSreOpen}
        onClose={() => setIsSreOpen(false)}
      />

      <DataAnalystModal
        isOpen={isDataAnalystOpen}
        onClose={() => setIsDataAnalystOpen(false)}
      />

      <SkillStudioModal
        isOpen={isSkillsOpen}
        onClose={() => setIsSkillsOpen(false)}
        agents={agents}
      />

      <MemoryGraphModal
        isOpen={isMemoryGraphOpen}
        onClose={() => setIsMemoryGraphOpen(false)}
        agents={agents}
      />

      <ConsoleDrawer
        isOpen={isConsoleOpen}
        onClose={() => setIsConsoleOpen(false)}
        orchestratorStatus={orchestratorStatus}
        onRefreshOrchestrator={refreshAllData}
      />

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
    </div>
  );
};
