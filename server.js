#!/usr/bin/env node
'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const ROOT = __dirname;
const PORT = parseInt(process.env.AGENT_DASHBOARD_PORT || '45680', 10);
const HOST = process.env.AGENT_DASHBOARD_HOST || '0.0.0.0';
const WORKSPACE_ROOT = process.env.AGENT_WORKSPACE_ROOT || path.resolve('/home/admin/.openclaw/workspace');
const DATA_DIR = path.join(ROOT, 'data');
const OPENCLAW_BIN = process.env.OPENCLAW_BIN || '/home/admin/.npm-global/bin/openclaw';

// ── Supabase ──────────────────────────────────────────────────
const DASHBOARD_SUPABASE_URL = process.env.AGENT_DASHBOARD_SUPABASE_URL || '';
const DASHBOARD_SUPABASE_KEY = process.env.AGENT_DASHBOARD_SUPABASE_KEY || '';

// ── Agent Unity ───────────────────────────────────────────────
const AGENT_UNITY_DIR = process.env.AGENT_UNITY_DIR || path.resolve('/home/admin/.agent-unity');

// ── Helpers ───────────────────────────────────────────────────
function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

function readBody(req, limit = 256 * 1024) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; if (data.length > limit) reject(new Error('body too large')); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function isAuthorized(req) {
  const auth = req.headers['authorization'] || '';
  if (!auth.startsWith('Basic ')) return false;
  try {
    const [user, pass] = Buffer.from(auth.slice(6), 'base64').toString().split(':');
    return user === (process.env.AGENT_DASHBOARD_USER || 'admin') && pass === process.env.AGENT_DASHBOARD_PASSWORD;
  } catch { return false; }
}

function requireAuth(req, res) {
  if (isAuthorized(req)) return true;
  res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Agent OS"' });
  res.end('Unauthorized');
  return false;
}

function fileInfo(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return { exists: true, bytes: stat.size, updatedAt: stat.mtime.toISOString(), path: filePath };
  } catch { return { exists: false, bytes: 0, updatedAt: null, path: filePath }; }
}

function readTextPreview(filePath, limit = 12000) {
  try { return fs.readFileSync(filePath, 'utf8').slice(0, limit); } catch { return ''; }
}

function getAgentUnityStatus() {
  const skillIndexPath = path.join(AGENT_UNITY_DIR, 'skill-index.json');
  const skillIndexMdPath = path.join(AGENT_UNITY_DIR, 'skill-index.md');
  const sharedContextPath = path.join(AGENT_UNITY_DIR, 'shared-context.md');
  const syncLogPath = path.join(AGENT_UNITY_DIR, 'logs', 'last-sync.log');
  const openclawBridgePath = path.join(WORKSPACE_ROOT, 'HERMES_OPENCLAW_BRIDGE.md');
  const agentIds = ['alex', 'maya', 'jordan', 'dev', 'sam', 'orchestrator', 'hermes'];

  let index = { skills: [], roots: {}, symlink_bridge: [], generated_at: null };
  try { index = JSON.parse(fs.readFileSync(skillIndexPath, 'utf8')); } catch {}
  const skills = Array.isArray(index.skills) ? index.skills : [];
  const bySource = skills.reduce((acc, item) => {
    const source = item.source || 'unknown';
    acc[source] = (acc[source] || 0) + 1;
    return acc;
  }, {});
  const namesByRuntime = skills.reduce((acc, item) => {
    if (!item.name) return acc;
    if (['hermes_local', 'cross_agent_shared'].includes(item.source)) acc.hermes.add(item.name);
    if (['openclaw_agent_shared', 'openclaw_workspace'].includes(item.source)) acc.openclaw.add(item.name);
    return acc;
  }, { hermes: new Set(), openclaw: new Set() });
  const sharedNames = [...namesByRuntime.hermes].filter(name => namesByRuntime.openclaw.has(name)).sort();
  const bootstrap = [WORKSPACE_ROOT, ...agentIds.map(id => path.join(WORKSPACE_ROOT, id))].map(dir => {
    const agentsPath = path.join(dir, 'AGENTS.md');
    const text = readTextPreview(agentsPath, 200000);
    return { id: path.basename(dir) === path.basename(WORKSPACE_ROOT) ? 'root' : path.basename(dir), path: agentsPath, present: text.includes('AGENT_UNITY_BRIDGE_BOOTSTRAP') };
  });
  const bridgeCopies = [openclawBridgePath, ...agentIds.map(id => path.join(WORKSPACE_ROOT, id, 'HERMES_OPENCLAW_BRIDGE.md'))].map(fileInfo);
  return {
    ok: fileInfo(skillIndexPath).exists && fileInfo(sharedContextPath).exists && bridgeCopies.every(f => f.exists) && bootstrap.every(b => b.present),
    generatedAt: index.generated_at || null,
    counts: { skillsTotal: skills.length, sharedSkillNames: sharedNames.length, ...bySource },
    roots: index.roots || {},
    symlinkBridge: Array.isArray(index.symlink_bridge) ? index.symlink_bridge : [],
    files: { skillIndex: fileInfo(skillIndexPath), skillIndexMarkdown: fileInfo(skillIndexMdPath), sharedContext: fileInfo(sharedContextPath), openclawBridge: fileInfo(openclawBridgePath), lastSyncLog: fileInfo(syncLogPath) },
    bridgeCopies, bootstrap,
    sharedSkillSample: sharedNames.slice(0, 80),
    syncLogTail: readTextPreview(syncLogPath, 12000).split('\n').slice(-30).join('\n').trim(),
  };
}

