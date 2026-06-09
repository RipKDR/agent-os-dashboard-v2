import { useEffect, useState, useCallback } from 'react';
import { Search, X, CornerDownLeft } from 'lucide-react';
import { api, SearchResult } from '../lib/api';
import { Page } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onNavigate: (p: Page) => void;
}

const PAGES: { id: Page; label: string }[] = [
  { id: 'dashboard',     label: 'Dashboard' },
  { id: 'dispatch',      label: 'Agent Dispatch' },
  { id: 'workspace',     label: 'Workspace' },
  { id: 'inbox',         label: 'Unified Inbox' },
  { id: 'stream',        label: 'Multi-Agent Stream' },
  { id: 'tasks',         label: 'Tasks' },
  { id: 'projects',      label: 'Projects' },
  { id: 'goals',         label: 'Goals' },
  { id: 'captures',      label: 'Captures' },
  { id: 'cron',          label: 'Cron Jobs' },
  { id: 'logs',          label: 'Agent Logs' },
  { id: 'health',        label: 'System Health' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'settings',      label: 'Settings' },
];

interface Item { kind: 'page' | 'result'; id: string; label: string; type: string; status?: string; }

export default function CommandPalette({ open, onClose, onNavigate }: Props) {
  const [query, setQuery] = useState('');
  const [apiResults, setApiResults] = useState<SearchResult[]>([]);
  const [cursor, setCursor] = useState(0);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) { setQuery(''); setApiResults([]); setCursor(0); }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) { setApiResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await api.search(query);
        setApiResults(r.results || []);
      } catch {
        setApiResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const filtered = PAGES.filter(p => !query || p.label.toLowerCase().includes(query.toLowerCase()));
  const items: Item[] = [
    ...filtered.map(p => ({ kind: 'page' as const, id: p.id, label: p.label, type: 'page' })),
    ...apiResults.map(r => ({ kind: 'result' as const, id: r.id, label: r.label, type: r.type, status: r.status })),
  ];

  const choose = useCallback((item: Item) => {
    if (item.kind === 'page') { onNavigate(item.id as Page); onClose(); }
  }, [onNavigate, onClose]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, items.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
      if (e.key === 'Enter' && items[cursor]) choose(items[cursor]);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, items, cursor, choose, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[var(--color-surface)] border border-[var(--color-border2)] rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
          <Search size={15} className="text-[var(--color-dim)] shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={e => { setQuery(e.target.value); setCursor(0); }}
            placeholder="Search pages, tasks, projects…"
            className="flex-1 bg-transparent text-[var(--color-text)] text-sm focus:outline-none placeholder:text-[var(--color-faint)]"
          />
          {searching && (
            <div className="w-3 h-3 rounded-full border border-[var(--color-dim)] border-t-[var(--color-text)] animate-spin" />
          )}
          <button onClick={onClose} className="text-[var(--color-faint)] hover:text-[var(--color-text)]">
            <X size={14} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto p-1">
          {items.length === 0 && query && !searching && (
            <div className="text-center text-[var(--color-dim)] text-sm py-8">No results for "{query}"</div>
          )}
          {items.length === 0 && !query && (
            <div className="text-center text-[var(--color-dim)] text-xs py-6">Type to search…</div>
          )}
          {items.map((item, i) => (
            <button
              key={`${item.kind}-${item.id}-${i}`}
              onMouseEnter={() => setCursor(i)}
              onClick={() => choose(item)}
              className={[
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                cursor === i ? 'bg-[var(--color-raised)]' : 'hover:bg-[var(--color-raised)]',
              ].join(' ')}
            >
              <span className={`text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${
                item.kind === 'page'
                  ? 'border-[var(--color-border2)] text-[var(--color-dim)]'
                  : 'border-[var(--color-blue)] text-[var(--color-blue)]'
              }`}>
                {item.type}
              </span>
              <span className="flex-1 text-sm text-[var(--color-text)]">{item.label}</span>
              {item.status && (
                <span className="text-[10px] text-[var(--color-faint)]">{item.status}</span>
              )}
              {cursor === i && <CornerDownLeft size={12} className="text-[var(--color-faint)]" />}
            </button>
          ))}
        </div>

        <div className="flex gap-4 px-4 py-2 border-t border-[var(--color-border)] text-[10px] text-[var(--color-faint)]">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
