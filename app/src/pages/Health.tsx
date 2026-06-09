import { useState, useEffect, useRef } from 'react';
import { api, SystemResources, SystemError, Task } from '../lib/api';
import { Cpu, MemoryStick, HardDrive, Clock, AlertTriangle, CheckCircle, RefreshCw, Wifi, Monitor, TrendingUp } from 'lucide-react';

function fmtBytes(b: number) {
  if (b > 1e9) return (b / 1e9).toFixed(1) + ' GB';
  return (b / 1e6).toFixed(0) + ' MB';
}

function fmtUptime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${m}m`;
}

interface HistoricalData {
  timestamp: number;
  ramPct: number;
  loadAvg: number;
}

export default function Health() {
  const [sys, setSys] = useState<SystemResources | null>(null);
  const [errs, setErrs] = useState<SystemError[]>([]);
  const [taskFails, setTaskFails] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
  const intervalRef = useRef<number | null>(null);

  const loadData = async () => {
    try {
      const [s, e] = await Promise.all([
        api.system.resources().catch(() => null),
        api.system.errors().catch(() => null),
      ]);

      if (s) {
        setSys(s);
        // Add to historical data
        const ramPct = parseInt(s.memory.pct);
        setHistoricalData(prev => [
          ...prev.slice(-9), // Keep last 9 data points + new one = 10 total
          {
            timestamp: Date.now(),
            ramPct,
            loadAvg: s.loadAvg[0] || 0
          }
        ]);
      }
      if (e) {
        setErrs(e.errors);
        setTaskFails(e.recentTaskFailures);
      }
      setLastChecked(new Date());
    } catch (err) {
      console.error('Failed to load system data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(loadData, 10000); // 10 seconds
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh]);

  const ramPct = sys ? parseInt(sys.memory.pct) : 0;
  const diskPct = sys?.disk ? Math.round((sys.disk.used / sys.disk.total) * 100) : 0;
  const hasErrors = errs.length > 0 || taskFails.length > 0;
  const systemHealthColor = hasErrors ? 'text-red' : ramPct > 80 || diskPct > 80 ? 'text-amber' : 'text-green';
  const systemHealthText = hasErrors ? 'Issues Detected' : ramPct > 80 || diskPct > 80 ? 'Warning' : 'Healthy';

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text flex items-center gap-2">
            <Monitor size={18} className="text-amber" />
            System Health
          </h1>
          <div className="flex items-center gap-4 mt-0.5">
            <p className="text-dim text-xs">Resources and monitoring</p>
            <div className={`text-xs font-bold ${systemHealthColor}`}>
              {systemHealthText}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {lastChecked && (
            <span className="text-xs text-faint">
              Last checked: {lastChecked.toLocaleTimeString()}
            </span>
          )}
          <label className="flex items-center gap-2 text-xs text-dim cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              className="w-3 h-3 accent-amber"
            />
            Auto-refresh (10s)
          </label>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1 bg-surface border border-border px-3 py-2 rounded text-xs text-dim hover:text-text hover:border-border2 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* System overview */}
      <div className="grid grid-cols-2 gap-4">
        {/* Network info */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-xs uppercase tracking-wider text-dim mb-3 flex items-center gap-1">
            <Wifi size={12} />Network & Environment
          </div>
          {sys ? (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-dim">Hostname</span>
                <span className="text-text font-mono">{sys.hostname}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dim">Platform</span>
                <span className="text-text">{sys.platform}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dim">CPU Architecture</span>
                <span className="text-text">{sys.cpus} cores</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dim">Uptime</span>
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

        {/* Load trend */}
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-xs uppercase tracking-wider text-dim mb-3 flex items-center gap-1">
            <TrendingUp size={12} />Load Average Trend
          </div>
          {sys ? (
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-xs">
                <div>
                  <span className="text-dim">Current: </span>
                  <span className="text-text font-bold">{sys.loadAvg[0]?.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-dim">5min: </span>
                  <span className="text-text">{sys.loadAvg[1]?.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-dim">15min: </span>
                  <span className="text-text">{sys.loadAvg[2]?.toFixed(2)}</span>
                </div>
              </div>
              {historicalData.length > 1 && (
                <div className="flex items-end gap-1 h-12">
                  {historicalData.map((point) => {
                    const height = Math.min((point.loadAvg / sys.cpus) * 100, 100);
                    const color = height > 80 ? 'bg-red' : height > 60 ? 'bg-amber' : 'bg-green';
                    return (
                      <div
                        key={point.timestamp}
                        className={`flex-1 ${color} rounded-sm transition-all`}
                        style={{ height: `${Math.max(height, 5)}%` }}
                        title={`Load: ${point.loadAvg.toFixed(2)} (${new Date(point.timestamp).toLocaleTimeString()})`}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-4 bg-raised rounded animate-pulse" />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Resource grid */}
      <div className="grid grid-cols-4 gap-3">
        {loading ? (
          [...Array(4)].map((_, i) => <div key={i} className="h-32 bg-surface border border-border rounded-lg animate-pulse" />)
        ) : sys ? (
          <>
            <div className="bg-surface border border-border rounded-lg p-4 hover:border-border2 transition-colors">
              <div className="text-[10px] text-dim mb-2 flex items-center gap-1 uppercase tracking-wider">
                <Cpu size={12} />CPU Usage
              </div>
              <div className="text-3xl font-bold text-text">{sys.cpus}</div>
              <div className="text-xs text-dim">cores available</div>
              <div className="mt-3">
                <div className="text-[10px] text-dim mb-1">Load Average</div>
                <div className="text-sm font-bold text-text">{sys.loadAvg[0]?.toFixed(2)}</div>
              </div>
            </div>

            <div className="bg-surface border border-border rounded-lg p-4 hover:border-border2 transition-colors">
              <div className="text-[10px] text-dim mb-2 flex items-center gap-1 uppercase tracking-wider">
                <MemoryStick size={12} />Memory Usage
              </div>
              <div className="text-2xl font-bold text-text">{sys.memory.pct}</div>
              <div className="mt-2 h-2 bg-raised rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${ramPct > 80 ? 'bg-red' : ramPct > 60 ? 'bg-amber' : 'bg-green'}`}
                  style={{ width: sys.memory.pct }}
                />
              </div>
              <div className="text-[10px] text-faint mt-2">{fmtBytes(sys.memory.used)} / {fmtBytes(sys.memory.total)}</div>
              {/* Memory trend mini chart */}
              {historicalData.length > 1 && (
                <div className="flex items-end gap-px mt-2 h-4">
                  {historicalData.map((point) => (
                    <div
                      key={point.timestamp}
                      className="flex-1 bg-green opacity-60 rounded-sm"
                      style={{ height: `${(point.ramPct / 100) * 100}%` }}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="bg-surface border border-border rounded-lg p-4 hover:border-border2 transition-colors">
              <div className="text-[10px] text-dim mb-2 flex items-center gap-1 uppercase tracking-wider">
                <HardDrive size={12} />Disk Usage
              </div>
              {sys.disk ? (
                <>
                  <div className="text-2xl font-bold text-text">{diskPct}%</div>
                  <div className="mt-2 h-2 bg-raised rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${diskPct > 80 ? 'bg-red' : diskPct > 60 ? 'bg-amber' : 'bg-green'}`}
                      style={{ width: `${diskPct}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-faint mt-2">{fmtBytes(sys.disk.used)} / {fmtBytes(sys.disk.total)}</div>
                  <div className="text-[10px] text-faint">{fmtBytes(sys.disk.available)} available</div>
                </>
              ) : (
                <>
                  <div className="text-xl font-bold text-faint">N/A</div>
                  <div className="text-xs text-faint mt-2">Disk info unavailable</div>
                </>
              )}
            </div>

            <div className="bg-surface border border-border rounded-lg p-4 hover:border-border2 transition-colors">
              <div className="text-[10px] text-dim mb-2 flex items-center gap-1 uppercase tracking-wider">
                <Clock size={12} />System Status
              </div>
              <div className="text-xl font-bold text-text">{fmtUptime(sys.uptime)}</div>
              <div className="text-xs text-dim">uptime</div>
              <div className="mt-3">
                <div className={`text-xs font-bold ${systemHealthColor}`}>{systemHealthText}</div>
                <div className="text-[10px] text-faint">{hasErrors ? `${errs.length + taskFails.length} issues` : 'All systems operational'}</div>
              </div>
            </div>
          </>
        ) : (
          <div className="col-span-4 bg-surface border border-red rounded-lg p-8 text-center">
            <AlertTriangle size={24} className="mx-auto mb-2 text-red" />
            <div className="text-red text-sm">Failed to load system data</div>
            <button
              onClick={loadData}
              className="mt-3 text-xs text-blue hover:text-text transition-colors"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Error feed */}
      <div>
        <div className="text-xs uppercase tracking-wider text-dim mb-3 flex items-center gap-1.5">
          <AlertTriangle size={13} />Error & Issue Log
        </div>
        {loading ? (
          <div className="h-32 bg-surface border border-border rounded-lg animate-pulse" />
        ) : !hasErrors ? (
          <div className="bg-surface border border-green rounded-lg p-8 text-center">
            <CheckCircle size={32} className="mx-auto mb-3 text-green" />
            <div className="text-green text-lg font-bold mb-1">System Healthy</div>
            <div className="text-green text-sm">No recent errors or failed tasks detected</div>
            <div className="text-faint text-xs mt-2">
              {lastChecked ? `Last checked: ${lastChecked.toLocaleString()}` : 'Monitoring active'}
            </div>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {errs.map((e, i) => (
              <div key={i} className="bg-surface border border-red rounded-lg px-4 py-3 hover:bg-raised transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={12} className="text-red shrink-0" />
                  <span className="text-xs font-bold text-red uppercase">System Error</span>
                  <span className="text-xs text-dim capitalize">{e.agent}</span>
                  {e.model && <span className="text-[10px] text-faint">{e.model}</span>}
                  <span className="text-[10px] text-faint ml-auto">{new Date(e.ts).toLocaleString()}</span>
                </div>
                <div className="text-sm text-text">{e.task}</div>
              </div>
            ))}
            {taskFails.map(t => (
              <div key={t.id} className="bg-surface border border-red rounded-lg px-4 py-3 hover:bg-raised transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={12} className="text-red shrink-0" />
                  <span className="text-xs font-bold text-red uppercase">Task Failed</span>
                  {t.agent && <span className="text-xs text-dim capitalize">{t.agent}</span>}
                  <span className="text-[10px] text-faint ml-auto">{new Date(t.created_at).toLocaleString()}</span>
                </div>
                <div className="text-sm text-text">{t.title}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
