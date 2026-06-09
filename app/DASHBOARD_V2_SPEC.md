# Agent OS Dashboard v2 — Terminal/Telegram Replacement Spec

## Core Mission
Transform the dashboard from an agent monitoring tool into a full operating environment that replaces:
- **Terminal** — file browsing, code reading, git, command execution
- **Telegram** — unified inbox, cross-platform send
- **OpenClaw CLI** — agent dispatch with real-time streaming, cron management

## Project Location
`/home/admin/.openclaw/workspace/agent-dashboard-deploy/app/`

## What Already Exists
- React + Vite + TypeScript + Tailwind v4 app (10 pages, Sidebar, CommandPalette)
- Server at `../server.js` (544 lines, provides REST APIs, SSE, static serving)
- API client at `src/lib/api.ts` (typed methods for all endpoints)
- Working build pipeline: `npx vite build && cp dist/index.html ../ && cp dist/assets/* ../assets/`
- The app is deployed and running at port 45680

## Architecture Rules
1. **Read ALL existing files before writing** — understand existing patterns, don't break them
2. **Extend `server.js`** with new API endpoints following existing patterns (sendJson, readBody, auth)
3. **All new pages added to Sidebar** with lucide-react icons
4. **All fetch calls use `import { api }`** from `src/lib/api.ts`
5. **SSE integration** for real-time features
6. **Tailwind v4** utility classes only
7. **Zero JS build errors** — `npx vite build` must pass
8. **Build + deploy at end:** `npx vite build && cp dist/index.html ../ && cp dist/assets/* ../assets/`

## Design System (already in `index.css`)
- `--color-bg: #0a0a0a` `--color-surface: #111` `--color-raised: #161616`
- `--color-border: #1e1e1e` `--color-border2: #282828`
- `--color-text: #e0e0e0` `--color-dim: #666` `--color-faint: #444`
- `--color-amber: #d4a017` `--color-green: #00b85a` `--color-red: #c33` `--color-blue: #3b82f6`
- Font: monospace, Icons: lucide-react

---

## Feature 1: Terminal Embed

**Replaces:** SSH, terminal app, running commands remotely

**Server-side — Add to `server.js`:**
```javascript
// POST /api/terminal/exec — run a command and return output
// Body: { command: string, workdir?: string, timeout?: number }
// Response: { output: string, exitCode: number }
if (method === 'POST' && pathname === '/api/terminal/exec') {
    if (!requireAuth(req, res)) return;
    const { command, workdir, timeout } = JSON.parse(await readBody(req));
    // exec with timeout, return stdout+stderr+exitCode
}

// GET /api/workspace/ls?path=... — list directory contents
// Response: { entries: [{ name, type: 'file'|'dir', size, modifiedAt }] }
if (method === 'GET' && pathname === '/api/workspace/ls') {
    if (!requireAuth(req, res)) return;
    // readdirSync + statSync for each entry
}

// GET /api/workspace/read?path=... — read file contents
// Response: { content: string, path: string }
if (method === 'GET' && pathname === '/api/workspace/read') {
    if (!requireAuth(req, res)) return;
    // readFileSync, limit to 100KB
}
```

**Frontend — New page: `Workspace.tsx`** in `src/pages/`
- Tab view with: File Browser | Terminal | Git
- **File Browser tab:** Tree view of workspace directories. Click to expand folders. Click file to open in code viewer. Show file icons for type. Search bar at top.
- **Terminal tab:** Full terminal emulator using a simple input/output pattern. Command input at bottom, scrollable output above. History with arrow keys. Clear button. Working directory display.
- Path safety: sanitize all paths against directory traversal (path.normalize, ensure under ROOT)
- Add to Sidebar nav with `Terminal` icon (lucide)
- Add to types.ts: `'workspace'`
- Add to App.tsx: workspace page route

---

## Feature 2: Git GUI

**Replaces:** `git status`, `git diff`, `git add`, `git commit`, `git push`

