import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Server, Clock, Cpu, RefreshCw, ExternalLink } from 'lucide-react';

function fmtUptime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

const LINKS = [
  { label: '/api/status',       href: '/api/status' },
  { label: '/api/tasks',        href: '/api/tasks' },
  { label: '/api/agent-stats',  href: '/api/agent-stats' },
  { label: '/api/system/resources', href: '/api/system/resources' },
];

export default function Settings() {
  const [status, setStatus] = useState<{ ok: boolean; uptime: number; memory: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.status()
      .then(setStatus)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-bold text-text">Settings</h1>
        <p className="text-dim text-xs mt-0.5">Server status and configuration</p>
      </div>

      {/* Server status */}
      <div className="bg-surface border border-border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-text uppercase tracking-wider flex items-center gap-1.5">
            <Server size={13} />Server Status
          </div>
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-[10px] text-dim hover:text-text transition-colors"
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />Refresh
          </button>
        </div>

        {loading ? (
          <div className="h-20 bg-raised rounded animate-pulse" />
        ) : status ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${status.ok ? 'bg-green' : 'bg-red'}`} />
              <span className={`text-sm font-bold ${status.ok ? 'text-green' : 'text-red'}`}>
                {status.ok ? 'Online' : 'Degraded'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-raised border border-border rounded p-3">
                <div className="text-[10px] text-dim flex items-center gap-1 mb-1">
                  <Clock size={11} />Uptime
                </div>
                <div className="text-xl font-bold text-text">{fmtUptime(status.uptime)}</div>
              </div>
              <div className="bg-raised border border-border rounded p-3">
                <div className="text-[10px] text-dim flex items-center gap-1 mb-1">
                  <Cpu size={11} />Memory
                </div>
                <div className="text-xl font-bold text-text">
                  {(status.memory / 1024 / 1024).toFixed(1)} MB
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-dim text-sm">Failed to load server status</div>
        )}
      </div>

      {/* Quick links */}
      <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
        <div className="text-xs font-bold text-text uppercase tracking-wider">API Endpoints</div>
        <div className="space-y-1.5">
          {LINKS.map(({ label, href }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between bg-raised border border-border rounded px-3 py-2 text-xs text-dim hover:text-text hover:border-border2 transition-colors"
            >
              <span>{label}</span>
              <ExternalLink size={11} />
            </a>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
        <div className="text-xs font-bold text-text uppercase tracking-wider">Actions</div>
        <button
          onClick={() => window.location.reload()}
          className="bg-amber text-bg px-4 py-2 rounded text-xs font-bold hover:opacity-90 transition-opacity flex items-center gap-1.5"
        >
          <RefreshCw size={12} />Reload Dashboard
        </button>
      </div>
    </div>
  );
}
