const BASE = '';

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
}

export interface Task { id: string; title: string; description?: string; agent?: string; status: string; source?: string; created_at: string; }
export interface Project { id: string; name: string; description?: string; status: string; created_at: string; }
export interface Goal { id: string; title: string; description?: string; status: string; created_at: string; }
export interface Capture { id: string; text?: string; raw_text?: string; intent?: string; status: string; created_at: string; }
export interface Notification { id: string; type: string; message: string; source: string; read: boolean; created_at: string; }
export interface Idea { id: string; title: string; summary?: string; status: string; created_at: string; }
export interface SystemResources { hostname: string; platform: string; uptime: number; cpus: number; loadAvg: number[]; memory: { total: number; free: number; used: number; pct: string }; disk: { total: number; used: number; available: number } | null; }
export interface SystemError { agent: string; task: string; model?: string; ts: string; }
export interface AgentLog { agent_name: string; task_description: string; model_used: string; status: string; created_at: string; }
export interface AgentStats { [agent: string]: { total: number; completed: number; failed: number; running: number } }
export interface SearchResult { type: string; label: string; id: string; status?: string; }
export interface DispatchHealth { ok: boolean; total: number; pending: number; inProgress: number; staleInProgress: number; counts: Record<string, number>; }
export interface TerminalResult { output: string; exitCode: number; }
export interface WorkspaceEntry { name: string; type: 'file' | 'dir'; size: number; modifiedAt: string; }
export interface FileContent { content: string; path: string; }
export interface GitStatus { branch: string; changes: GitChange[]; ahead: number; behind: number; }
export interface GitChange { path: string; status: string; staged: boolean; }
export interface GitCommit { hash: string; author: string; date: string; message: string; }
export interface GitDiff { diff: string; }
export interface Message { id: string; platform: string; channel: string; sender: string; text: string; timestamp: string; }
export interface MessageThread { messages: Message[]; }
export interface CronJob { id: string; name: string; schedule: string; nextRun?: string; lastRun?: string; lastStatus: string; enabled: boolean; prompt?: string; agent?: string; }
export interface AgentActivity { agent: string; status: string; task: string; output: string; timestamp: string; }

export const api = {
  tasks: {
    list: () => req<Task[]>('/api/tasks'),
    create: (data: Partial<Task>) => req<Task>('/api/tasks', { method: 'POST', body: JSON.stringify(data) }),
    patch: (id: string, data: Partial<Task>) => req<Task>(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => req<{ ok: boolean }>(`/api/tasks/${id}`, { method: 'DELETE' }),
    dispatchHealth: () => req<DispatchHealth>('/api/tasks/dispatch-health'),
  },
  projects: {
    list: () => req<Project[]>('/api/projects'),
    create: (data: Partial<Project>) => req<Project>('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
  },
  goals: {
    list: () => req<Goal[]>('/api/goals'),
    create: (data: Partial<Goal>) => req<Goal>('/api/goals', { method: 'POST', body: JSON.stringify(data) }),
  },
  captures: {
    list: (limit = 20) => req<Capture[]>(`/api/captures?limit=${limit}`),
    create: (data: Partial<Capture>) => req<Capture>('/api/captures', { method: 'POST', body: JSON.stringify(data) }),
  },
  skills: {
    list: () => fetch("/api/skills").then(r => r.json()),
  },
  notifications: {
    list: () => req<Notification[]>('/api/notifications'),
    create: (data: { type: string; message: string; source: string }) => req<Notification>('/api/notifications', { method: 'POST', body: JSON.stringify(data) }),
    patch: (id: string, data: Partial<Notification>) => req<Notification>(`/api/notifications/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    clear: () => req<{ ok: boolean }>('/api/notifications', { method: 'DELETE' }),
  },
  system: {
    resources: () => req<SystemResources>('/api/system/resources'),
    errors: () => req<{ errors: SystemError[]; recentTaskFailures: Task[] }>('/api/system/errors'),
  },
  search: (q: string) => req<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(q)}`),
  agentLogs: (limit = 50) => req<AgentLog[]>(`/api/agent-logs?limit=${limit}`),
  agentStats: () => req<AgentStats>('/api/agent-stats'),
  dispatch: (agent: string, message: string) => req<{ ok: boolean; task: Task }>('/api/agents/dispatch', { method: 'POST', body: JSON.stringify({ agent, message }) }),
  dispatchStream: (agent: string, message: string) => req<{ ok: boolean; task: Task }>('/api/agents/dispatch-stream', { method: 'POST', body: JSON.stringify({ agent, message }) }),
  status: () => req<{ ok: boolean; uptime: number; memory: number }>('/api/status'),
  terminal: {
    exec: (command: string, workdir?: string, timeout?: number) => req<TerminalResult>('/api/terminal/exec', { method: 'POST', body: JSON.stringify({ command, workdir, timeout }) }),
  },
  workspace: {
    ls: (path = '/') => req<{ entries: WorkspaceEntry[] }>(`/api/workspace/ls?path=${encodeURIComponent(path)}`),
    read: (path: string) => req<FileContent>(`/api/workspace/read?path=${encodeURIComponent(path)}`),
  },
  git: {
    status: () => req<GitStatus>('/api/git/status'),
    log: (max = 10) => req<{ commits: GitCommit[] }>(`/api/git/log?max=${max}`),
    diff: (path: string) => req<GitDiff>(`/api/git/diff?path=${encodeURIComponent(path)}`),
    commit: (message: string) => req<{ ok: boolean; hash?: string }>('/api/git/commit', { method: 'POST', body: JSON.stringify({ message }) }),
    push: () => req<{ ok: boolean; output: string }>('/api/git/push', { method: 'POST' }),
  },
  messages: {
    list: () => req<{ messages: Message[] }>('/api/messages'),
    send: (platform: string, target: string, message: string) => req<{ ok: boolean }>('/api/messages/send', { method: 'POST', body: JSON.stringify({ platform, target, message }) }),
    thread: (platform: string, channel: string, limit = 20) => req<MessageThread>(`/api/messages/thread?platform=${encodeURIComponent(platform)}&channel=${encodeURIComponent(channel)}&limit=${limit}`),
  },
  cron: {
    list: () => req<{ jobs: CronJob[] }>('/api/cron'),
    create: (data: Partial<CronJob>) => req<CronJob>('/api/cron', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<CronJob>) => req<CronJob>(`/api/cron/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => req<{ ok: boolean }>(`/api/cron/${id}`, { method: 'DELETE' }),
    run: (id: string) => req<{ ok: boolean; message: string }>(`/api/cron/${id}/run`, { method: 'POST' }),
    toggle: (id: string) => req<CronJob>(`/api/cron/${id}/toggle`, { method: 'POST' }),
  },
};
