import { Menu } from "lucide-react";
import Skills from "./pages/Skills";
import { useState, useEffect, useCallback } from 'react';
import { api, Notification } from './lib/api';
import { Page } from './types';
import Sidebar from './components/Sidebar';
import CommandPalette from './components/CommandPalette';
import ToastContainer, { ToastItem } from './components/Toast';
import Dashboard from './pages/Dashboard';
import Dispatch from './pages/Dispatch';
import Tasks from './pages/Tasks';
import Projects from './pages/Projects';
import Goals from './pages/Goals';
import Captures from './pages/Captures';
import Logs from './pages/Logs';
import Health from './pages/Health';
import NotificationsPage from './pages/Notifications';
import Settings from './pages/Settings';
import Workspace from './pages/Workspace';
import Inbox from './pages/Inbox';
import Cron from './pages/Cron';
import Stream from './pages/Stream';

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [sseStatus, setSseStatus] = useState<'live' | 'reconnecting' | 'off'>('off');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => { try { return localStorage.getItem("sidebarCollapsed") === "true"; } catch { return false; } });

  const addToast = useCallback((message: string, type = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts(prev => [...prev, { id, message, type }].slice(-5));
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    api.notifications.list().then(setNotifs).catch(() => {});
  }, []);

  useEffect(() => {
    let es: EventSource | null = null;
    let backoff = 1000;
    const connect = () => {
      es?.close();
      es = new EventSource('/api/events');
      es.addEventListener('connected', () => { setSseStatus('live'); backoff = 1000; });
      es.addEventListener('notification', (e) => {
        try {
          const n = JSON.parse(e.data);
          setNotifs(prev => [n, ...prev].slice(0, 200));
          if (!n.read) addToast(n.message, n.type || 'info');
        } catch { /* ignore */ }
      });
      es.onerror = () => {
        setSseStatus('reconnecting');
        es?.close();
        backoff = Math.min(backoff * 1.5 + 500, 30000);
        setTimeout(connect, backoff);
      };
    };
    connect();
    return () => es?.close();
  }, []);

  const PAGE_ORDER: Page[] = ['dashboard', 'dispatch', 'workspace', 'inbox', 'stream', 'tasks', 'projects', 'goals', 'captures', 'cron', 'skills', 'logs', 'health', 'notifications', 'settings'];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        const n = parseInt(e.key);
        if (n >= 1 && n <= 9 && PAGE_ORDER[n - 1]) {
          e.preventDefault();
          setPage(PAGE_ORDER[n - 1]);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const clearNotifs = useCallback(() => {
    api.notifications.clear().then(() => setNotifs([])).catch(() => {});
  }, []);

  const markRead = useCallback((id: string) => {
    api.notifications.patch(id, { read: true }).then(() => {
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    }).catch(() => {});
  }, []);

  const unreadCount = notifs.filter(n => !n.read).length;

  const pages: Record<Page, React.ReactNode> = {
    dashboard: <Dashboard notifs={notifs} onClearNotifs={clearNotifs} />,
    dispatch: <Dispatch />,
    workspace: <Workspace />,
    inbox: <Inbox />,
    stream: <Stream />,
    tasks: <Tasks />,
    projects: <Projects />,
    goals: <Goals />,
    captures: <Captures />,
    cron: <Cron />,
    skills: <Skills />,
    logs: <Logs />,
    health: <Health />,
    notifications: <NotificationsPage notifs={notifs} onClear={clearNotifs} onMarkRead={markRead} />,
    settings: <Settings />,
  };

    const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    try { localStorage.setItem("sidebarCollapsed", String(next)); } catch {}
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-bg)] flex-col lg:flex-row">
      {/* Top bar - mobile only + desktop toggle */}
      <div className="lg:hidden flex items-center justify-between border-b border-border bg-surface px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={toggleSidebar} className="p-2 -ml-2 text-dim hover:text-text" aria-label="Toggle sidebar">
            <Menu size={20} />
          </button>
          <div className="text-amber font-bold text-sm tracking-widest">AGENT OS</div>
        </div>
        <div className="text-xs text-dim">{sseStatus === "live" ? "● live" : sseStatus}</div>
      </div>

      {/* Sidebar */}
      <div className={`${sidebarCollapsed && !window.matchMedia("(max-width: 1023px)").matches ? "hidden lg:flex" : "flex"} lg:shrink-0 relative z-40`}>
        {/* Backdrop for mobile */}
        {sidebarCollapsed === false && window.matchMedia && window.matchMedia("(max-width: 1023px)").matches && (
          <div className="fixed inset-0 bg-black/60 lg:hidden" onClick={() => setSidebarCollapsed(true)} />
        )}
        
        <div className={`${sidebarCollapsed ? "w-14" : "w-52"} lg:w-auto transition-all duration-200 border-r border-border bg-surface h-screen flex flex-col overflow-hidden`}>
          <Sidebar 
            current={page} 
            onChange={(p) => { setPage(p); if (window.matchMedia("(max-width: 1023px)").matches) setSidebarCollapsed(true); }} 
            unreadCount={unreadCount} 
            sseStatus={sseStatus}
            collapsed={sidebarCollapsed}
            onToggle={toggleSidebar}
          />
        </div>
      </div>

      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        {pages[page]}
      </main>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onNavigate={(p) => { setPage(p); setPaletteOpen(false); }} />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
