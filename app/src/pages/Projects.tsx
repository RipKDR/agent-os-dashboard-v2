import { useState, useEffect, useMemo } from 'react';
import { api, Project, Task } from '../lib/api';
import { Plus, FolderOpen, Trash2, ChevronDown, ChevronRight, Calendar, Hash } from 'lucide-react';

const STATUS_BADGE: Record<string, string> = {
  active:    'text-green border-green bg-green bg-opacity-10',
  completed: 'text-blue border-blue bg-blue bg-opacity-10',
  archived:  'text-faint border-faint bg-faint bg-opacity-10',
};

const STATUS_CYCLE = ['active', 'completed', 'archived'];

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays < 1) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);

  const load = async () => {
    try {
      const [projectsData, tasksData] = await Promise.all([
        api.projects.list(),
        api.tasks.list().catch(() => [])
      ]);
      setProjects(projectsData);
      setTasks(tasksData);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Calculate task counts per project (approximate matching by name)
  const projectTaskCounts = useMemo(() => {
    const counts: Record<string, { total: number; completed: number; failed: number }> = {};

    projects.forEach(project => {
      const projectKeywords = project.name.toLowerCase().split(' ').filter(word => word.length > 2);
      const relatedTasks = tasks.filter(task => {
        const taskText = `${task.title} ${task.description || ''}`.toLowerCase();
        return projectKeywords.some(keyword => taskText.includes(keyword));
      });

      counts[project.id] = {
        total: relatedTasks.length,
        completed: relatedTasks.filter(t => t.status === 'done').length,
        failed: relatedTasks.filter(t => t.status === 'failed').length
      };
    });

    return counts;
  }, [projects, tasks]);

  async function create() {
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      await api.projects.create({ name: name.trim(), description: desc.trim() || undefined, status: 'active' });
      setName('');
      setDesc('');
      setShowForm(false);
      await load();
    } finally {
      setCreating(false);
    }
  }

  async function toggleStatus(project: Project) {
    const currentIndex = STATUS_CYCLE.indexOf(project.status);
    const nextStatus = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length];

    try {
      // Note: API doesn't have PATCH for projects yet, so this won't work until server is updated
      // await api.projects.patch(project.id, { status: nextStatus });
      // For now, just update locally
      setProjects(prev => prev.map(p => p.id === project.id ? { ...p, status: nextStatus } : p));
    } catch (err) {
      console.error('Failed to update project status:', err);
    }
  }

  async function deleteProject(projectId: string) {
    if (!confirm('Delete this project? This cannot be undone.')) return;

    try {
      // Note: API doesn't have DELETE for projects yet
      // await api.projects.remove(projectId);
      // For now, just update locally
      setProjects(prev => prev.filter(p => p.id !== projectId));
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  }

  const statusCounts = useMemo(() => {
    const counts = { active: 0, completed: 0, archived: 0 };
    projects.forEach(p => {
      if (p.status in counts) {
        counts[p.status as keyof typeof counts]++;
      }
    });
    return counts;
  }, [projects]);

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text">Projects</h1>
          <div className="flex items-center gap-4 mt-0.5">
            <span className="text-dim text-xs">{projects.length} projects</span>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-green">{statusCounts.active} active</span>
              <span className="text-blue">{statusCounts.completed} completed</span>
              <span className="text-faint">{statusCounts.archived} archived</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 bg-amber text-bg px-3 py-2 rounded text-xs font-bold hover:opacity-90 transition-opacity"
        >
          <Plus size={13} />New Project
        </button>
      </div>

      {showForm && (
        <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
          <div className="text-xs font-bold text-text uppercase tracking-wider">New Project</div>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && create()}
            placeholder="Project name"
            className="w-full bg-raised border border-border rounded px-3 py-2 text-sm text-text placeholder:text-faint focus:outline-none focus:border-border2"
            autoFocus
          />
          <textarea
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full bg-raised border border-border rounded px-3 py-2 text-sm text-text placeholder:text-faint focus:outline-none focus:border-border2 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={create}
              disabled={!name.trim() || creating}
              className="bg-amber text-bg px-4 py-2 rounded text-xs font-bold disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              Create
            </button>
            <button
              onClick={() => { setShowForm(false); setName(''); setDesc(''); }}
              className="text-dim text-xs px-4 py-2 hover:text-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-36 bg-surface border border-border rounded-lg animate-pulse" />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <FolderOpen size={32} className="mx-auto mb-2 text-faint" />
          <div className="text-dim text-sm mb-2">No projects yet</div>
          <button
            onClick={() => setShowForm(true)}
            className="text-amber hover:text-text transition-colors text-xs"
          >
            Create your first project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {projects.map(p => {
            const taskCount = projectTaskCounts[p.id] || { total: 0, completed: 0, failed: 0 };
            const isExpanded = expandedProject === p.id;
            const completionRate = taskCount.total > 0 ? Math.round((taskCount.completed / taskCount.total) * 100) : 0;

            return (
              <div
                key={p.id}
                className="bg-surface border border-border rounded-lg overflow-hidden hover:border-border2 transition-colors"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <FolderOpen size={18} className="text-amber mt-0.5" />
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleStatus(p)}
                        className={`text-[10px] border rounded px-1.5 py-0.5 transition-all hover:opacity-80 cursor-pointer ${STATUS_BADGE[p.status] || 'text-dim border-border'}`}
                        title={`Click to cycle status (currently ${p.status})`}
                      >
                        {p.status}
                      </button>
                      <button
                        onClick={() => deleteProject(p.id)}
                        className="text-faint hover:text-red transition-colors p-1"
                        title="Delete project"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>

                  <div
                    className="cursor-pointer"
                    onClick={() => setExpandedProject(isExpanded ? null : p.id)}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="font-bold text-sm text-text flex-1">{p.name}</div>
                      {isExpanded ? <ChevronDown size={12} className="text-faint" /> : <ChevronRight size={12} className="text-faint" />}
                    </div>

                    {p.description && (
                      <div className="text-xs text-dim mb-3 line-clamp-2">{p.description}</div>
                    )}

                    {/* Progress indicator */}
                    {taskCount.total > 0 && (
                      <div className="mb-3">
                        <div className="flex justify-between text-[10px] text-dim mb-1">
                          <span>Progress</span>
                          <span>{completionRate}% ({taskCount.completed}/{taskCount.total})</span>
                        </div>
                        <div className="h-1.5 bg-raised rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green transition-all"
                            style={{ width: `${completionRate}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-faint">
                      <div className="flex items-center gap-1">
                        <Calendar size={8} />
                        <span>{formatRelativeTime(p.created_at)}</span>
                      </div>
                      {taskCount.total > 0 && (
                        <div className="flex items-center gap-1">
                          <Hash size={8} />
                          <span>{taskCount.total} tasks</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border bg-raised p-4">
                    <div className="space-y-3 text-xs">
                      <div>
                        <div className="text-dim uppercase tracking-wider mb-1">Details</div>
                        <div className="text-text">
                          {p.description || <span className="text-faint italic">No description provided</span>}
                        </div>
                      </div>

                      <div>
                        <div className="text-dim uppercase tracking-wider mb-1">Task Summary</div>
                        {taskCount.total === 0 ? (
                          <div className="text-faint italic">No related tasks found</div>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-dim">Total tasks</span>
                              <span className="text-text font-bold">{taskCount.total}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-dim">Completed</span>
                              <span className="text-green font-bold">{taskCount.completed}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-dim">Failed</span>
                              <span className="text-red font-bold">{taskCount.failed}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="text-dim uppercase tracking-wider mb-1">Metadata</div>
                        <div className="space-y-0.5 text-faint">
                          <div>ID: {p.id}</div>
                          <div>Created: {new Date(p.created_at).toLocaleString()}</div>
                          <div>Status: {p.status}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