**Server-side — Add to `server.js`:**
```javascript
// GET /api/git/status — git status --short
// Response: { branch: string, changes: [{ path, status, staged }], ahead: number, behind: number }
if (method === 'GET' && pathname === '/api/git/status') {
    if (!requireAuth(req, res)) return;
    // exec git commands, parse output
}

// GET /api/git/log?max=10 — recent commits
// Response: { commits: [{ hash, author, date, message }] }

// GET /api/git/diff?path=... — show diff for a file
// Response: { diff: string }

// POST /api/git/commit — commit staged changes
// Body: { message: string }
// Response: { ok: boolean, hash?: string }

// POST /api/git/push — push to remote
// Response: { ok: boolean, output: string }
```

**Frontend — Part of `Workspace.tsx`** (Git tab)
- Git status panel: branch name, ahead/behind count
- Changed files list with status icons (M=modified, A=added, D=deleted, ??=untracked)
- Click a file → show diff view (green/red colored lines)
- Stage all / Stage file / Unstage buttons
- Commit message input + Commit button (only enabled when staged)
- Push button (only enabled when ahead > 0)
- Recent commits list with hash, author, date, message

---

## Feature 3: Unified Inbox

**Replaces:** Telegram app, switching between platforms to check messages

**Server-side — Add to `server.js`:**
```javascript
// GET /api/messages — recent messages from all connected platforms
// Calls openclaw channels status to get channels, then reads from each
// Response: { messages: [{ id, platform, channel, sender, text, timestamp }] }

// POST /api/messages/send — send a message
// Body: { platform: string, target: string, message: string }
// Response: { ok: boolean }

// GET /api/messages/thread?platform=...&channel=...&limit=20
// Response: { messages: [...] }
```

Note: The server.js already imports OPENCLAW_BIN and has exec() utility. Use `openclaw message read --channel <platform> --target channel:<id> --limit 5` and `openclaw message send --channel <platform> --target channel:<id> --message <text>`.

**Frontend — New page: `Inbox.tsx`** in `src/pages/`
- Left panel: channel list (Telegram, Discord, etc. with connection status dots)
- Right panel: message thread for selected channel
- Messages shown as bubbles with sender name, timestamp, platform icon
- Reply input at bottom
- Loading/empty/error states
- Auto-refresh (poll every 10s or SSE)
- Add to Sidebar nav
- Add to types.ts

---

## Feature 4: Agent Real-Time Console

**Replaces:** `openclaw agent --message`, waiting for responses blindly

**Frontend — Enhance `Dispatch.tsx`:**
- Add "Streaming" toggle — when on, results appear token-by-token in the chat
- Use the existing SSE connection to get real-time agent progress
- Show agent "thinking" animation (animated dots or pulse)
- Cancel button on running dispatches
- Conversation history: show ALL previous dispatches to this agent (stored in task history), not just current session
- Add command presets: dropdown with reusable dispatch commands
- Recent tasks section improved with status, timing, response preview

**Server-side — Add endpoint:**
```javascript
// POST /api/agents/dispatch-stream — same as dispatch but pushes SSE events
// Streams: agent-thinking, agent-token, agent-complete, agent-error
```

---

## Feature 5: Cron Job Manager

**Replaces:** `cronjob create/list/remove`, managing schedules from terminal

**Server-side — Add to `server.js`:**
```javascript
// GET /api/cron — list cron jobs (reads from hermes cron state)
// Response: { jobs: [{ id, name, schedule, nextRun, lastRun, lastStatus, enabled }] }

// POST /api/cron — create a cron job
// Body: { name, schedule, prompt, agent?, enabled }
// Response: { id, ... }

// PATCH /api/cron/:id — update job
// Response: { ... }

// DELETE /api/cron/:id — remove job

// POST /api/cron/:id/run — trigger job now

// POST /api/cron/:id/toggle — enable/disable
```

Note: Hermes cron state lives at `~/.hermes/cron/`. Read the cron state files. The `cronjob` CLI exists at `~/.npm-global/bin/hermes cron` or similar.

