import { useState, useEffect } from 'react';
import { Target, Plus, Check, Clock, Archive, X } from 'lucide-react';
import { api, Goal, Task } from '../lib/api';

const STATUS_COLORS = {
  active: 'bg-blue text-white',
  completed: 'bg-green text-white',
  archived: 'bg-faint text-dim',
};

const STATUS_ICONS = {
  active: Clock,
  completed: Check,
  archived: Archive,
};

export default function Goals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newGoal, setNewGoal] = useState({ title: '', description: '' });

  useEffect(() => {
    Promise.all([
      api.goals.list().catch(() => []),
      api.tasks.list().catch(() => [])
    ]).then(([goalsList, tasksList]) => {
      setGoals(goalsList);
      setTasks(tasksList);
      setLoading(false);
    });
  }, []);

  const handleCreate = async () => {
    if (!newGoal.title.trim()) return;
    try {
      const goal = await api.goals.create({
        title: newGoal.title,
        description: newGoal.description,
        status: 'active'
      });
      setGoals(prev => [goal, ...prev]);
      setNewGoal({ title: '', description: '' });
      setCreating(false);
    } catch (err) {
      console.error('Failed to create goal:', err);
    }
  };

  const toggleStatus = async (goal: Goal) => {
    const nextStatus = goal.status === 'active' ? 'completed' :
                       goal.status === 'completed' ? 'archived' : 'active';
    try {
      // Note: API doesn't have PATCH for goals yet, so this won't work until server is updated
      // const updated = await api.goals.patch(goal.id, { status: nextStatus });
      // For now, just update locally
      setGoals(prev => prev.map(g => g.id === goal.id ? { ...g, status: nextStatus } : g));
    } catch (err) {
      console.error('Failed to update goal:', err);
    }
  };

  const getRelatedTasks = (goalId: string) => {
    // For now, we'll match tasks by looking for goal titles in task descriptions
    // This is a simple approximation until we have proper linking
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return [];

    const goalKeywords = goal.title.toLowerCase().split(' ').filter(word => word.length > 3);
    return tasks.filter(task =>
      goalKeywords.some(keyword =>
        task.title.toLowerCase().includes(keyword) ||
        task.description?.toLowerCase().includes(keyword)
      )
    ).slice(0, 3); // Show max 3 related tasks
  };

  const statusCounts = goals.reduce((acc, goal) => {
    acc[goal.status] = (acc[goal.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-surface border border-border rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text flex items-center gap-2">
            <Target size={18} className="text-amber" />
            Goals
          </h1>
          <p className="text-dim text-xs mt-0.5">Strategic objectives and targets</p>
        </div>

        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 bg-amber text-bg px-3 py-2 rounded text-xs font-bold hover:opacity-90 transition-opacity"
        >
          <Plus size={12} />New Goal
        </button>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-3 gap-3">
        {(['active', 'completed', 'archived'] as const).map(status => {
          const count = statusCounts[status] || 0;
          const StatusIcon = STATUS_ICONS[status];
          return (
            <div key={status} className="bg-surface border border-border rounded-lg p-3">
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider mb-1 text-dim">
                <StatusIcon size={12} />
                {status}
              </div>
              <div className="text-2xl font-bold text-text">{count}</div>
            </div>
          );
        })}
      </div>

      {/* Create form */}
      {creating && (
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-text">Create New Goal</h3>
            <button
              onClick={() => setCreating(false)}
              className="text-faint hover:text-text transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Goal title..."
              value={newGoal.title}
              onChange={e => setNewGoal(prev => ({ ...prev, title: e.target.value }))}
              className="w-full bg-raised border border-border rounded px-3 py-2 text-sm text-text placeholder:text-faint focus:outline-none focus:border-border2"
              autoFocus
            />
            <textarea
              placeholder="Description (optional)..."
              value={newGoal.description}
              onChange={e => setNewGoal(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full bg-raised border border-border rounded px-3 py-2 text-sm text-text placeholder:text-faint focus:outline-none focus:border-border2 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={!newGoal.title.trim()}
                className="bg-amber text-bg px-3 py-1.5 rounded text-xs font-bold disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                Create
              </button>
              <button
                onClick={() => setCreating(false)}
                className="bg-raised border border-border px-3 py-1.5 rounded text-xs text-text hover:bg-border transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Goals list */}
      <div className="space-y-3">
        {goals.length === 0 ? (
          <div className="bg-surface border border-border rounded-lg p-8 text-center">
            <Target size={24} className="mx-auto mb-3 text-faint" />
            <div className="text-faint text-sm mb-2">No goals yet</div>
            <button
              onClick={() => setCreating(true)}
              className="text-amber hover:text-text transition-colors text-xs"
            >
              Create your first goal
            </button>
          </div>
        ) : (
          goals.map(goal => {
            const relatedTasks = getRelatedTasks(goal.id);
            const StatusIcon = STATUS_ICONS[goal.status as keyof typeof STATUS_ICONS];

            return (
              <div key={goal.id} className="bg-surface border border-border rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-text">{goal.title}</h3>
                      <button
                        onClick={() => toggleStatus(goal)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${STATUS_COLORS[goal.status as keyof typeof STATUS_COLORS]}`}
                      >
                        <StatusIcon size={8} />
                        {goal.status}
                      </button>
                    </div>
                    {goal.description && (
                      <p className="text-xs text-dim mb-2">{goal.description}</p>
                    )}
                    <div className="text-[10px] text-faint">
                      Created {new Date(goal.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Related tasks */}
                {relatedTasks.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="text-[10px] text-dim uppercase tracking-wider mb-2">Related Tasks</div>
                    <div className="space-y-1">
                      {relatedTasks.map(task => (
                        <div key={task.id} className="flex items-center gap-2 text-xs">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            task.status === 'done' ? 'bg-green' :
                            task.status === 'failed' ? 'bg-red' :
                            task.status === 'in_progress' ? 'bg-blue' :
                            'bg-amber'
                          }`} />
                          <span className="flex-1 text-text truncate">{task.title}</span>
                          <span className="text-faint text-[10px]">{task.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}