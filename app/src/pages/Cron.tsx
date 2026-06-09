import { useState, useEffect } from 'react';
import { Clock, Plus, Play, Pause, Trash2, Edit, RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { api, CronJob } from '../lib/api';

export default function Cron() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    schedule: '0 9 * * *', // Default: daily at 9am
    prompt: '',
    agent: '',
    enabled: true
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const agents = [
    { id: '', label: 'No agent (system)' },
    { id: 'alex', label: 'Alex (Research)' },
    { id: 'maya', label: 'Maya (UX/UI)' },
    { id: 'jordan', label: 'Jordan (Architecture)' },
    { id: 'dev', label: 'Dev (Implementation)' },
    { id: 'sam', label: 'Sam (QA)' },
  ];

  const schedulePresets = [
    { value: '*/5 * * * *', label: 'Every 5 minutes' },
    { value: '0 * * * *', label: 'Every hour' },
    { value: '0 9 * * *', label: 'Daily at 9 AM' },
    { value: '0 9 * * 1', label: 'Weekly on Monday at 9 AM' },
    { value: '0 9 1 * *', label: 'Monthly on 1st at 9 AM' },
    { value: 'custom', label: 'Custom...' },
  ];

  // Load jobs
  const loadJobs = async () => {
    setLoading(true);
    try {
      const result = await api.cron.list();
      setJobs(result.jobs);
    } catch (err) {
      console.error('Failed to load cron jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  // Validate form
  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Job name is required';
    }

    if (!formData.schedule.trim()) {
      errors.schedule = 'Schedule is required';
    }

    if (!formData.prompt.trim()) {
      errors.prompt = 'Prompt is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Create or update job
  const saveJob = async () => {
    if (!validateForm()) return;

    try {
      if (editingJob) {
        await api.cron.update(editingJob.id, formData);
      } else {
        await api.cron.create(formData);
      }

      // Reset form
      setFormData({
        name: '',
        schedule: '0 9 * * *',
        prompt: '',
        agent: '',
        enabled: true
      });
      setShowCreateForm(false);
      setEditingJob(null);
      setFormErrors({});

      // Reload jobs
      await loadJobs();
    } catch (err) {
      console.error('Failed to save job:', err);
    }
  };

  // Delete job
  const deleteJob = async (id: string) => {
    if (!confirm('Are you sure you want to delete this job?')) return;

    try {
      await api.cron.remove(id);
      await loadJobs();
    } catch (err) {
      console.error('Failed to delete job:', err);
    }
  };

  // Toggle job enabled/disabled
  const toggleJob = async (id: string) => {
    try {
      await api.cron.toggle(id);
      await loadJobs();
    } catch (err) {
      console.error('Failed to toggle job:', err);
    }
  };

  // Run job now
  const runJobNow = async (id: string) => {
    try {
      await api.cron.run(id);
      // Could show a toast notification here
      console.log('Job triggered successfully');
    } catch (err) {
      console.error('Failed to run job:', err);
    }
  };

  // Start editing
  const startEdit = (job: CronJob) => {
    setFormData({
      name: job.name,
      schedule: job.schedule,
      prompt: job.prompt || '',
      agent: job.agent || '',
      enabled: job.enabled
    });
    setEditingJob(job);
    setShowCreateForm(true);
  };

  // Cancel editing
  const cancelEdit = () => {
    setFormData({
      name: '',
      schedule: '0 9 * * *',
      prompt: '',
      agent: '',
      enabled: true
    });
    setEditingJob(null);
    setShowCreateForm(false);
    setFormErrors({});
  };

  // Format next run time
  const formatNextRun = (nextRun: string | null | undefined) => {
    if (!nextRun) return 'Not scheduled';
    const date = new Date(nextRun);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMs < 0) return 'Overdue';
    if (diffMins < 60) return `in ${diffMins}m`;
    if (diffHours < 24) return `in ${diffHours}h`;
    return `in ${diffDays}d`;
  };

  // Get status icon
  const getStatusIcon = (status: string, enabled: boolean) => {
    if (!enabled) return <Pause size={14} className="text-dim" />;

    switch (status) {
      case 'completed':
      case 'done':
        return <CheckCircle size={14} className="text-green" />;
      case 'failed':
      case 'error':
        return <XCircle size={14} className="text-red" />;
      case 'running':
      case 'in_progress':
        return <RefreshCw size={14} className="text-blue animate-spin" />;
      default:
        return <AlertCircle size={14} className="text-amber" />;
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  return (
    <div className="max-w-6xl space-y-5">
      <div>
        <h1 className="text-lg font-bold text-text flex items-center gap-2">
          <Clock size={18} className="text-amber" />Cron Jobs
        </h1>
        <p className="text-dim text-xs mt-0.5">Scheduled tasks and automation</p>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-amber text-bg px-4 py-2 rounded text-sm font-bold flex items-center gap-2 hover:opacity-90"
        >
          <Plus size={14} />
          Create Job
        </button>

        <button
          onClick={loadJobs}
          disabled={loading}
          className="text-dim hover:text-text transition-colors"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Create/Edit Form */}
      {showCreateForm && (
        <div className="bg-surface border border-border rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-text font-medium">
              {editingJob ? 'Edit Job' : 'Create New Job'}
            </h2>
            <button
              onClick={cancelEdit}
              className="text-dim hover:text-text transition-colors"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-dim mb-2">Job Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Daily health check"
                className="w-full bg-raised border border-border rounded px-3 py-2 text-sm text-text placeholder:text-faint focus:outline-none focus:border-border2"
              />
              {formErrors.name && (
                <div className="text-red text-xs mt-1">{formErrors.name}</div>
              )}
            </div>

            <div>
              <label className="block text-xs text-dim mb-2">Target Agent</label>
              <select
                value={formData.agent}
                onChange={(e) => setFormData(prev => ({ ...prev, agent: e.target.value }))}
                className="w-full bg-raised border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-border2"
              >
                {agents.map(agent => (
                  <option key={agent.id} value={agent.id}>
                    {agent.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-dim mb-2">Schedule</label>
              <select
                value={schedulePresets.find(p => p.value === formData.schedule)?.value || 'custom'}
                onChange={(e) => {
                  if (e.target.value !== 'custom') {
                    setFormData(prev => ({ ...prev, schedule: e.target.value }));
                  }
                }}
                className="w-full bg-raised border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-border2"
              >
                {schedulePresets.map(preset => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-dim mb-2">Cron Expression</label>
              <input
                type="text"
                value={formData.schedule}
                onChange={(e) => setFormData(prev => ({ ...prev, schedule: e.target.value }))}
                placeholder="0 9 * * *"
                className="w-full bg-raised border border-border rounded px-3 py-2 text-sm font-mono text-text placeholder:text-faint focus:outline-none focus:border-border2"
              />
              {formErrors.schedule && (
                <div className="text-red text-xs mt-1">{formErrors.schedule}</div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs text-dim mb-2">Prompt/Command</label>
            <textarea
              value={formData.prompt}
              onChange={(e) => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
              placeholder="Enter the task description or command to execute..."
              rows={3}
              className="w-full bg-raised border border-border rounded px-3 py-2 text-sm text-text placeholder:text-faint focus:outline-none focus:border-border2 resize-none"
            />
            {formErrors.prompt && (
              <div className="text-red text-xs mt-1">{formErrors.prompt}</div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
              className="w-4 h-4"
            />
            <label htmlFor="enabled" className="text-sm text-text">
              Enable job immediately
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={saveJob}
              className="bg-amber text-bg px-4 py-2 rounded text-sm font-bold"
            >
              {editingJob ? 'Update Job' : 'Create Job'}
            </button>
            <button
              onClick={cancelEdit}
              className="bg-raised border border-border text-text px-4 py-2 rounded text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Jobs List */}
      <div className="bg-surface border border-border rounded-lg">
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-amber" />
            <span className="text-text text-sm font-medium">Scheduled Jobs</span>
            <span className="text-faint text-xs">({jobs.length})</span>
          </div>
        </div>

        <div className="divide-y divide-border">
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw size={16} className="animate-spin text-dim mx-auto mb-2" />
              <div className="text-dim text-sm">Loading jobs...</div>
            </div>
          ) : jobs.length === 0 ? (
            <div className="p-8 text-center">
              <Clock size={24} className="text-dim mx-auto mb-2" />
              <div className="text-dim text-sm">No cron jobs configured</div>
              <button
                onClick={() => setShowCreateForm(true)}
                className="text-amber text-xs hover:underline mt-2"
              >
                Create your first job
              </button>
            </div>
          ) : (
            jobs.map((job) => (
              <div key={job.id} className="p-4 hover:bg-raised transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      {getStatusIcon(job.lastStatus, job.enabled)}
                      <h3 className="text-text font-medium text-sm truncate">
                        {job.name}
                      </h3>
                      {!job.enabled && (
                        <span className="text-xs bg-dim text-white px-2 py-0.5 rounded">
                          Disabled
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-4 text-xs">
                      <div>
                        <div className="text-faint">Schedule</div>
                        <div className="text-text font-mono">{job.schedule}</div>
                      </div>
                      <div>
                        <div className="text-faint">Next Run</div>
                        <div className="text-text">{formatNextRun(job.nextRun)}</div>
                      </div>
                      <div>
                        <div className="text-faint">Agent</div>
                        <div className="text-text">{job.agent || 'System'}</div>
                      </div>
                      <div>
                        <div className="text-faint">Last Status</div>
                        <div className={`font-medium ${
                          job.lastStatus === 'completed' ? 'text-green' :
                          job.lastStatus === 'failed' ? 'text-red' :
                          job.lastStatus === 'running' ? 'text-blue' : 'text-amber'
                        }`}>
                          {job.lastStatus}
                        </div>
                      </div>
                    </div>

                    {job.prompt && (
                      <div className="mt-3 text-xs text-dim bg-raised border border-border rounded p-2">
                        {job.prompt.length > 100 ? `${job.prompt.slice(0, 100)}...` : job.prompt}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => runJobNow(job.id)}
                      className="text-green hover:bg-green hover:text-white p-2 rounded transition-colors"
                      title="Run now"
                    >
                      <Play size={14} />
                    </button>
                    <button
                      onClick={() => toggleJob(job.id)}
                      className={`p-2 rounded transition-colors ${
                        job.enabled
                          ? 'text-amber hover:bg-amber hover:text-bg'
                          : 'text-dim hover:bg-dim hover:text-white'
                      }`}
                      title={job.enabled ? 'Disable' : 'Enable'}
                    >
                      {job.enabled ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    <button
                      onClick={() => startEdit(job)}
                      className="text-blue hover:bg-blue hover:text-white p-2 rounded transition-colors"
                      title="Edit"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => deleteJob(job.id)}
                      className="text-red hover:bg-red hover:text-white p-2 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}