import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface Skill {
  name: string;
  description: string;
  source: string;
  path?: string;
}

export default function Skills() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [filtered, setFiltered] = useState<Skill[]>([]);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.skills.list().then(data => {
      if (data.ok) {
        setSkills(data.skills || []);
        setFiltered(data.skills || []);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    let result = skills;
    
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(s => 
        s.name.toLowerCase().includes(q) || 
        (s.description || '').toLowerCase().includes(q)
      );
    }
    
    if (sourceFilter !== 'all') {
      result = result.filter(s => s.source === sourceFilter);
    }
    
    setFiltered(result);
  }, [search, sourceFilter, skills]);

  const sources = Array.from(new Set(skills.map(s => s.source))).sort();

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text mb-1">Skills</h1>
        <p className="text-dim">Hermes + OpenClaw skill index ({skills.length} total)</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search skills..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-surface border border-border rounded px-3 py-2 text-sm"
        />
        <select 
          value={sourceFilter} 
          onChange={e => setSourceFilter(e.target.value)}
          className="bg-surface border border-border rounded px-3 py-2 text-sm"
        >
          <option value="all">All sources</option>
          {sources.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-dim">Loading skills...</div>
      ) : (
        <div className="grid gap-3">
          {filtered.length === 0 && (
            <div className="text-dim py-8 text-center">No skills match your filters.</div>
          )}
          {filtered.map((skill, idx) => (
            <div key={idx} className="bg-surface border border-border rounded p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-mono text-sm text-amber font-medium">{skill.name}</div>
                  <div className="text-xs text-dim mt-0.5">{skill.source}</div>
                  {skill.description && (
                    <div className="text-sm text-text mt-2 leading-snug">{skill.description}</div>
                  )}
                </div>
                {skill.path && (
                  <div className="text-[10px] text-dim font-mono break-all text-right max-w-[220px]">
                    {skill.path}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
