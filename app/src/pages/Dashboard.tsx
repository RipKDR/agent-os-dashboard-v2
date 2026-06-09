import { useEffect, useState } from 'react';
import { Clock, Activity, AlertTriangle, Hash, Cpu, MemoryStick, HardDrive, Timer, Plus, Zap, Target, Inbox, FolderKanban, TrendingUp } from 'lucide-react';
import { api, DispatchHealth, SystemResources, AgentStats, Notification, Task, Project, Goal, Capture, AgentLog } from '../lib/api';

interface Props {
  notifs: Notification[];
  onClearNotifs: () => void;
}

interface ActivityItem {
  id: string;
  type: 'task' | 'notification' | 'agent_log';
  title: string;
  subtitle?: string;
  status?: string;
  timestamp: Date;
  icon?: string;
}

const AGENTS = ['alex', 'maya', 'jordan', 'dev', 'sam'] as const;
const AGENT_META: Record<string, { emoji: string; role: string }> = {
  alex:   { emoji: '🔎', role: 'Research' },
  maya:   { emoji: '✍️', role: 'UX/UI' },
  jordan: { emoji: '📐', role: 'Architect' },
  dev:    { emoji: '🛠️', role: 'Code' },
  sam:    { emoji: '🚦', role: 'QA' },
};


function fmtBytes(b: number) {
  if (b > 1e9) return (b / 1e9).toFixed(1) + ' GB';
  return (b / 1e6).toFixed(0) + ' MB';
}

