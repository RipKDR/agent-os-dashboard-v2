import { useState, useEffect, useMemo } from 'react';
import { api, Capture } from '../lib/api';
import { Inbox, Plus, Search, Copy, Calendar, Tag, X, ChevronDown, ChevronUp } from 'lucide-react';

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function truncateText(text: string, maxLength = 200): { text: string; isTruncated: boolean } {
  if (text.length <= maxLength) return { text, isTruncated: false };
  return { text: text.slice(0, maxLength), isTruncated: true };
}

export default function Captures() {
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCapture, setNewCapture] = useState({ text: '', intent: '' });
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterIntent, setFilterIntent] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<'none' | 'intent' | 'date'>('none');
  const [expandedCaptures, setExpandedCaptures] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.captures.list(50)
      .then(setCaptures)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const uniqueIntents = useMemo(() => {
    const intents = new Set(captures.map(c => c.intent).filter((intent): intent is string => Boolean(intent)));
    return Array.from(intents).sort();
  }, [captures]);

  const filteredCaptures = useMemo(() => {
    let filtered = captures;

    // Text search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => {
        const text = (c.text || c.raw_text || '').toLowerCase();
        const intent = (c.intent || '').toLowerCase();
        return text.includes(query) || intent.includes(query);
      });
    }

    // Intent filter
    if (filterIntent !== 'all') {
      filtered = filtered.filter(c => c.intent === filterIntent);
    }

    return filtered;
  }, [captures, searchQuery, filterIntent]);

  const groupedCaptures = useMemo(() => {
    if (groupBy === 'none') {
      return { 'All Captures': filteredCaptures };
    }

    if (groupBy === 'intent') {
      const groups: Record<string, Capture[]> = {};
      filteredCaptures.forEach(capture => {
        const intent = capture.intent || 'No Intent';
        if (!groups[intent]) groups[intent] = [];
        groups[intent].push(capture);
      });
      return groups;
    }

    if (groupBy === 'date') {
      const groups: Record<string, Capture[]> = {};
      filteredCaptures.forEach(capture => {
        const date = new Date(capture.created_at).toLocaleDateString();
        if (!groups[date]) groups[date] = [];
        groups[date].push(capture);
      });
      return groups;
    }

    return { 'All Captures': filteredCaptures };
  }, [filteredCaptures, groupBy]);

  async function createCapture() {
    if (!newCapture.text.trim() || creating) return;
    setCreating(true);

    try {
      await api.captures.create({
        text: newCapture.text.trim(),
        intent: newCapture.intent.trim() || undefined,
        status: 'pending'
      });

      setNewCapture({ text: '', intent: '' });
      setShowCreateForm(false);

      // Reload captures
      const data = await api.captures.list(50);
      setCaptures(data);
    } catch (err) {
      console.error('Failed to create capture:', err);
    } finally {
      setCreating(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    // Could add a toast notification here
  }

  function toggleExpanded(captureId: string) {
    setExpandedCaptures(prev => {
      const next = new Set(prev);
      if (next.has(captureId)) {
        next.delete(captureId);
      } else {
        next.add(captureId);
      }
      return next;
    });
  }

  const intentCounts = useMemo(() => {
    const counts: Record<string, number> = { all: captures.length };
    captures.forEach(c => {
      const intent = c.intent || 'No Intent';
      counts[intent] = (counts[intent] || 0) + 1;
    });
    return counts;
  }, [captures]);

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-text flex items-center gap-2">
            <Inbox size={18} className="text-amber" />
            Captures
          </h1>
          <p className="text-dim text-xs mt-0.5">{filteredCaptures.length} of {captures.length} captures</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-1.5 bg-amber text-bg px-3 py-2 rounded text-xs font-bold hover:opacity-90 transition-opacity"
        >
          <Plus size={12} />New Capture
        </button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-text">Create New Capture</h3>
            <button
              onClick={() => setShowCreateForm(false)}
              className="text-faint hover:text-text transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          <div className="space-y-3">
            <textarea
              value={newCapture.text}
              onChange={e => setNewCapture(prev => ({ ...prev, text: e.target.value }))}
              placeholder="Capture content..."
              rows={4}
              className="w-full bg-raised border border-border rounded px-3 py-2 text-sm text-text placeholder:text-faint focus:outline-none focus:border-border2 resize-none"
              autoFocus
            />
            <input
              type="text"
              placeholder="Intent/tag (optional)..."
              value={newCapture.intent}
              onChange={e => setNewCapture(prev => ({ ...prev, intent: e.target.value }))}
              className="w-full bg-raised border border-border rounded px-3 py-2 text-sm text-text placeholder:text-faint focus:outline-none focus:border-border2"
            />
            <div className="flex gap-2">
              <button
                onClick={createCapture}
                disabled={!newCapture.text.trim() || creating}
                className="bg-amber text-bg px-3 py-1.5 rounded text-xs font-bold disabled:opacity-40 hover:opacity-90 transition-opacity"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="bg-raised border border-border px-3 py-1.5 rounded text-xs text-text hover:bg-border transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        {/* Sidebar filters */}
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-faint" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search captures..."
              className="w-full pl-9 bg-surface border border-border rounded px-3 py-2 text-sm text-text placeholder:text-faint focus:outline-none focus:border-border2"
            />
          </div>

          {/* Group by */}
          <div>
            <div className="text-xs uppercase tracking-wider text-dim mb-2">Group by</div>
            <select
              value={groupBy}
              onChange={e => setGroupBy(e.target.value as any)}
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-border2"
            >
              <option value="none">No grouping</option>
              <option value="intent">Intent</option>
              <option value="date">Date</option>
            </select>
          </div>

          {/* Intent filters */}
          <div>
            <div className="text-xs uppercase tracking-wider text-dim mb-2">Filter by intent</div>
            <div className="space-y-1">
              <button
                onClick={() => setFilterIntent('all')}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded text-xs transition-colors border ${
                  filterIntent === 'all'
                    ? 'bg-a-soft text-amber border-border2'
                    : 'text-dim hover:text-text hover:bg-raised border-transparent'
                }`}
              >
                <Tag size={12} />
                <span className="flex-1 text-left">All</span>
                <span className="bg-raised px-1.5 py-0.5 rounded text-[10px] font-bold">{intentCounts.all}</span>
              </button>
              {uniqueIntents.map(intent => (
                <button
                  key={intent}
                  onClick={() => setFilterIntent(intent)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded text-xs transition-colors border ${
                    filterIntent === intent
                      ? 'bg-a-soft text-amber border-border2'
                      : 'text-dim hover:text-text hover:bg-raised border-transparent'
                  }`}
                >
                  <Tag size={12} />
                  <span className="flex-1 text-left">{intent}</span>
                  <span className="bg-raised px-1.5 py-0.5 rounded text-[10px] font-bold">{intentCounts[intent] || 0}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="col-span-3 space-y-4">
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-surface border border-border rounded-lg animate-pulse" />)}
            </div>
          ) : Object.keys(groupedCaptures).length === 0 || filteredCaptures.length === 0 ? (
            <div className="bg-surface border border-border rounded-lg p-8 text-center">
              <Inbox size={24} className="mx-auto mb-3 text-faint" />
              <div className="text-faint text-sm mb-2">
                {captures.length === 0 ? 'No captures yet' : 'No captures match your filters'}
              </div>
              {captures.length === 0 ? (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="text-amber hover:text-text transition-colors text-xs"
                >
                  Create your first capture
                </button>
              ) : (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilterIntent('all');
                  }}
                  className="text-blue hover:text-text transition-colors text-xs"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            Object.entries(groupedCaptures).map(([groupName, groupCaptures]) => (
              <div key={groupName} className="space-y-3">
                {groupBy !== 'none' && (
                  <div className="flex items-center gap-2 text-sm text-text font-bold">
                    <Calendar size={14} className="text-amber" />
                    {groupName}
                    <span className="text-xs text-dim">({groupCaptures.length})</span>
                  </div>
                )}

                <div className="space-y-2">
                  {groupCaptures.map(c => {
                    const text = c.text || c.raw_text || '(no text)';
                    const { text: previewText, isTruncated } = truncateText(text);
                    const isExpanded = expandedCaptures.has(c.id);

                    return (
                      <div key={c.id} className="bg-surface border border-border rounded-lg hover:border-border2 transition-colors">
                        <div className="p-4">
                          <div className="flex items-center gap-2 mb-3">
                            {c.intent && (
                              <span className="text-[10px] bg-a-soft border border-border2 px-2 py-0.5 rounded text-amber uppercase tracking-wide">
                                {c.intent}
                              </span>
                            )}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${c.status === 'processed' ? 'text-green border-green' : 'text-dim border-border'}`}>
                              {c.status}
                            </span>
                            <span className="text-[10px] text-faint ml-auto">
                              {formatRelativeTime(c.created_at)}
                            </span>
                            <button
                              onClick={() => copyToClipboard(text)}
                              className="text-faint hover:text-text transition-colors"
                              title="Copy to clipboard"
                            >
                              <Copy size={12} />
                            </button>
                          </div>

                          <div className="text-sm text-text">
                            {isExpanded || !isTruncated ? text : previewText}
                            {isTruncated && !isExpanded && '...'}
                          </div>

                          {isTruncated && (
                            <div className="mt-2">
                              <button
                                onClick={() => toggleExpanded(c.id)}
                                className="flex items-center gap-1 text-xs text-blue hover:text-text transition-colors"
                              >
                                {isExpanded ? (
                                  <>
                                    <ChevronUp size={12} />
                                    Show less
                                  </>
                                ) : (
                                  <>
                                    <ChevronDown size={12} />
                                    Read more
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
