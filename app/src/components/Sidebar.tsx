import { Menu } from "lucide-react";
import { LayoutDashboard, Zap, ListChecks, FolderKanban, Inbox, ScrollText, HeartPulse, Bell, Settings, Target, Wifi, WifiOff, Loader2, FolderOpen, MessageSquare, Clock, Activity } from 'lucide-react';
import { Page } from '../types';

interface Props {
  current: Page;
  onChange: (page: Page) => void;
  unreadCount: number;
  sseStatus: 'live' | 'reconnecting' | 'off';
  collapsed?: boolean;
  onToggle?: () => void;
}

const NAV: { id: Page; label: string; Icon: React.ElementType }[] = [
  { id: 'dashboard',     label: 'Dashboard',    Icon: LayoutDashboard },
  { id: 'dispatch',      label: 'Dispatch',      Icon: Zap },
  { id: 'workspace',     label: 'Workspace',     Icon: FolderOpen },
  { id: 'inbox',         label: 'Inbox',         Icon: MessageSquare },
  { id: 'stream',        label: 'Stream',        Icon: Activity },
  { id: 'tasks',         label: 'Tasks',         Icon: ListChecks },
  { id: 'projects',      label: 'Projects',      Icon: FolderKanban },
  { id: 'goals',         label: 'Goals',         Icon: Target },
  { id: 'captures',      label: 'Captures',      Icon: Inbox },
  { id: 'cron',          label: 'Cron Jobs',     Icon: Clock },
  { id: 'logs',          label: 'Agent Logs',    Icon: ScrollText },
  { id: 'health',        label: 'Health',        Icon: HeartPulse },
  { id: 'notifications', label: 'Notifications', Icon: Bell },
  { id: 'settings',      label: 'Settings',      Icon: Settings },
];

export default function Sidebar({ current, onChange, unreadCount, sseStatus, collapsed = false, onToggle }: Props) {
  const SseIcon = sseStatus === 'live' ? Wifi : sseStatus === 'reconnecting' ? Loader2 : WifiOff;
  const sseColor = sseStatus === 'live' ? 'text-green' : sseStatus === 'reconnecting' ? 'text-amber animate-spin' : 'text-faint';
  const sseLabel = sseStatus === 'live' ? 'live' : sseStatus === 'reconnecting' ? 'reconnecting…' : 'offline';

  return (
    <aside className={`${collapsed ? "w-14" : "w-52"} shrink-0 flex flex-col border-r border-border bg-surface h-screen transition-all duration-200`}>
      {/* Brand + Toggle */}
      <div className="p-3 border-b border-border flex items-center justify-between">
        {!collapsed && (
          <div>
            <div className="text-amber font-bold text-sm tracking-widest">AGENT OS</div>
            <div className="flex items-center gap-1.5 mt-1 text-dim text-[10px]">
              <SseIcon size={11} className={sseColor} />
              <span>{sseLabel}</span>
            </div>
          </div>
        )}
        {onToggle && (
          <button 
            onClick={onToggle} 
            className="p-1.5 text-dim hover:text-text rounded hover:bg-bg/50 transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu size={16} className={collapsed ? "" : "rotate-180"} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-1.5 space-y-0.5 overflow-y-auto">
        {NAV.map(({ id, label, Icon }) => {
          const active = current === id;
          return (
            <button
              title={collapsed ? label : undefined}
              key={id}
              onClick={() => onChange(id)}
              className={[
                'w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs transition-colors border',
                active
                  ? 'bg-a-soft text-amber border-border2'
                  : 'text-dim hover:text-text hover:bg-raised border-transparent',
              ].join(' ')}
            >
              <Icon size={14} />
              <span className="flex-1 text-left">{label}</span>
              {id === 'notifications' && unreadCount > 0 && (
                <span className="bg-amber text-bg text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border text-[9px] text-faint text-center">
        ⌘K to search
      </div>
    </aside>
  );
}