function fmtUptime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${m}m`;
}

function fmtTime(date: Date) {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  return `${diffDays}d ago`;
}

export default function Dashboard({ notifs, onClearNotifs }: Props) {
  const [health, setHealth] = useState<DispatchHealth | null>(null);
  const [sys, setSys] = useState<SystemResources | null>(null);
  const [stats, setStats] = useState<AgentStats>({});
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [agentLogs, setAgentLogs] = useState<AgentLog[]>([]);

  useEffect(() => {
    const load = () => Promise.all([
      api.tasks.dispatchHealth().catch(() => null),
      api.system.resources().catch(() => null),
      api.agentStats().catch(() => ({})),
      api.tasks.list().catch(() => []),
      api.projects.list().catch(() => []),
      api.goals.list().catch(() => []),
      api.captures.list(20).catch(() => []),
      api.agentLogs(20).catch(() => [])
    ]).then(([healthData, sysData, statsData, tasksData, projectsData, goalsData, capturesData, logsData]) => {
      setHealth(healthData);
      setSys(sysData);
      setStats(statsData);
      setTasks(tasksData);
      setProjects(projectsData);
      setGoals(goalsData);
      setCaptures(capturesData);
      setAgentLogs(logsData);
    });
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  // Create recent activity feed
  const recentActivity: ActivityItem[] = [];

  // Add recent tasks
  tasks.slice(0, 5).forEach(task => {
    recentActivity.push({
      id: `task-${task.id}`,
      type: 'task',
      title: task.title,
      subtitle: task.agent ? `by ${task.agent}` : undefined,
      status: task.status,
      timestamp: new Date(task.created_at)
    });
  });

  // Add recent notifications
  notifs.slice(0, 3).forEach(notif => {
    recentActivity.push({
      id: `notif-${notif.id}`,
      type: 'notification',
      title: notif.message,
      subtitle: notif.source,
      status: notif.type,
      timestamp: new Date(notif.created_at)
    });
  });

  // Add recent agent logs
  agentLogs.slice(0, 3).forEach(log => {
    recentActivity.push({
      id: `log-${log.agent_name}-${log.created_at}`,
      type: 'agent_log',
      title: log.task_description,
      subtitle: `${log.agent_name} • ${log.model_used}`,
      status: log.status,
      timestamp: new Date(log.created_at),
      icon: AGENT_META[log.agent_name]?.emoji
    });
  });

  // Sort by timestamp
  recentActivity.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  const limitedActivity = recentActivity.slice(0, 8);

  // Calculate task trend (last 7 days completed vs failed)
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recentTasks = tasks.filter(t => new Date(t.created_at) > sevenDaysAgo);
  const completedCount = recentTasks.filter(t => t.status === 'done').length;
  const failedCount = recentTasks.filter(t => t.status === 'failed').length;

  const kpis = [
    {
      label: 'Pending',
      value: health?.pending ?? '—',
      color: 'text-amber',
      Icon: Clock,
      tooltip: 'Tasks waiting to be processed'
    },
    {
      label: 'In Progress',
      value: health?.inProgress ?? '—',
      color: 'text-blue',
      Icon: Activity,
      tooltip: 'Tasks currently being executed'
    },
    {
      label: 'Stale',
      value: health?.staleInProgress ?? '—',
      color: 'text-red',
      Icon: AlertTriangle,
      tooltip: 'Tasks stuck in progress for too long'
    },
    {
      label: 'Total',
      value: health?.total ?? '—',
      color: 'text-text',
      Icon: Hash,
      tooltip: 'Total tasks in the system'
    },
  ];

  const workspaceStats = [
    { label: 'Projects', value: projects.length, Icon: FolderKanban },
    { label: 'Goals', value: goals.length, Icon: Target },
    { label: 'Captures', value: captures.length, Icon: Inbox }
  ];

  const ramPct = sys ? parseInt(sys.memory.pct) : 0;
  const diskPct = sys?.disk ? Math.round((sys.disk.used / sys.disk.total) * 100) : 0;

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-lg font-bold text-text">Mission Control</h1>
        <p className="text-dim text-xs mt-0.5">Agent OS Dashboard</p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <button className="flex items-center gap-1.5 bg-amber text-bg px-3 py-2 rounded text-xs font-bold hover:opacity-90 transition-opacity">
          <Plus size={12} />New Task
        </button>
        <button className="flex items-center gap-1.5 bg-blue text-white px-3 py-2 rounded text-xs font-bold hover:opacity-90 transition-opacity">
          <Zap size={12} />Dispatch Agent
        </button>
        <button className="flex items-center gap-1.5 bg-green text-white px-3 py-2 rounded text-xs font-bold hover:opacity-90 transition-opacity">
          <Target size={12} />New Goal
        </button>
        <button className="flex items-center gap-1.5 bg-surface border border-border text-text px-3 py-2 rounded text-xs font-bold hover:bg-raised transition-colors">
          <Inbox size={12} />New Capture
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3">
        {kpis.map(({ label, value, color, Icon, tooltip }) => (
          <div key={label} className="bg-surface border border-border rounded-lg p-4 hover:border-border2 transition-colors group" title={tooltip}>
            <div className={`flex items-center gap-1.5 text-xs uppercase tracking-wider mb-2 ${color}`}>
              <Icon size={13} />{label}
            </div>
            <div className="text-3xl font-bold text-text">{value}</div>
          </div>
        ))}
      </div>

      {/* Workspace Stats */}
      <div className="grid grid-cols-3 gap-3">
        {workspaceStats.map(({ label, value, Icon }) => (
          <div key={label} className="bg-surface border border-border rounded-lg p-3 hover:border-border2 transition-colors">
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-dim mb-1">
              <Icon size={12} />{label}
            </div>
            <div className="text-2xl font-bold text-text">{value}</div>
          </div>
        ))}
      </div>

      {/* Task Trend */}
      <div className="bg-surface border border-border rounded-lg p-4 hover:border-border2 transition-colors">
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-dim mb-4">
          <TrendingUp size={13} />Task Trend (7 days)
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green rounded"></div>
            <span className="text-xs text-dim">Completed</span>
            <span className="text-sm font-bold text-green">{completedCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red rounded"></div>
            <span className="text-xs text-dim">Failed</span>
            <span className="text-sm font-bold text-red">{failedCount}</span>
          </div>
          <div className="flex-1">
            <div className="h-2 bg-raised rounded-full overflow-hidden">
              {(completedCount + failedCount) > 0 && (
                <>
                  <div
                    className="h-full bg-green float-left"
                    style={{ width: `${(completedCount / (completedCount + failedCount)) * 100}%` }}
                  />
                  <div
                    className="h-full bg-red"
                    style={{ width: `${(failedCount / (completedCount + failedCount)) * 100}%` }}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* System card */}
        <div className="bg-surface border border-border rounded-lg p-4 hover:border-border2 transition-colors">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-dim mb-4">
            <Cpu size={13} />System
          </div>
          {sys ? (
            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-dim flex items-center gap-1"><Cpu size={11} />CPUs</span>
                <span className="text-text">{sys.cpus} cores · load {sys.loadAvg[0]?.toFixed(2)}</span>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-dim flex items-center gap-1"><MemoryStick size={11} />RAM</span>
                  <span className="text-text">{sys.memory.pct} · {fmtBytes(sys.memory.used)} / {fmtBytes(sys.memory.total)}</span>
                </div>
                <div className="h-1.5 bg-raised rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${ramPct > 80 ? 'bg-red' : ramPct > 60 ? 'bg-amber' : 'bg-blue'}`}
                    style={{ width: sys.memory.pct }}
                  />
                </div>
              </div>
              {sys.disk && (
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-dim flex items-center gap-1"><HardDrive size={11} />Disk</span>
                    <span className="text-text">{diskPct}% · {fmtBytes(sys.disk.used)} / {fmtBytes(sys.disk.total)}</span>
                  </div>
                  <div className="h-1.5 bg-raised rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${diskPct > 80 ? 'bg-red' : diskPct > 60 ? 'bg-amber' : 'bg-green'}`}
                      style={{ width: `${diskPct}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-dim flex items-center gap-1"><Timer size={11} />Uptime</span>
                <span className="text-text">{fmtUptime(sys.uptime)}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-4 bg-raised rounded animate-pulse" />
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-surface border border-border rounded-lg p-4 hover:border-border2 transition-colors">
          <div className="text-xs uppercase tracking-wider text-dim mb-4">Recent Activity</div>
          {limitedActivity.length === 0 ? (
            <div className="text-faint text-xs text-center py-8">No recent activity</div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {limitedActivity.map(item => (
                <div key={item.id} className="text-xs border-b border-border pb-2 last:border-0 last:pb-0">
                  <div className="flex items-center gap-1.5">
                    {item.icon && <span className="text-sm">{item.icon}</span>}
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      item.status === 'done' || item.status === 'completed' || item.status === 'success' ? 'bg-green' :
                      item.status === 'failed' || item.status === 'error' ? 'bg-red' :
                      item.status === 'in_progress' || item.type === 'agent_log' ? 'bg-blue' :
                      'bg-amber'
                    }`} />
                    <span className="text-faint text-[10px] uppercase">{item.type.replace('_', ' ')}</span>
                    <span className="text-faint ml-auto text-[10px]">{fmtTime(item.timestamp)}</span>
                  </div>
                  <div className="text-text mt-0.5 ml-3 truncate">{item.title}</div>
                  {item.subtitle && (
                    <div className="text-faint mt-0.5 ml-3 text-[10px] truncate">{item.subtitle}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Agent Completion Chart */}
        <div className="bg-surface border border-border rounded-lg p-4 hover:border-border2 transition-colors">
          <div className="text-xs uppercase tracking-wider text-dim mb-4">Agent Performance</div>
          <div className="space-y-2">
            {AGENTS.map(a => {
              const meta = AGENT_META[a];
              const s = stats[a] || { total: 0, completed: 0, failed: 0, running: 0 };
              const successRate = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
              const isActive = s.running > 0;

              return (
                <div key={a} className={`flex items-center gap-2 p-2 rounded transition-all ${isActive ? 'bg-a-soft animate-pulse' : 'hover:bg-raised'}`}>
                  <span className="text-sm">{meta.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-xs">
                      <span className="text-text font-bold capitalize">{a}</span>
                      <span className="text-dim">{successRate}%</span>
                    </div>
                    <div className="h-1 bg-raised rounded-full overflow-hidden mt-1">
                      {s.total > 0 && (
                        <div
                          className="h-full bg-green rounded-full transition-all"
                          style={{ width: `${successRate}%` }}
                        />
                      )}
                    </div>
                    <div className="flex justify-between text-[10px] text-faint mt-0.5">
                      <span>{s.completed} done</span>
                      <span>{s.failed} failed</span>
                      {s.running > 0 && <span className="text-blue">{s.running} active</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