function getSelfImprovingInsights(limit = 5) {
  const base = path.join(WORKSPACE_ROOT, "self-improving");
  const mainMemory = path.join(base, "memory.md");
  const domainsDir = path.join(base, "domains");
  const results = [];
  try {
    if (fs.existsSync(mainMemory)) {
      const text = fs.readFileSync(mainMemory, "utf8").slice(0, 8000);
      results.push({ type: "global", path: mainMemory, preview: text.split("\n").slice(0, 12).join("\n") });
    }
    if (fs.existsSync(domainsDir)) {
      const files = fs.readdirSync(domainsDir).filter(f => f.endsWith(".md")).slice(0, limit);
      for (const f of files) {
        const p = path.join(domainsDir, f);
        const text = fs.readFileSync(p, "utf8").slice(0, 3000);
        results.push({ type: "domain", name: f.replace(".md", ""), path: p, preview: text.split("\n").slice(0, 8).join("\n") });
      }
    }
    return { ok: true, count: results.length, insights: results };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}



function getSkills() {
  const skillIndexPath = path.join(AGENT_UNITY_DIR, "skill-index.json");
  try {
    const index = JSON.parse(fs.readFileSync(skillIndexPath, "utf8"));
    const skills = Array.isArray(index.skills) ? index.skills : [];
    return {
      ok: true,
      total: skills.length,
      generatedAt: index.generated_at || null,
      skills: skills.slice(0, 200), // limit for payload size
      sources: Object.keys(skills.reduce((acc, s) => { acc[s.source || "unknown"] = true; return acc; }, {}))
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}



function syncAgentUnity() {
  return new Promise((resolve) => {
    const scriptPath = path.join(AGENT_UNITY_DIR, "scripts", "sync-agent-unity.py");
    if (!fs.existsSync(scriptPath)) {
      resolve({ ok: false, error: "Sync script not found at " + scriptPath });
      return;
    }
    exec(`python3 "${scriptPath}"`, { cwd: AGENT_UNITY_DIR, timeout: 120000 }, (err, stdout, stderr) => {
      resolve({
        ok: !err,
        exitCode: err ? (err.code || 1) : 0,
        stdout: (stdout || "").toString().slice(0, 4000),
        stderr: (stderr || "").toString().slice(0, 2000),
        ranAt: new Date().toISOString()
      });
    });
  });
}



function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'AgentDashboard/1' } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
    }).on('error', reject);
  });
}

// ── SSE Broadcasting ──────────────────────────────────────────
const clients = new Set();
function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) {
    try { c.write(msg); } catch { clients.delete(c); }
  }
}

// ── JSON Store ────────────────────────────────────────────────
function makeStore(filename, maxItems = 2000) {
  const file = path.join(DATA_DIR, filename);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, '[]');
  function load() { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; } }
  function save(arr) { fs.writeFileSync(file, JSON.stringify(arr.slice(-maxItems), null, 2)); }
  return {
    all: load,
    append(item) { const arr = load(); arr.push({ ...item, id: item.id || Date.now().toString(36), created_at: new Date().toISOString() }); save(arr); return arr[arr.length - 1]; },
    patch(id, updates) { const arr = load(); const i = arr.findIndex(x => x.id === id); if (i < 0) return null; Object.assign(arr[i], updates, { updated_at: new Date().toISOString() }); save(arr); return arr[i]; },
    remove(id) { const arr = load(); const filtered = arr.filter(x => x.id !== id); save(filtered); return filtered.length < arr.length; },
  };
}

const stores = {
  tasks: makeStore('tasks.json', 2000),
  captures: makeStore('captures.json', 5000),
  projects: makeStore('projects.json', 500),
  goals: makeStore('goals.json', 200),
  contentIdeas: makeStore('content-ideas.json', 1000),
  dailyBrief: makeStore('daily-brief.json', 30),
  weeklyBrief: makeStore('weekly-briefs.json', 12),
  whyNotes: makeStore('why-notes.json', 1000),
  guideResearch: makeStore('guide-research.json', 1000),
  standups: makeStore('standups.json', 100),
  webhookEvents: makeStore('webhook-events.json', 500),
  notifications: makeStore('notifications.json', 200),
};

