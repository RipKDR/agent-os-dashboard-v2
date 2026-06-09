import { useState, useEffect, useRef } from 'react';
import { Activity, Pause, Play, Volume2, VolumeX, Filter, RefreshCw } from 'lucide-react';
import { AgentActivity } from '../lib/api';

interface Agent {
  id: string;
  name: string;
  emoji: string;
  role: string;
}

const AGENTS: Agent[] = [
  { id: 'alex', name: 'Alex', emoji: '🔎', role: 'Research' },
  { id: 'maya', name: 'Maya', emoji: '✍️', role: 'UX/UI' },
  { id: 'jordan', name: 'Jordan', emoji: '📐', role: 'Architect' },
  { id: 'dev', name: 'Dev', emoji: '🛠️', role: 'Code' },
  { id: 'sam', name: 'Sam', emoji: '🚦', role: 'QA' },
];

interface ActivityLog extends AgentActivity {
  id: string;
  expanded?: boolean;
}

export default function Stream() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [paused, setPaused] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const activitiesRef = useRef<HTMLDivElement>(null);
  const audioContext = useRef<AudioContext | null>(null);

  // Initialize audio context
  const initAudio = () => {
    if (!audioContext.current && soundEnabled) {
      audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  };

  // Play notification sound
  const playSound = (type: 'complete' | 'error' | 'start') => {
    if (!soundEnabled || !audioContext.current) return;

    const oscillator = audioContext.current.createOscillator();
    const gainNode = audioContext.current.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.current.destination);

    // Different frequencies for different events
    const frequencies = {
      complete: 800, // Higher pitch for completion
      error: 300,    // Lower pitch for error
      start: 500     // Medium pitch for start
    };

    oscillator.frequency.setValueAtTime(frequencies[type], audioContext.current.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioContext.current.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.current.currentTime + 0.2);

    oscillator.start();
    oscillator.stop(audioContext.current.currentTime + 0.2);
  };

  // Add new activity
  const addActivity = (activity: AgentActivity) => {
    if (paused) return;

    const newActivity: ActivityLog = {
      ...activity,
      id: `${activity.agent}-${activity.task}-${Date.now()}`,
      expanded: false
    };

    setActivities(prev => [newActivity, ...prev].slice(0, 100)); // Keep last 100

    // Play sound notification
    if (activity.status === 'done') {
      playSound('complete');
    } else if (activity.status === 'failed') {
      playSound('error');
    } else if (activity.status === 'running') {
      playSound('start');
    }
  };

  // Toggle activity expansion
  const toggleExpanded = (id: string) => {
    setActivities(prev => prev.map(activity =>
      activity.id === id ? { ...activity, expanded: !activity.expanded } : activity
    ));
  };

  // Clear all activities
  const clearActivities = () => {
    setActivities([]);
  };

  // Get filtered activities
  const filteredActivities = activities.filter(activity => {
    if (selectedAgent !== 'all' && activity.agent !== selectedAgent) return false;
    if (selectedStatus !== 'all' && activity.status !== selectedStatus) return false;
    return true;
  });

  // Get agent info
  const getAgent = (id: string) => AGENTS.find(a => a.id === id) || { id, name: id, emoji: '🤖', role: 'Unknown' };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'text-blue';
      case 'done': return 'text-green';
      case 'failed': return 'text-red';
      case 'idle': return 'text-dim';
      default: return 'text-amber';
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <RefreshCw size={12} className="animate-spin" />;
      case 'done': return <span className="w-3 h-3 rounded-full bg-green"></span>;
      case 'failed': return <span className="w-3 h-3 rounded-full bg-red"></span>;
      case 'idle': return <span className="w-3 h-3 rounded-full bg-dim"></span>;
      default: return <span className="w-3 h-3 rounded-full bg-amber"></span>;
    }
  };

  // Format timestamp
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  // Auto-scroll to top when new activities arrive
  useEffect(() => {
    if (autoScroll && activitiesRef.current && activities.length > 0) {
      activitiesRef.current.scrollTop = 0;
    }
  }, [activities.length, autoScroll]);

  // Initialize audio on sound enable
  useEffect(() => {
    if (soundEnabled) {
      initAudio();
    }
  }, [soundEnabled]);

  useEffect(() => {
    const es = new EventSource('/api/events');
    es.addEventListener('agent-activity', (e) => {
      if (paused) return;
      try { addActivity(JSON.parse(e.data) as AgentActivity); } catch { /* ignore */ }
    });
    es.addEventListener('notification', (e) => {
      if (paused) return;
      try {
        const n = JSON.parse(e.data);
        addActivity({
          agent: n.source || 'system',
          status: n.type === 'error' ? 'failed' : n.type === 'success' ? 'done' : 'running',
          task: n.message,
          output: n.message,
          timestamp: n.created_at || new Date().toISOString(),
        });
      } catch { /* ignore */ }
    });
    return () => es.close();
  }, [paused, addActivity]);

  return (
    <div className="max-w-6xl space-y-5">
      <div>
        <h1 className="text-lg font-bold text-text flex items-center gap-2">
          <Activity size={18} className="text-amber" />Multi-Agent Stream
        </h1>
        <p className="text-dim text-xs mt-0.5">Real-time agent activity monitoring</p>
      </div>

      {/* Controls */}
      <div className="bg-surface border border-border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Pause/Play */}
            <button
              onClick={() => setPaused(!paused)}
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${
                paused
                  ? 'bg-green text-white'
                  : 'bg-amber text-bg'
              }`}
            >
              {paused ? <Play size={14} /> : <Pause size={14} />}
              {paused ? 'Resume' : 'Pause'}
            </button>

            {/* Sound Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${
                soundEnabled
                  ? 'bg-blue text-white'
                  : 'bg-raised border border-border text-dim'
              }`}
              title={soundEnabled ? 'Disable sound' : 'Enable sound'}
            >
              {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>

            {/* Auto-scroll Toggle */}
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`px-3 py-2 rounded text-sm transition-colors ${
                autoScroll
                  ? 'bg-blue text-white'
                  : 'bg-raised border border-border text-dim'
              }`}
            >
              Auto-scroll
            </button>
          </div>

          <div className="flex items-center gap-4">
            {/* Filters */}
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-dim" />
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="bg-raised border border-border rounded px-2 py-1 text-xs text-text"
              >
                <option value="all">All Agents</option>
                {AGENTS.map(agent => (
                  <option key={agent.id} value={agent.id}>
                    {agent.emoji} {agent.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-raised border border-border rounded px-2 py-1 text-xs text-text"
              >
                <option value="all">All Status</option>
                <option value="running">Running</option>
                <option value="done">Done</option>
                <option value="failed">Failed</option>
                <option value="idle">Idle</option>
              </select>
            </div>

            {/* Clear */}
            <button
              onClick={clearActivities}
              className="text-red hover:bg-red hover:text-white px-3 py-2 rounded text-sm transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Agent Status Row */}
      <div className="grid grid-cols-5 gap-4">
        {AGENTS.map(agent => {
          const recentActivity = filteredActivities.find(a => a.agent === agent.id);
          const status = recentActivity?.status || 'idle';

          return (
            <div
              key={agent.id}
              className={`bg-surface border border-border rounded-lg p-4 transition-all ${
                selectedAgent === agent.id ? 'ring-2 ring-amber' : ''
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{agent.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text truncate">{agent.name}</div>
                  <div className="text-xs text-dim truncate">{agent.role}</div>
                </div>
                {getStatusIcon(status)}
              </div>

              <div className={`text-xs font-medium ${getStatusColor(status)}`}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </div>

              {recentActivity && (
                <div className="mt-2 text-xs text-dim truncate">
                  {recentActivity.task}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Activity Stream */}
      <div className="bg-surface border border-border rounded-lg">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-amber" />
            <span className="text-text text-sm font-medium">Activity Stream</span>
            <span className="text-faint text-xs">({filteredActivities.length})</span>
          </div>
          {paused && (
            <span className="text-amber text-xs font-medium">⏸ PAUSED</span>
          )}
        </div>

        <div
          ref={activitiesRef}
          className="max-h-96 overflow-y-auto divide-y divide-border"
        >
          {filteredActivities.length === 0 ? (
            <div className="p-8 text-center">
              <Activity size={24} className="text-dim mx-auto mb-2" />
              <div className="text-dim text-sm">
                {paused ? 'Activity stream paused' : 'No recent activity'}
              </div>
            </div>
          ) : (
            filteredActivities.map(activity => {
              const agent = getAgent(activity.agent);

              return (
                <div key={activity.id} className="p-4 hover:bg-raised transition-colors">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">{agent.emoji}</span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusIcon(activity.status)}
                        <span className="text-sm font-medium text-text">
                          {agent.name}
                        </span>
                        <span className={`text-xs font-medium ${getStatusColor(activity.status)}`}>
                          {activity.status}
                        </span>
                        <span className="text-xs text-faint">
                          {formatTime(activity.timestamp)}
                        </span>
                      </div>

                      <div className="text-xs text-dim mb-2">
                        Task: {activity.task}
                      </div>

                      {activity.output && (
                        <div className="text-xs">
                          {activity.expanded ? (
                            <pre className="text-text whitespace-pre-wrap bg-raised border border-border rounded p-2">
                              {activity.output}
                            </pre>
                          ) : (
                            <div className="text-text">
                              {activity.output.length > 100 ?
                                `${activity.output.slice(0, 100)}...` :
                                activity.output}
                            </div>
                          )}
                          {activity.output.length > 100 && (
                            <button
                              onClick={() => toggleExpanded(activity.id)}
                              className="text-amber text-xs mt-1 hover:underline"
                            >
                              {activity.expanded ? 'Show less' : 'Show more'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}