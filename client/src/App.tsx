import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar.js';
import { StatCards } from './components/StatCards.js';
import { AgentCard } from './features/team/AgentCard.js';
import { AddAgentModal } from './features/team/AddAgentModal.js';
import { AgentDetailModal } from './features/team/AgentDetailModal.js';
import { ManageTeamModal } from './features/team/ManageTeamModal.js';
import { LoginModal } from './components/LoginModal.js';
import { CalendarModal } from './features/calendar/CalendarModal.js';
import { ReportsModal } from './features/reports/ReportsModal.js';
import { DocumentsModal } from './features/documents/DocumentsModal.js';
import { ProjectsModal } from './features/projects/ProjectsModal.js';
import { SettingsModal } from './features/settings/SettingsModal.js';
import { TaskList } from './features/tasks/TaskList.js';
import { CreateTaskModal } from './features/tasks/CreateTaskModal.js';
import { TaskDetailModal } from './features/tasks/TaskDetailModal.js';
import { TasksModal } from './features/tasks/TasksModal.js';
import { Workspace3D } from './features/workspace3d/Workspace3D.js';
import { Workspace2DView } from './features/workspace3d/Workspace2DView.js';
import { ActivityFeed } from './components/ActivityFeed.js';
import { ServerMonitoringWidget } from './components/ServerMonitoringWidget.js';
import { api } from './services/api.js';
import { AIAgent, Task, Activity, DashboardSummary, ServerMetrics, Project } from '../../shared/types.js';
import { Bot, Plus, RefreshCw, Zap, Layers, Users } from 'lucide-react';

export const App: React.FC = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [viewMode, setViewMode] = useState<'3D' | '2D'>('3D');

  // Modals state
  const [isTasksModalOpen, setIsTasksModalOpen] = useState(false);
  const [isManageTeamOpen, setIsManageTeamOpen] = useState(false);
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

  const refreshAllData = useCallback(async () => {
    try {
      const [sumData, agentsData, tasksData, projsData, actsData] = await Promise.all([
        api.getDashboardSummary(),
        api.getAgents(),
        api.getTasks(),
        api.getProjects().catch(() => []),
        api.getActivities(30)
      ]);
      setSummary(sumData);
      setAgents(agentsData);
      setTasks(tasksData);
      setProjects(projsData);
      setActivities(actsData);
      setMetrics(sumData.serverMetrics);
    } catch (err) {
      console.error('Failed to load initial data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Check auth session
  useEffect(() => {
    api.getMe()
      .then((res) => {
        if (res.authenticated) setCurrentUser(res.user);
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await api.logout().catch(() => {});
    localStorage.removeItem('ai_center_token');
    setCurrentUser(null);
  };

  // Initial load
  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  // Server-Sent Events (SSE) setup
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;

    const connectSSE = () => {
      eventSource = new EventSource('/api/realtime');

      eventSource.addEventListener('connected', () => {
        setIsRealtimeConnected(true);
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

      eventSource.onerror = () => {
        setIsRealtimeConnected(false);
        eventSource?.close();
        reconnectTimeout = setTimeout(connectSSE, 5000);
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
  }, [refreshAllData]);

  const handleOpenCreateTaskForProject = (projId: string) => {
    setSelectedProjectIdForTask(projId);
    setIsCreateTaskOpen(true);
  };

  const handleSelectTask = (task: Task) => {
    setSelectedTaskId(task.id);
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <Navbar
        onOpenAddAgent={() => setIsAddAgentOpen(true)}
        onOpenManageTeam={() => setIsManageTeamOpen(true)}
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
        onOpenLogin={() => setIsLoginOpen(true)}
        onLogout={handleLogout}
        currentUser={currentUser}
        isRealtimeConnected={isRealtimeConnected}
        systemStatus={summary?.systemStatus || 'OPERATIONAL'}
        unreadActivityCount={activities.length}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto px-3 lg:px-6 py-4 space-y-6">
        {/* 3D Virtual Workspace Cockpit & 2D Fallback */}
        <section aria-label="Virtual Workspace">
          {viewMode === '3D' ? (
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
              onFallbackTo2D={() => setViewMode('2D')}
            />
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
            <ServerMonitoringWidget metrics={metrics} />
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
      />
    </div>
  );
};