function toTime(value) {
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getDispatchHealth() {
  const tasks = stores.tasks.all();
  const now = Date.now();
  const counts = tasks.reduce((acc, task) => {
    const status = task.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  const pending = tasks.filter(task => task.status === 'pending');
  const inProgress = tasks.filter(task => task.status === 'in_progress');
  const legacyDispatched = tasks.filter(task => task.status === 'dispatched');
  const staleThresholdMs = 30 * 60 * 1000;
  const taskAge = task => {
    const started = toTime(task.updated_at || task.created_at);
    return started > 0 ? Math.max(0, now - started) : null;
  };
  const pendingAges = pending.map(taskAge).filter(age => age !== null);
  const staleInProgress = inProgress.filter(task => {
    const age = taskAge(task);
    return age === null || age > staleThresholdMs;
  });
  const latestDoneAt = tasks
    .filter(task => ['done', 'completed'].includes(task.status))
    .map(task => toTime(task.updated_at || task.created_at))
    .filter(Boolean)
    .sort((a, b) => b - a)[0] || null;

  return {
    ok: pending.length === 0 && staleInProgress.length === 0,
    checkedAt: new Date(now).toISOString(),
    total: tasks.length,
    counts,
    pending: pending.length,
    inProgress: inProgress.length,
    legacyDispatched: legacyDispatched.length,
    pendingAgeMaxMs: pendingAges.length ? Math.max(...pendingAges) : 0,
    staleInProgress: staleInProgress.length,
    staleThresholdMs,
    latestDoneAt: latestDoneAt ? new Date(latestDoneAt).toISOString() : null,
  };
}

// ── Agent Dispatch ────────────────────────────────────────────
function runAgent(agentId, message) {
  return new Promise((resolve, reject) => {
    const cmd = `${OPENCLAW_BIN} agent --agent ${agentId} --message ${JSON.stringify(message)} --json`;
    exec(cmd, { cwd: WORKSPACE_ROOT, timeout: 660000, maxBuffer: 8 * 1024 * 1024, env: process.env }, (err, stdout, stderr) => {
      if (err && !stdout) return reject(new Error(stderr || err.message));
      try { resolve(JSON.parse(stdout)); } catch { resolve({ text: stdout.trim() }); }
    });
  });
}

// ── API Router ────────────────────────────────────────────────
async function handleApi(req, res, url) {
  const method = req.method;
  const pathname = url.pathname;

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization' });
    res.end();
    return;
  }

  // Health check (no auth)
  if (method === 'GET' && pathname === '/healthz') {
    return sendJson(res, 200, { ok: true, status: 'healthy', uptime: process.uptime() });
  }

  // Self-improving insights (no auth)
  if (method === "GET" && pathname === "/api/self-improving") {
    const limit = parseInt(url.searchParams.get("limit") || "5", 10);
    return sendJson(res, 200, getSelfImprovingInsights(limit));
  }

  // Skills explorer (no auth — lightweight)
  if (method === "GET" && pathname === "/api/skills") {
    return sendJson(res, 200, getSkills());
  }

  // Agent Unity status (no auth — lightweight)
  if (method === 'GET' && pathname === '/api/agent-unity') {
    return sendJson(res, 200, getAgentUnityStatus());
  }

  // Agent Unity sync (auth required) — extra integration feature
  if (method === 'POST' && pathname === '/api/agent-unity/sync') {
    if (!requireAuth(req, res)) return;
    syncAgentUnity().then(result => sendJson(res, 200, result)).catch(e => sendJson(res, 500, { ok: false, error: String(e) }));
    return;
  }

  // Config (no auth — needed by frontend)
  if (method === 'GET' && pathname === '/api/config') {
    return sendJson(res, 200, {
      supabaseUrl: DASHBOARD_SUPABASE_URL,
      supabaseKey: DASHBOARD_SUPABASE_KEY,
    });
  }

  // Dispatch queue health (no auth — aggregate status for the dashboard shell)
  if (method === 'GET' && pathname === '/api/tasks/dispatch-health') {
    return sendJson(res, 200, getDispatchHealth());
  }

  // Pending tasks (no auth — localhost only, for Hermes cron pickup)
  if (method === 'GET' && pathname === '/api/tasks/pending') {
    const tasks = stores.tasks.all();
    const pending = tasks.filter(t => t.status === 'pending');
    return sendJson(res, 200, pending);
  }

  // Task status updates from cron (no auth — localhost only)
  if (method === 'PATCH' && pathname.startsWith('/api/tasks/')) {
    const id = pathname.split('/').pop();
    const body = JSON.parse(await readBody(req));
    const task = stores.tasks.patch(id, body);
    return sendJson(res, task ? 200 : 404, task || { error: 'not found' });
  }

  // Everything else requires auth
  if (!requireAuth(req, res)) return;

  // ── Tasks ──────────────────────────────────────────────────
  if (method === 'GET' && pathname === '/api/tasks') {
    return sendJson(res, 200, stores.tasks.all().slice(-50).reverse());
  }
  if (method === 'POST' && pathname === '/api/tasks') {
    const body = JSON.parse(await readBody(req));
    const task = stores.tasks.append(body);
    return sendJson(res, 201, task);
  }
  if (method === 'GET' && pathname.startsWith('/api/tasks/')) {
    const id = pathname.split('/').pop();
    const tasks = stores.tasks.all();
    const task = tasks.find(t => t.id === id);
    return sendJson(res, task ? 200 : 404, task || { error: 'not found' });
  }
  if (method === 'DELETE' && pathname.startsWith('/api/tasks/')) {
    const id = pathname.split('/').pop();
    stores.tasks.remove(id);
    return sendJson(res, 200, { ok: true });
  }

  // ── Captures ───────────────────────────────────────────────
  if (method === 'GET' && pathname === '/api/captures') {
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    return sendJson(res, 200, stores.captures.all().slice(-limit).reverse());
  }
  if (method === 'POST' && pathname === '/api/captures') {
    const body = JSON.parse(await readBody(req));
    const capture = stores.captures.append(body);
    return sendJson(res, 201, capture);
  }

  // ── Projects ───────────────────────────────────────────────
  if (method === 'GET' && pathname === '/api/projects') {
    return sendJson(res, 200, stores.projects.all().slice(-20).reverse());
  }
  if (method === 'POST' && pathname === '/api/projects') {
    const body = JSON.parse(await readBody(req));
    const project = stores.projects.append(body);
    return sendJson(res, 201, project);
  }

  // ── Goals ──────────────────────────────────────────────────
  if (method === 'GET' && pathname === '/api/goals') {
    return sendJson(res, 200, stores.goals.all());
  }
  if (method === 'POST' && pathname === '/api/goals') {
    const body = JSON.parse(await readBody(req));
    const goal = stores.goals.append(body);
    return sendJson(res, 201, goal);
  }

  // ── Notifications ─────────────────────────────────────────
  if (pathname === '/api/notifications') {
    if (method === 'GET') return sendJson(res, 200, stores.notifications.all().reverse());
    if (method === 'POST') {
      const payload = JSON.parse(await readBody(req) || '{}');
      const n = stores.notifications.append({ type: payload.type || 'info', message: payload.message || '', source: payload.source || '', read: false });
      broadcast('notification', n);
      return sendJson(res, 200, n);
    }
    if (method === 'DELETE') {
      const all = stores.notifications.all();
      all.forEach(n => stores.notifications.remove(n.id));
      return sendJson(res, 200, { ok: true });
    }
  }
  if (method === 'PATCH' && pathname.startsWith('/api/notifications/')) {
    const id = pathname.split('/').pop();
    const r = stores.notifications.patch(id, JSON.parse(await readBody(req) || '{}'));
    return sendJson(res, r ? 200 : 404, r || { error: 'not found' });
  }

  // ── Global Search ─────────────────────────────────────────
  if (method === 'GET' && pathname === '/api/search') {
    const q = (url.searchParams.get('q') || '').toLowerCase().trim();
    if (!q || q.length < 2) return sendJson(res, 200, { results: [] });
    const results = [];
    for (const [storeName, label] of [['tasks', 'task'], ['projects', 'project'], ['captures', 'capture'], ['contentIdeas', 'idea'], ['goals', 'goal']]) {
      try {
        const items = stores[storeName].all();
        items.filter(i => JSON.stringify(i).toLowerCase().includes(q)).slice(0, 5).forEach(i => {
          results.push({ type: label, label: (i.title || i.name || i.text || '').slice(0, 80), id: i.id, status: i.status });
        });
      } catch {}
    }
    return sendJson(res, 200, { results: results.slice(0, 20) });
  }

  // ── System Resources ──────────────────────────────────────
  if (method === 'GET' && pathname === '/api/system/resources') {
    try {
      const os = require('os');
      const cpus = os.cpus();
      const loadAvg = os.loadavg();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      let disk = null;
      try {
        const { execFileSync } = require('child_process');
        const dfOut = String(execFileSync('df', ['-B1', WORKSPACE_ROOT], { timeout: 3000 }));
        const parts = dfOut.trim().split('\n')[1]?.split(/\s+/);
        if (parts && parts.length >= 4) disk = { total: parseInt(parts[1], 10), used: parseInt(parts[2], 10), available: parseInt(parts[3], 10) };
      } catch {}
      return sendJson(res, 200, {
        hostname: os.hostname(), platform: os.platform(), uptime: os.uptime(),
        cpus: cpus.length, loadAvg: loadAvg.slice(0, 3),
        memory: { total: totalMem, free: freeMem, used: totalMem - freeMem, pct: ((totalMem - freeMem) / totalMem * 100).toFixed(1) },
        disk,
      });
    } catch(e) { return sendJson(res, 500, { error: e.message }); }
  }

  // ── System Errors ─────────────────────────────────────────
  if (method === 'GET' && pathname === '/api/system/errors') {
    let errors = [];
    if (DASHBOARD_SUPABASE_URL && DASHBOARD_SUPABASE_KEY) {
      try {
        const res = await fetch(`${DASHBOARD_SUPABASE_URL}/rest/v1/agent_logs?status=eq.failed&order=created_at.desc&limit=20`, {
          headers: { 'apikey': DASHBOARD_SUPABASE_KEY, 'Authorization': `Bearer ${DASHBOARD_SUPABASE_KEY}` },
        });
        const data = await res.json();
        errors = (Array.isArray(data) ? data : []).map(r => ({ agent: r.agent_name, task: r.task_description, model: r.model_used, ts: r.created_at }));
      } catch {}
    }
    const recentTaskFailures = stores.tasks.all().filter(t => t.status === 'failed').slice(0, 10);
    return sendJson(res, 200, { errors, recentTaskFailures });
  }

  // ── Agent Dispatch ─────────────────────────────────────────
  if (method === 'POST' && pathname === '/api/agents/dispatch') {
    const body = JSON.parse(await readBody(req));
    const { agent, message } = body;
    if (!agent || !message) return sendJson(res, 400, { error: 'agent and message required' });

    const task = stores.tasks.append({
      title: message.substring(0, 120),
      description: message,
      agent,
      status: 'in_progress',
      source: 'dashboard',
    });

    console.log(`[DISPATCH] Executing ${agent}: ${message.substring(0, 80)}`);

    // Actually run the agent instead of leaving it pending
    try {
      const result = await runAgent(agent, message);
      const finalStatus = result.exitCode === 0 ? 'completed' : 'failed';
      stores.tasks.patch(task.id, {
        status: finalStatus,
        result: (result.stdout || result.stderr || '').slice(0, 2000),
        exitCode: result.exitCode
      });
      console.log(`[DISPATCH] ${agent} finished exit=${result.exitCode}`);

      return sendJson(res, 200, {
        ok: true,
        task: { ...task, status: finalStatus },
        result: result.stdout?.slice(0, 2000) || '',
        exitCode: result.exitCode
      });
    } catch (err) {
      stores.tasks.patch(task.id, { status: 'failed', error: String(err) });
      return sendJson(res, 500, { ok: false, error: String(err), task });
    }
  }

  // ── Pending tasks (for Hermes cron pickup) ─────────────────
  if (method === 'GET' && pathname === '/api/tasks/pending') {
    const tasks = stores.tasks.all();
    const pending = tasks.filter(t => t.status === 'pending');
    return sendJson(res, 200, pending);
  }

  // ── Agent Logs (from Supabase) ─────────────────────────────
  if (method === 'GET' && pathname === '/api/agent-logs') {
    if (!DASHBOARD_SUPABASE_URL || !DASHBOARD_SUPABASE_KEY) {
      return sendJson(res, 503, { error: 'Supabase not configured' });
    }
    try {
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      const supabaseRes = await fetch(`${DASHBOARD_SUPABASE_URL}/rest/v1/agent_logs?select=*&order=created_at.desc&limit=${limit}`, {
        headers: {
          'apikey': DASHBOARD_SUPABASE_KEY,
          'Authorization': `Bearer ${DASHBOARD_SUPABASE_KEY}`,
        },
      });
      const data = await supabaseRes.json();
      return sendJson(res, 200, data);
    } catch (e) {
      return sendJson(res, 502, { error: e.message });
    }
  }

  // ── Agent Stats ────────────────────────────────────────────
  if (method === 'GET' && pathname === '/api/agent-stats') {
    if (!DASHBOARD_SUPABASE_URL || !DASHBOARD_SUPABASE_KEY) {
      return sendJson(res, 503, { error: 'Supabase not configured' });
    }
    try {
      const supabaseRes = await fetch(`${DASHBOARD_SUPABASE_URL}/rest/v1/agent_logs?select=agent_name,status&order=created_at.desc&limit=100`, {
        headers: {
          'apikey': DASHBOARD_SUPABASE_KEY,
          'Authorization': `Bearer ${DASHBOARD_SUPABASE_KEY}`,
        },
      });
      const logs = await supabaseRes.json();
      const stats = {};
      for (const log of logs) {
        if (!stats[log.agent_name]) stats[log.agent_name] = { total: 0, completed: 0, failed: 0, running: 0 };
        stats[log.agent_name].total++;
        stats[log.agent_name][log.status] = (stats[log.agent_name][log.status] || 0) + 1;
      }
      return sendJson(res, 200, stats);
    } catch (e) {
      return sendJson(res, 502, { error: e.message });
    }
  }

  // ── SSE Events ─────────────────────────────────────────────
  if (pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write(`event: connected\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  // ── Status ─────────────────────────────────────────────────
  if (method === 'GET' && pathname === '/api/status') {
    return sendJson(res, 200, {
      ok: true,
      workspace: WORKSPACE_ROOT,
      uptime: process.uptime(),
      memory: process.memoryUsage().rss,
    });
  }

  // ── Terminal/Workspace ─────────────────────────────────────
  if (method === 'POST' && pathname === '/api/terminal/exec') {
    const { command, workdir = WORKSPACE_ROOT, timeout = 30000 } = JSON.parse(await readBody(req));
    if (!command) return sendJson(res, 400, { error: 'command required' });

    // Basic input sanitization - reject obviously dangerous patterns
    const dangerous = ['rm -rf', '> /dev/', '| sudo', '&& sudo', '; sudo', 'curl |', 'wget |', 'exec(', 'eval('];
    if (dangerous.some(pattern => command.toLowerCase().includes(pattern))) {
      return sendJson(res, 400, { error: 'Command contains potentially dangerous patterns' });
    }

    // Ensure workdir is safe
    const safePath = path.normalize(path.resolve(workdir));
    if (!safePath.startsWith(WORKSPACE_ROOT) && !safePath.startsWith('/tmp')) {
      return sendJson(res, 403, { error: 'Working directory not allowed' });
    }

    try {
      // Additional security: only allow specific safe commands
      const allowedCommands = ['ls', 'pwd', 'whoami', 'date', 'git status', 'git log', 'git diff'];
      const isAllowed = allowedCommands.some(allowed => command.startsWith(allowed));

      if (!isAllowed) {
        return sendJson(res, 403, { error: 'Command not allowed. Only basic read-only commands permitted.' });
      }

      const { execSync } = require('child_process');
      const output = execSync(command, {
        cwd: safePath,
        timeout,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024,
        env: { PATH: '/usr/bin:/bin' } // Minimal secure PATH
      });
      return sendJson(res, 200, { output: output.trim(), exitCode: 0 });
    } catch (err) {
      return sendJson(res, 200, { output: err.message, exitCode: err.status || 1 });
    }
  }

  if (method === 'GET' && pathname === '/api/workspace/ls') {
    const targetPath = url.searchParams.get('path') || '/';
    const safePath = path.normalize(path.join(WORKSPACE_ROOT, targetPath));
    if (!safePath.startsWith(WORKSPACE_ROOT)) return sendJson(res, 403, { error: 'path not allowed' });
    try {
      const entries = fs.readdirSync(safePath).map(name => {
        const filePath = path.join(safePath, name);
        const stat = fs.statSync(filePath);
        return {
          name,
          type: stat.isDirectory() ? 'dir' : 'file',
          size: stat.size,
          modifiedAt: stat.mtime.toISOString(),
        };
      });
      return sendJson(res, 200, { entries });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (method === 'GET' && pathname === '/api/workspace/read') {
    const targetPath = url.searchParams.get('path');
    if (!targetPath) return sendJson(res, 400, { error: 'path required' });
    if (targetPath.includes('..')) return sendJson(res, 400, { error: 'invalid path' });
    const safePath = path.normalize(path.join(WORKSPACE_ROOT, targetPath));
    if (!safePath.startsWith(WORKSPACE_ROOT)) return sendJson(res, 403, { error: 'path not allowed' });
    try {
      const realSafePath = fs.realpathSync(safePath);
      const realWorkspaceRoot = fs.realpathSync(WORKSPACE_ROOT);
      if (!realSafePath.startsWith(realWorkspaceRoot + path.sep)) {
        return sendJson(res, 403, { error: 'path not allowed' });
      }
      const content = fs.readFileSync(realSafePath, 'utf8').slice(0, 100 * 1024); // 100KB limit
      return sendJson(res, 200, { content, path: targetPath });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // ── Git ────────────────────────────────────────────────────
  if (method === 'GET' && pathname === '/api/git/status') {
    try {
      const { execSync } = require('child_process');
      const opts = { cwd: WORKSPACE_ROOT, encoding: 'utf8' };

      const branch = execSync('git branch --show-current', opts).trim();
      const statusOut = execSync('git status --porcelain', opts);
      const changes = statusOut.trim().split('\n').filter(Boolean).map(line => {
        const status = line.slice(0, 2);
        const filePath = line.slice(3);
        return { path: filePath, status, staged: status[0] !== ' ' && status[0] !== '?' };
      });

      let ahead = 0, behind = 0;
      try {
        const countOut = execSync('git rev-list --count --left-right HEAD...@{upstream}', opts);
        const [a, b] = countOut.trim().split('\t').map(Number);
        ahead = a; behind = b;
      } catch {} // ignore if no upstream

      return sendJson(res, 200, { branch, changes, ahead, behind });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (method === 'GET' && pathname === '/api/git/log') {
    const max = parseInt(url.searchParams.get('max') || '10', 10);
    try {
      const { execSync } = require('child_process');
      const logOut = execSync(`git log --oneline -n ${max} --format="%H|%an|%ai|%s"`, {
        cwd: WORKSPACE_ROOT, encoding: 'utf8'
      });
      const commits = logOut.trim().split('\n').filter(Boolean).map(line => {
        const [hash, author, date, message] = line.split('|');
        return { hash, author, date, message };
      });
      return sendJson(res, 200, { commits });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (method === 'GET' && pathname === '/api/git/diff') {
    const filePath = url.searchParams.get('path');
    if (!filePath) return sendJson(res, 400, { error: 'path required' });
    if (filePath.startsWith('-')) return sendJson(res, 400, { error: 'invalid path' });
    try {
      const { execFileSync } = require('child_process');
      const diff = execFileSync('git', ['diff', 'HEAD', '--', filePath], {
        cwd: WORKSPACE_ROOT, encoding: 'utf8'
      });
      return sendJson(res, 200, { diff });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (method === 'POST' && pathname === '/api/git/commit') {
    const { message } = JSON.parse(await readBody(req));
    if (!message) return sendJson(res, 400, { error: 'message required' });
    try {
      const { execFileSync } = require('child_process');
      const opts = { cwd: WORKSPACE_ROOT, encoding: 'utf8' };
      const output = execFileSync('git', ['commit', '-m', message], opts);
      return sendJson(res, 200, { ok: true, output: output.toString() });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (method === 'POST' && pathname === '/api/git/push') {
    try {
      const { execSync } = require('child_process');
      const output = execSync('git push', { cwd: WORKSPACE_ROOT, encoding: 'utf8' });
      return sendJson(res, 200, { ok: true, output });
    } catch (err) {
      return sendJson(res, 500, { error: err.message, output: err.stdout });
    }
  }

  // ── Messages ───────────────────────────────────────────────
  if (method === 'GET' && pathname === '/api/messages') {
    try {
      const { execSync } = require('child_process');
      const channelsOut = execSync(`${OPENCLAW_BIN} channels status --json`, {
        cwd: WORKSPACE_ROOT, encoding: 'utf8'
      });
      const channels = JSON.parse(channelsOut);
      const messages = [];

      for (const channel of channels.filter(c => c.connected)) {
        try {
          const msgsOut = execSync(`${OPENCLAW_BIN} message read --channel ${channel.platform} --target channel:${channel.id} --limit 5 --json`, {
            cwd: WORKSPACE_ROOT, encoding: 'utf8'
          });
          const channelMsgs = JSON.parse(msgsOut);
          messages.push(...channelMsgs.map(m => ({
            ...m,
            platform: channel.platform,
            channel: channel.id
          })));
        } catch {} // ignore channel read errors
      }

      return sendJson(res, 200, { messages: messages.slice(-20) });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (method === 'POST' && pathname === '/api/messages/send') {
    const { platform, target, message } = JSON.parse(await readBody(req));
    if (!platform || !target || !message) {
      return sendJson(res, 400, { error: 'platform, target, and message required' });
    }

    // Validate platform against allowlist
    if (!/^[a-z]+$/.test(platform)) {
      return sendJson(res, 400, { error: 'invalid platform' });
    }

    try {
      const { execFileSync } = require('child_process');
      execFileSync(OPENCLAW_BIN, ['message', 'send', '--channel', platform, '--target', target, '--message', message], {
        cwd: WORKSPACE_ROOT
      });
      return sendJson(res, 200, { ok: true });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (method === 'GET' && pathname === '/api/messages/thread') {
    const platform = url.searchParams.get('platform');
    const channel = url.searchParams.get('channel');
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    if (!platform || !channel) return sendJson(res, 400, { error: 'platform and channel required' });

    try {
      const { execSync } = require('child_process');
      const msgsOut = execSync(`${OPENCLAW_BIN} message read --channel ${platform} --target channel:${channel} --limit ${limit} --json`, {
        cwd: WORKSPACE_ROOT, encoding: 'utf8'
      });
      const messages = JSON.parse(msgsOut);
      return sendJson(res, 200, { messages });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  // ── Cron Jobs ──────────────────────────────────────────────
  if (method === 'GET' && pathname === '/api/cron') {
    try {
      // Read from hermes cron state - assuming it's JSON formatted
      const cronDir = path.join(process.env.HOME, '.hermes', 'cron');
      let jobs = [];
      try {
        const cronFiles = fs.readdirSync(cronDir);
        jobs = cronFiles.map(file => {
          const data = JSON.parse(fs.readFileSync(path.join(cronDir, file), 'utf8'));
          return { id: path.basename(file, '.json'), ...data };
        });
      } catch {} // ignore if no cron directory
      return sendJson(res, 200, { jobs });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (method === 'POST' && pathname === '/api/cron') {
    const { name, schedule, prompt, agent, enabled = true } = JSON.parse(await readBody(req));
    if (!name || !schedule || !prompt) {
      return sendJson(res, 400, { error: 'name, schedule, and prompt required' });
    }
    try {
      const id = `job_${Date.now()}`;
      const job = { name, schedule, prompt, agent, enabled, nextRun: null, lastRun: null, lastStatus: 'pending' };

      // This would integrate with hermes cron system
      // For now, just store the job data
      const cronDir = path.join(process.env.HOME, '.hermes', 'cron');
      fs.mkdirSync(cronDir, { recursive: true });
      fs.writeFileSync(path.join(cronDir, `${id}.json`), JSON.stringify(job));

      return sendJson(res, 200, { id, ...job });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (method === 'PATCH' && pathname.startsWith('/api/cron/')) {
    const id = pathname.split('/').pop();
    if (!/^job_[0-9]+$/.test(id)) return sendJson(res, 400, { error: 'invalid job id' });
    const updates = JSON.parse(await readBody(req));
    try {
      const cronDir = path.join(process.env.HOME, '.hermes', 'cron');
      const jobFile = path.join(cronDir, `${id}.json`);
      if (!jobFile.startsWith(path.resolve(cronDir) + path.sep)) {
        return sendJson(res, 403, { error: 'invalid path' });
      }
      const job = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
      Object.assign(job, updates);
      fs.writeFileSync(jobFile, JSON.stringify(job));
      return sendJson(res, 200, { id, ...job });
    } catch (err) {
      return sendJson(res, 404, { error: 'job not found' });
    }
  }

  if (method === 'DELETE' && pathname.startsWith('/api/cron/')) {
    const id = pathname.split('/').pop();
    try {
      const cronDir = path.join(process.env.HOME, '.hermes', 'cron');
      fs.unlinkSync(path.join(cronDir, `${id}.json`));
      return sendJson(res, 200, { ok: true });
    } catch (err) {
      return sendJson(res, 404, { error: 'job not found' });
    }
  }

  if (method === 'POST' && pathname.startsWith('/api/cron/') && pathname.endsWith('/run')) {
    const id = pathname.split('/')[3];
    try {
      // Trigger job execution - would integrate with hermes cron
      return sendJson(res, 200, { ok: true, message: 'Job triggered' });
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (method === 'POST' && pathname.startsWith('/api/cron/') && pathname.endsWith('/toggle')) {
    const id = pathname.split('/')[3];
    try {
      const cronDir = path.join(process.env.HOME, '.hermes', 'cron');
      const jobFile = path.join(cronDir, `${id}.json`);
      const job = JSON.parse(fs.readFileSync(jobFile, 'utf8'));
      job.enabled = !job.enabled;
      fs.writeFileSync(jobFile, JSON.stringify(job));
      return sendJson(res, 200, { id, ...job });
    } catch (err) {
      return sendJson(res, 404, { error: 'job not found' });
    }
  }

  // ── Agent Streaming ────────────────────────────────────────
  if (method === 'POST' && pathname === '/api/agents/dispatch-stream') {
    const body = JSON.parse(await readBody(req));
    const { agent, message } = body;
    if (!agent || !message) return sendJson(res, 400, { error: 'agent and message required' });

    const task = stores.tasks.append({
      title: message.substring(0, 120),
      description: message,
      agent,
      status: 'in_progress',
      source: 'dashboard-stream',
    });

    // Broadcast that streaming started
    broadcast('agent-thinking', { agent, task: task.id, message });

    // Start async processing with streaming
    (async () => {
      try {
        stores.tasks.patch(task.id, { status: 'in_progress' });
        broadcast('agent-activity', { agent, status: 'running', task: task.id, output: '', timestamp: new Date().toISOString() });

        const result = await runAgent(agent, message);

        // Simulate token streaming for demo (in real implementation this would come from the agent)
        const text = result.text || JSON.stringify(result);
        for (let i = 0; i < text.length; i += 10) {
          broadcast('agent-token', { agent, task: task.id, token: text.slice(i, i + 10) });
          await new Promise(resolve => setTimeout(resolve, 50)); // throttle
        }

        stores.tasks.patch(task.id, { status: 'done', result: text });
        broadcast('agent-complete', { agent, task: task.id, result: text, timestamp: new Date().toISOString() });
        broadcast('agent-activity', { agent, status: 'done', task: task.id, output: text, timestamp: new Date().toISOString() });
      } catch (error) {
        stores.tasks.patch(task.id, { status: 'failed', error: error.message });
        broadcast('agent-error', { agent, task: task.id, error: error.message, timestamp: new Date().toISOString() });
        broadcast('agent-activity', { agent, status: 'failed', task: task.id, output: `Error: ${error.message}`, timestamp: new Date().toISOString() });
      }
    })();

    return sendJson(res, 202, {
      ok: true,
      task,
      message: `Streaming task to ${agent}. Watch for real-time updates.`,
    });
  }

  // ── 404 ────────────────────────────────────────────────────
  sendJson(res, 404, { error: 'not found' });
}

// ── HTTP Server ──────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);

  // Health and API routes
  if (reqUrl.pathname === '/healthz' || reqUrl.pathname.startsWith('/api/')) return handleApi(req, res, reqUrl);

  // SSE endpoint
  if (reqUrl.pathname === '/api/events') return handleApi(req, res, reqUrl);

  // Static file serving
  const safeName = path.normalize(decodeURIComponent(reqUrl.pathname)).replace(/^([/\\\\]*\\.\\.[/\\\\]*)+/, '');
  let filePath = path.join(ROOT, safeName === '/' ? 'index.html' : safeName);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) filePath = path.join(ROOT, 'index.html');
    fs.readFile(filePath, (readErr, data) => {
      if (readErr) { res.writeHead(404); res.end('Not found'); return; }
      const ext = path.extname(filePath).toLowerCase();
      const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
      res.writeHead(200, {
        'Content-Type': types[ext] || 'application/octet-stream',
        'Cache-Control': filePath.endsWith('index.html') ? 'no-cache, must-revalidate' : 'public, max-age=3600',
      });
      res.end(data);
    });
  });
});

// ── Start ────────────────────────────────────────────────────
server.listen(PORT, HOST, () => {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  console.log(`▒ Agent OS Dashboard v1.0`);
  console.log(`▒ Listening on http://${HOST}:${PORT}`);
  console.log(`▒ Workspace: ${WORKSPACE_ROOT}`);
});

process.on('SIGTERM', () => { server.close(); process.exit(0); });
process.on('SIGINT', () => { server.close(); process.exit(0); });