**Frontend — New page or tab: `Cron.tsx`** in `src/pages/`
- List of all scheduled jobs with: name, schedule expression, next run, last run status
- Create job button → expandable form (name, schedule, prompt, target agent)
- Each job row: toggle enable/disable, run now, edit, delete
- Status badges (ok, failed, pending)
- Last run output preview
- Add to Sidebar nav

---

## Feature 6: Multi-Agent Stream

**Replaces:** Checking agent status blindly, waiting for results

**Frontend — New page: `Stream.tsx`** in `src/pages/`
- Shows ALL agent activity in real-time
- Each agent as a row with: emoji, name, current status (idle/running/done/failed), current task
- When agent runs: show expanding output panel with live text
- Filter by agent, status, time
- Sound notification on completion (optional)
- Add to Sidebar nav

**Server-side — Enhance SSE events:**
The server already has `broadcast('notification', data)`. Add:
- `broadcast('agent-activity', { agent, status, task, output, timestamp })`
- These events fire when tasks are dispatched, agents pick them up, complete, or fail
- This requires the dispatch endpoint to emit after creating the task

---

## Feature 7: Enhanced Command Palette

**Replaces:** Remembering keyboard shortcuts, clicking through menus

**Enhance `CommandPalette.tsx`:**
- `/` prefix triggers commands: `/task "title"`, `/dispatch dev "message"`, `/goal "title"`, `/capture "text"`
- Natural language: "add task 'fix login' to dev" → creates task assigned to dev
- Search across: pages, tasks, projects, goals, captures (already works via /api/search)
- Show keyboard shortcut hints for each action
- Quick actions: "New Task", "New Goal", "New Capture", "Dispatch Agent" — fills in form on the target page
- `?` shows all keyboard shortcuts overlay

---

## Implementation Order

1. **First** — server.js: add workspace/ls, workspace/read, terminal/exec, git/*, messages, cron endpoints
2. **Second** — types.ts: add new page types
3. **Third** — api.ts: add new API client methods
4. **Fourth** — Workspace.tsx: file browser + terminal + git tabs
5. **Fifth** — Inbox.tsx: unified inbox
6. **Sixth** — Cron.tsx: cron job manager
7. **Seventh** — Stream.tsx: multi-agent stream
8. **Eighth** — Enhance Dispatch.tsx: real-time streaming + presets
9. **Ninth** — Enhance CommandPalette.tsx: `/` commands + natural language
10. **Tenth** — Sidebar.tsx: add new nav items
11. **Eleventh** — App.tsx: wire up new pages
12. **Final** — Build and verify

## Non-Negotiable Quality Gates
- Every page loads without console errors
- All API calls have try/catch with error states
- Loading skeletons for all async data
- Empty states with helpful messages
- Path traversal protection on all file endpoints
- Auth required on all new endpoints
- Build succeeds: `npx vite build` with 0 errors
- After deploy: verify with browser check for console errors

## Build and Deploy
```bash
cd /home/admin/.openclaw/workspace/agent-dashboard-deploy/app
npx vite build && cp dist/index.html ../ && cp dist/assets/* ../assets/
```

## Summary of Files to Create/Modify

**NEW files to create:**
- `src/pages/Workspace.tsx` — File Browser + Terminal + Git GUI
- `src/pages/Inbox.tsx` — Unified Inbox
- `src/pages/Cron.tsx` — Cron Job Manager
- `src/pages/Stream.tsx` — Multi-Agent Stream

**EXISTING files to modify:**
- `../server.js` — Add ~10 new API endpoints
- `src/types.ts` — Add 'workspace', 'inbox', 'cron', 'stream' page types
- `src/lib/api.ts` — Add new API client methods for all new endpoints
- `src/components/Sidebar.tsx` — Add new nav items
- `src/App.tsx` — Wire up new pages
- `src/pages/Dispatch.tsx` — Enhance with streaming + presets
- `src/components/CommandPalette.tsx` — Enhance with commands

Read ALL existing source files before writing any code.
