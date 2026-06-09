import { useState, useEffect } from 'react';
import { api, AgentLog } from '../lib/api';
import { ScrollText } from 'lucide-react';

const STATUS_STYLE: Record<string, string> = {
  completed: 'text-green border-green bg-g-soft',
  failed:    'text-red border-red',
  running:   'text-blue border-blue',
};

const AGENT_EMOJI: Record<string, string> = {
  alex: '🔎', maya: '✍️', jordan: '📐', dev: '🛠️', sam: '🚦',
};

function groupByDate(logs: AgentLog[]): [string, AgentLog[]][] {
  const map: Record<string, AgentLog[]> = {};
  for (const log of logs) {
    const key = new Date(log.created_at).toLocaleDateString();
    if (!map[key]) map[key] = [];
    map[key].push(log);
  }
  return Object.entries(map).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
}

export default function Logs() {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.agentLogs(100)
      .then(setLogs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const groups = groupByDate(logs);

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-text">Agent Logs</h1>
        <p className="text-dim text-xs mt-0.5">{logs.length} entries</p>
      </div>

      {loading ? (
        <div className="space-y-1.5">
          {[...Array(8)].map((_, i) => <div key={i} className="h-14 bg-surface rounded animate-pulse" />)}
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-20">
          <ScrollText size={32} className="mx-auto mb-2 text-faint" />
          <div className="text-dim text-sm">No logs yet</div>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([date, entries]) => (
            <div key={date}>
              <div className="text-[10px] text-faint uppercase tracking-widest mb-2 pl-1">{date}</div>
              <div className="space-y-1.5">
                {entries.map((log, i) => (
                  <div key={i} className="flex items-start gap-3 bg-surface border border-border rounded-lg px-4 py-3 hover:border-border2 transition-colors">
                    <div className="text-lg shrink-0">
                      {AGENT_EMOJI[log.agent_name?.toLowerCase()] || '🤖'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-xs font-bold text-text capitalize">{log.agent_name}</span>
                        <span className={`text-[10px] border rounded px-1.5 py-0 ${STATUS_STYLE[log.status] || 'text-dim border-border'}`}>
                          {log.status}
                        </span>
                        {log.model_used && (
                          <span className="text-[10px] text-faint">{log.model_used.split('/').pop()}</span>
                        )}
                        <span className="text-[10px] text-faint ml-auto">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-xs text-dim truncate">{log.task_description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
