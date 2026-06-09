import { useState, useEffect, useMemo } from 'react';
import { api, Task } from '../lib/api';
import { Plus, Trash2, Loader2, Search, Filter, ChevronDown, ChevronRight, Check, AlertTriangle, Clock, Hash } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  pending:     'text-amber border-amber',
  in_progress: 'text-blue border-blue',
  done:        'text-green border-green',
  failed:      'text-red border-red',
};


const STATUSES = ['pending', 'in_progress', 'done', 'failed'];
const PRIORITIES = ['low', 'medium', 'high'];

type FilterState = 'all' | 'pending' | 'in_progress' | 'done' | 'failed';

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium' });
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterState>('all');
  const [filterAgent, setFilterAgent] = useState('all');
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [showBulkActions, setShowBulkActions] = useState(false);

  const load = async () => {
    try {
      const data = await api.tasks.list();
      setTasks([...data].reverse());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const agents = useMemo(() => {
    const agentSet = new Set(tasks.map(t => t.agent).filter(Boolean));
    return Array.from(agentSet);
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    let filtered = tasks;

    // Text search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.agent?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(t => t.status === filterStatus);
    }

    // Agent filter
    if (filterAgent !== 'all') {
      filtered = filtered.filter(t => t.agent === filterAgent);
    }

    return filtered;
  }, [tasks, searchQuery, filterStatus, filterAgent]);

  const statusCounts = useMemo(() => {
    const counts = { all: tasks.length, pending: 0, in_progress: 0, done: 0, failed: 0 };
    tasks.forEach(t => {
      if (t.status in counts) {
        counts[t.status as keyof typeof counts]++;
      }
    });
    return counts;
  }, [tasks]);

  async function create() {
    if (!newTask.title.trim() || creating) return;
    setCreating(true);
    try {
      await api.tasks.create({
        title: newTask.title.trim(),
        description: newTask.description.trim() || undefined,
        status: 'pending',
        // Note: priority field not in API yet, but added for future support
      });
      setNewTask({ title: '', description: '', priority: 'medium' });
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function patch(id: string, updates: Partial<Task>) {
    await api.tasks.patch(id, updates).catch(() => {});
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }

  async function remove(id: string) {
    await api.tasks.remove(id).catch(() => {});
    setTasks(prev => prev.filter(t => t.id !== id));
  }

  function toggleTaskSelection(id: string) {
    setSelectedTasks(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAllFiltered() {
    setSelectedTasks(new Set(filteredTasks.map(t => t.id)));
  }

  function clearSelection() {
    setSelectedTasks(new Set());
  }

  async function bulkUpdateStatus(status: string) {
    const promises = Array.from(selectedTasks).map(id => patch(id, { status }));
    await Promise.all(promises);
    setSelectedTasks(new Set());
    setShowBulkActions(false);
  }

  async function bulkDelete() {
    if (!confirm(`Delete ${selectedTasks.size} selected tasks?`)) return;
    const promises = Array.from(selectedTasks).map(id => remove(id));
    await Promise.all(promises);
    setSelectedTasks(new Set());
    setShowBulkActions(false);
  }

  const hasSelection = selectedTasks.size > 0;

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text">Tasks</h1>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-dim text-xs">{filteredTasks.length} of {tasks.length} tasks</span>
            {hasSelection && (
              <span className="text-blue text-xs">{selectedTasks.size} selected</span>
            )}
          </div>
        </div>

        {hasSelection && (
          <div className="flex items-center gap-2">
            <button
              onClick={clearSelection}
              className="text-xs text-faint hover:text-text transition-colors"
            >
              Clear
            </button>
            <button
              onClick={() => setShowBulkActions(!showBulkActions)}
              className="flex items-center gap-1 bg-blue text-white px-3 py-1.5 rounded text-xs font-bold hover:opacity-90 transition-opacity"
            >
              <Filter size={12} />
              Bulk Actions
              <ChevronDown size={10} className={`transition-transform ${showBulkActions ? 'rotate-180' : ''}`} />
            </button>
          </div>
        )}
      </div>

      {/* Bulk actions dropdown */}
      {showBulkActions && hasSelection && (
        <div className="bg-surface border border-border rounded-lg p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-dim">Update {selectedTasks.size} tasks:</span>
            {STATUSES.map(status => (
              <button
                key={status}
                onClick={() => bulkUpdateStatus(status)}
                className={`px-2 py-1 rounded text-xs border transition-colors ${STATUS_COLORS[status]} hover:bg-opacity-20`}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
            <button
              onClick={bulkDelete}
              className="px-2 py-1 rounded text-xs text-red border border-red hover:bg-red hover:bg-opacity-20 transition-colors ml-2"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Search and filters */}
      <div className="grid grid-cols-3 gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-faint" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            className="w-full pl-9 bg-surface border border-border rounded px-3 py-2 text-sm text-text placeholder:text-faint focus:outline-none focus:border-border2"
          />
        </div>
        <select
          value={filterAgent}
          onChange={e => setFilterAgent(e.target.value)}
          className="bg-surface border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-border2"
        >
          <option value="all">All agents</option>
          {agents.map(agent => (
            <option key={agent} value={agent}>{agent}</option>
          ))}
        </select>
        <button
          onClick={hasSelection ? clearSelection : selectAllFiltered}
          className="bg-surface border border-border rounded px-3 py-2 text-sm text-text hover:bg-raised transition-colors"
        >
          {hasSelection ? 'Clear selection' : `Select all ${filteredTasks.length}`}
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {/* Sidebar filters */}
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wider text-dim mb-3">Filters</div>
          {(['all', 'pending', 'in_progress', 'done', 'failed'] as const).map(status => {
            const count = statusCounts[status];
            const isActive = filterStatus === status;
            const Icon = status === 'pending' ? Clock :
                        status === 'in_progress' ? Loader2 :
                        status === 'done' ? Check :
                        status === 'failed' ? AlertTriangle : Hash;

            return (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-xs transition-colors border ${
                  isActive
                    ? 'bg-a-soft text-amber border-border2'
                    : 'text-dim hover:text-text hover:bg-raised border-transparent'
                }`}
              >
                <Icon size={12} />
                <span className="flex-1 text-left capitalize">{status.replace('_', ' ')}</span>
                <span className="bg-raised px-1.5 py-0.5 rounded text-[10px] font-bold">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Main content */}
        <div className="col-span-3 space-y-4">
          {/* Create */}
          <div className="bg-surface border border-border rounded-lg p-4">
            <div className="space-y-3">
              <input
                value={newTask.title}
                onChange={e => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && create()}
                placeholder="New task title..."
                className="w-full bg-raised border border-border rounded px-3 py-2 text-sm text-text placeholder:text-faint focus:outline-none focus:border-border2"
              />
              <textarea
                value={newTask.description}
                onChange={e => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Description (optional)..."
                rows={2}
                className="w-full bg-raised border border-border rounded px-3 py-2 text-sm text-text placeholder:text-faint focus:outline-none focus:border-border2 resize-none"
              />
              <div className="flex items-center gap-2">
                <select
                  value={newTask.priority}
                  onChange={e => setNewTask(prev => ({ ...prev, priority: e.target.value }))}
                  className="bg-raised border border-border rounded px-3 py-1.5 text-xs text-text focus:outline-none focus:border-border2"
                >
                  {PRIORITIES.map(p => (
                    <option key={p} value={p}>{p} priority</option>
                  ))}
                </select>
                <button
                  onClick={create}
                  disabled={!newTask.title.trim() || creating}
                  className="bg-amber text-bg px-4 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 hover:opacity-90 transition-opacity ml-auto"
                >
                  {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  Add Task
                </button>
              </div>
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-surface border border-border rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="bg-surface border border-border rounded-lg p-8 text-center">
              <div className="text-dim text-sm mb-2">
                {tasks.length === 0 ? 'No tasks yet' : 'No tasks match your filters'}
              </div>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-blue hover:text-text transition-colors text-xs"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTasks.map(t => {
                const isSelected = selectedTasks.has(t.id);
                const isExpanded = expandedTask === t.id;

                return (
                  <div
                    key={t.id}
                    className={`bg-surface border rounded-lg transition-all ${
                      isSelected ? 'border-amber bg-a-soft' : 'border-border hover:border-border2'
                    }`}
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleTaskSelection(t.id)}
                        className="w-4 h-4 accent-amber"
                      />
                      <button
                        onClick={() => setExpandedTask(isExpanded ? null : t.id)}
                        className="text-faint hover:text-text transition-colors"
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                      <select
                        value={t.status}
                        onChange={e => patch(t.id, { status: e.target.value })}
                        className={`bg-transparent border rounded px-2 py-0.5 text-[10px] font-mono focus:outline-none cursor-pointer ${STATUS_COLORS[t.status] || 'text-dim border-border'}`}
                        onClick={e => e.stopPropagation()}
                      >
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <span className="flex-1 text-sm text-text">{t.title}</span>
                      {t.agent && (
                        <span className="text-[10px] text-faint bg-raised px-2 py-0.5 rounded shrink-0">{t.agent}</span>
                      )}
                      <span className="text-[10px] text-faint shrink-0">
                        {formatRelativeTime(t.created_at)}
                      </span>
                      <button
                        onClick={() => remove(t.id)}
                        className="text-faint hover:text-red transition-colors shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-border px-4 py-3 bg-raised">
                        {t.description ? (
                          <div className="text-sm text-text mb-3">{t.description}</div>
                        ) : (
                          <div className="text-xs text-faint mb-3 italic">No description</div>
                        )}
                        <div className="flex items-center gap-4 text-xs text-dim">
                          <span>ID: {t.id}</span>
                          <span>Created: {new Date(t.created_at).toLocaleString()}</span>
                          {t.source && <span>Source: {t.source}</span>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
