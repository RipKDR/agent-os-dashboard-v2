import { useEffect, useRef, useState } from 'react';
import { Send, Loader2, Terminal, Copy, ChevronDown, History, Zap, Wifi } from 'lucide-react';
import { api, AgentStats, Task } from '../lib/api';

interface Agent {
  id: string;
  emoji: string;
  name: string;
  role: string;
  desc: string;
  quickCommands: string[];
}

const AGENTS: Agent[] = [
  {
    id: 'alex',
    emoji: '🔎',
    name: 'Alex',
    role: 'Research',
    desc: 'Product research, requirements, MVP scope, competitors',
    quickCommands: ['Research competitive landscape', 'Analyze market requirements', 'Define MVP scope']
  },
  {
    id: 'maya',
    emoji: '✍️',
    name: 'Maya',
    role: 'UX/UI',
    desc: 'Flows, screens, microcopy, accessibility',
    quickCommands: ['Design user flow', 'Review accessibility', 'Create wireframes']
  },
  {
    id: 'jordan',
    emoji: '📐',
    name: 'Jordan',
    role: 'Architect',
    desc: 'Architecture, database, auth/RLS, APIs, security',
    quickCommands: ['Design system architecture', 'Review security', 'Plan database schema']
  },
  {
    id: 'dev',
    emoji: '🛠️',
    name: 'Dev',
    role: 'Code',
    desc: 'Implementation, Next.js, Supabase, Expo',
    quickCommands: ['Implement feature', 'Fix bug', 'Review code']
  },
  {
    id: 'sam',
    emoji: '🚦',
    name: 'Sam',
    role: 'QA',
    desc: 'Testing, release, analytics, monitoring, rollback',
    quickCommands: ['Test feature', 'Check health', 'Monitor performance']
  },
];

interface Message {
  role: 'user' | 'system' | 'error';
  text: string;
  agent?: string;
  ts: number;
  responseTime?: number;
}

export default function Dispatch() {
  const [selected, setSelected] = useState<string>('dev');
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [stats, setStats] = useState<AgentStats>({});
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showCommands, setShowCommands] = useState<string | null>(null);
  const [commandHistory, setCommandHistory] = useState<Record<string, string[]>>({});
  const [streamingEnabled, setStreamingEnabled] = useState(false);
  const [streamingOutput, setStreamingOutput] = useState<string>('');
  const [currentStreamTask, setCurrentStreamTask] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.agentStats().then(setStats).catch(() => {});
    api.tasks.list().then(ts => setRecentTasks([...ts].reverse().slice(0, 10))).catch(() => {});
  }, []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, sending]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        send();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [input, sending]);

  // SSE listeners for streaming
  useEffect(() => {
    if (!streamingEnabled) return;

    const eventSource = new EventSource('/api/events');

    eventSource.addEventListener('agent-token', (e) => {
      const data = JSON.parse(e.data);
      if (data.task === currentStreamTask) {
        setStreamingOutput(prev => prev + data.token);
      }
    });

    eventSource.addEventListener('agent-complete', (e) => {
      const data = JSON.parse(e.data);
      if (data.task === currentStreamTask) {
        setMessages(prev => [...prev, {
          role: 'system',
          text: `✓ Completed → ${data.result}`,
          agent: data.agent,
          ts: Date.now(),
        }]);
        setCurrentStreamTask(null);
        setStreamingOutput('');
        setSending(false);
      }
    });

    eventSource.addEventListener('agent-error', (e) => {
      const data = JSON.parse(e.data);
      if (data.task === currentStreamTask) {
        setMessages(prev => [...prev, {
          role: 'error',
          text: `✗ Error → ${data.error}`,
          agent: data.agent,
          ts: Date.now(),
        }]);
        setCurrentStreamTask(null);
        setStreamingOutput('');
        setSending(false);
      }
    });

    return () => eventSource.close();
  }, [streamingEnabled, currentStreamTask]);

  async function send(quickCommand?: string) {
    const msg = (quickCommand || input).trim();
    if (!msg || sending) return;

    const startTime = Date.now();
    setInput('');
    setShowCommands(null);

    // Add to command history
    setCommandHistory(prev => ({
      ...prev,
      [selected]: [...(prev[selected] || []), msg].slice(-10) // Keep last 10 commands
    }));

    setMessages(prev => [...prev, { role: 'user', text: msg, ts: Date.now() }]);
    setSending(true);

    try {
      if (streamingEnabled) {
        // Use streaming dispatch
        const res = await api.dispatchStream(selected, msg);
        const taskTitle = res.task?.title || msg;

        setCurrentStreamTask(res.task.id);
        setStreamingOutput('');

        setMessages(prev => [...prev, {
          role: 'system',
          text: `🔄 Streaming → ${taskTitle}`,
          agent: selected,
          ts: Date.now(),
        }]);

        // SSE events will handle the streaming updates
      } else {
        // Use regular dispatch
        const res = await api.dispatch(selected, msg);
        const responseTime = Date.now() - startTime;
        const taskTitle = res.task?.title || msg;

        setMessages(prev => [...prev, {
          role: 'system',
          text: `✓ Dispatched → ${taskTitle}`,
          agent: selected,
          ts: Date.now(),
          responseTime
        }]);
      }

      const [newStats, newTasks] = await Promise.all([
        api.agentStats().catch(() => stats),
        api.tasks.list().catch(() => recentTasks),
      ]);
      setStats(newStats);
      setRecentTasks([...newTasks].reverse().slice(0, 10));
    } catch (err) {
      const responseTime = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : 'Dispatch failed';
      setMessages(prev => [...prev, {
        role: 'error',
        text: `✗ Error: ${errorMsg}`,
        agent: selected,
        ts: Date.now(),
        responseTime
      }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function copyMessage(text: string) {
    navigator.clipboard.writeText(text);
    // Could add a toast notification here
  }

  const selectedAgent = AGENTS.find(a => a.id === selected)!;
  const agentHistory = commandHistory[selected] || [];

  return (
    <div className="max-w-5xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text flex items-center gap-2">
            <Terminal size={18} className="text-amber" />Agent Dispatch
          </h1>
          <p className="text-dim text-xs mt-0.5">Select an agent and send a command • ⌘⏎ to send</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setStreamingEnabled(!streamingEnabled)}
            className={[
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              streamingEnabled
                ? 'bg-blue text-white'
                : 'bg-raised border border-border text-text hover:bg-border'
            ].join(' ')}
            title={streamingEnabled ? 'Disable real-time streaming' : 'Enable real-time streaming'}
          >
            {streamingEnabled ? <Zap size={14} /> : <Wifi size={14} />}
            {streamingEnabled ? 'Streaming' : 'Regular'}
          </button>
        </div>
      </div>

      {/* Agent selector */}
      <div className="grid grid-cols-5 gap-2">
        {AGENTS.map(a => {
          const s = stats[a.id] || { total: 0, completed: 0, failed: 0, running: 0 };
          const active = selected === a.id;
          const isBusy = s.running > 0;
          const status = isBusy ? 'busy' : 'online';

          return (
            <div key={a.id} className="relative">
              <button
                onClick={() => setSelected(a.id)}
                className={[
                  'w-full p-3 rounded-lg border text-left transition-all',
                  active
                    ? 'bg-a-soft border-amber shadow-[0_0_0_1px_var(--color-amber)]'
                    : 'bg-surface border-border hover:border-border2',
                  isBusy ? 'animate-pulse' : ''
                ].join(' ')}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-2xl">{a.emoji}</div>
                  <div className={`w-2 h-2 rounded-full ${isBusy ? 'bg-blue' : 'bg-green'}`} />
                </div>
                <div className="text-xs font-bold text-text">{a.name}</div>
                <div className="text-[10px] text-dim">{a.role} • {status}</div>
                <div className="mt-2 space-y-0.5 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-faint">✓</span>
                    <span className="text-green font-bold">{s.completed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-faint">✗</span>
                    <span className="text-red font-bold">{s.failed}</span>
                  </div>
                  {s.running > 0 && (
                    <div className="flex justify-between">
                      <span className="text-faint">▶</span>
                      <span className="text-blue font-bold">{s.running}</span>
                    </div>
                  )}
                </div>
              </button>

              {/* Quick Commands */}
              <button
                onClick={() => setShowCommands(showCommands === a.id ? null : a.id)}
                className="absolute top-2 right-2 w-5 h-5 bg-raised border border-border rounded flex items-center justify-center hover:bg-border transition-colors"
                title="Quick commands"
              >
                <ChevronDown size={10} className={`transition-transform ${showCommands === a.id ? 'rotate-180' : ''}`} />
              </button>

              {showCommands === a.id && (
                <div className="absolute top-12 right-0 bg-surface border border-border rounded-lg shadow-lg z-10 min-w-48">
                  <div className="p-2 border-b border-border text-xs text-dim font-bold">Quick Commands</div>
                  {a.quickCommands.map((cmd, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setSelected(a.id);
                        setInput(cmd);
                        setShowCommands(null);
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-text hover:bg-raised transition-colors"
                    >
                      {cmd}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Chat panel */}
        <div className="col-span-2 bg-surface border border-border rounded-lg flex flex-col" style={{ height: '400px' }}>
          <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 text-xs text-dim">
            <span className="text-lg">{selectedAgent.emoji}</span>
            <span className="font-bold text-text">{selectedAgent.name}</span>
            <span>·</span>
            <span>{selectedAgent.desc}</span>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="ml-auto flex items-center gap-1 text-faint hover:text-text transition-colors"
              title="Command history"
            >
              <History size={12} />
            </button>
          </div>

          <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center pt-10">
                <div className="text-faint text-xs mb-4">
                  Send a message to {selectedAgent.name}
                </div>
                <div className="text-center">
                  <div className="text-faint text-[11px] mb-2">Try these commands:</div>
                  {selectedAgent.quickCommands.slice(0, 2).map((cmd, i) => (
                    <button
                      key={i}
                      onClick={() => send(cmd)}
                      className="block mx-auto mb-1 text-[10px] text-blue hover:text-text transition-colors"
                    >
                      "{cmd}"
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={[
                  'max-w-[80%] rounded-lg px-3 py-2 text-sm relative group',
                  m.role === 'user'
                    ? 'bg-blue text-white'
                    : m.role === 'error'
                    ? 'bg-raised border border-red text-red'
                    : 'bg-raised border border-border text-text',
                ].join(' ')}>
                  {m.role !== 'user' && m.agent && (
                    <div className="text-[10px] text-dim mb-0.5 flex items-center gap-1">
                      {AGENTS.find(a => a.id === m.agent)?.emoji} {m.agent}
                      {m.responseTime && <span>• {m.responseTime}ms</span>}
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <span className="flex-1">{m.text}</span>
                    {m.role !== 'user' && (
                      <button
                        onClick={() => copyMessage(m.text)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-border rounded"
                        title="Copy"
                      >
                        <Copy size={10} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="bg-raised border border-border rounded-lg px-3 py-2 text-sm text-dim flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin" />
                  dispatching to {selectedAgent.name}...
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border p-3 flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.metaKey && !e.ctrlKey && send()}
              placeholder={`Message ${selectedAgent.name}... (⌘⏎ to send)`}
              className="flex-1 bg-raised border border-border rounded px-3 py-2 text-sm text-text placeholder:text-faint focus:outline-none focus:border-border2"
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || sending}
              className="bg-amber text-bg px-4 py-2 rounded text-sm font-bold flex items-center gap-1.5 disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              <Send size={13} />Send
            </button>
          </div>
        </div>

        {/* History sidebar */}
        <div className="space-y-4">
          {showHistory && agentHistory.length > 0 && (
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="text-xs uppercase tracking-wider text-dim mb-3">Command History</div>
              <div className="space-y-1">
                {agentHistory.slice(-5).reverse().map((cmd, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(cmd)}
                    className="w-full text-left p-2 text-xs text-text bg-raised hover:bg-border rounded transition-colors truncate"
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recent tasks */}
          {recentTasks.length > 0 && (
            <div className="bg-surface border border-border rounded-lg p-4">
              <div className="text-xs uppercase tracking-wider text-dim mb-3">Recent Tasks</div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {recentTasks.map(t => (
                  <div key={t.id} className="p-2 bg-raised border border-border rounded text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        t.status === 'done' ? 'bg-green' :
                        t.status === 'failed' ? 'bg-red' :
                        t.status === 'in_progress' ? 'bg-blue' :
                        'bg-amber'
                      }`} />
                      <span className="text-faint text-[10px]">{t.status}</span>
                      {t.agent && (
                        <span className="text-faint text-[10px] ml-auto">{t.agent}</span>
                      )}
                    </div>
                    <div className="text-text truncate">{t.title}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
