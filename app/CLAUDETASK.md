You are rebuilding the Agent OS dashboard from scratch — a mission control UI for an AI agent orchestration system. Work directory: /home/admin/.openclaw/workspace/agent-dashboard-deploy/app/

## Current state
- Server at server.js (do NOT touch it) provides all APIs
- Dependencies in package.json are installed
- Vite config, tsconfig, index.html entry already exist
- Existing src/ has: main.tsx, App.tsx, index.css, lib/api.ts, components/Sidebar.tsx, pages/Dashboard.tsx, Tasks.tsx, Projects.tsx, Captures.tsx, Logs.tsx, Health.tsx, Settings.tsx

## What to do
Scrap the existing pages and rebuild everything. The API client at src/lib/api.ts has typed methods for all endpoints. Read it first.

## Design System
Dark theme, these CSS colors (already in index.css):
--color-bg: #0a0a0a  --color-surface: #111  --color-raised: #161616
--color-border: #1e1e1e  --color-border2: #282828  --color-text: #e0e0e0
--color-dim: #666  --color-faint: #444  --color-amber: #d4a017
--color-green: #00b85a  --color-red: #c33  --color-blue: #3b82f6

Font: 'SF Mono', 'Fira Code', 'JetBrains Mono', monospace
Icons: lucide-react (already installed)

## Auth
Basic auth: browser prompts automatically, just use normal fetch() calls.
Credentials: admin / Shady#01

## Pages to build

### 1. Sidebar (already exists, enhance it)
- Nav links to all pages with lucide icons
- Notification count badge
- SSE connection status dot (live/reconnecting/off)
- Agent OS branding

### 2. Dashboard (main page)
- 4 KPI cards: pending tasks, in progress, stale, total (from GET /api/tasks/dispatch-health)
- System mini-card: CPU cores, RAM %, disk usage bar, uptime (GET /api/system/resources)
- Agent activity grid: per-agent stats from GET /api/agent-stats (show agent name + completed/failed counts)
- Live notification feed: last 5 from GET /api/notifications, with type icons

### 3. Agent Dispatch
- 5 specialist agent cards: Alex (research), Maya (UX), Jordan (arch), Dev (code), Sam (QA)
- Each card shows: emoji avatar, name, role, completed/failed counts from agent-stats
- Click a card to select that agent
- Text input + Send button → POST /api/agents/dispatch { agent, message }
- Result appears below as a chat message
- Activity log below showing recent dispatches (poll GET /api/tasks?agent=X)
- Make this page feel like a command center

### 4. Tasks
- Create task inline: input + Enter
- List all tasks from GET /api/tasks (reversed, newest first)
- Each row: status dropdown (pending/in_progress/done/failed) → PATCH /api/tasks/:id
- Delete button → DELETE /api/tasks/:id
- Color-coded status badges
- Show agent label if assigned

### 5. Projects
- Create project form (name + description) → POST /api/projects
- Card grid from GET /api/projects
- Status badges (active/completed/archived)

### 6. Captures
- List from GET /api/captures?limit=50
- Show intent tag, text content, timestamp
- Simple read-only browse

### 7. Agent Logs
- Fetch from GET /api/agent-logs?limit=100 (proxies Supabase agent_logs)
- Per entry: agent name, model, status badge (color-coded), task description, timestamp
- Group by date maybe

### 8. System Health
- Resource grid: CPU cores, RAM % with usage bar, Disk with usage bar, uptime (GET /api/system/resources)
- Error feed from GET /api/system/errors — show failed agent logs + failed tasks with red styling
- Empty state: "No recent errors" in green

### 9. Notifications Center
- Bell icon in header/sidebar with unread count badge
- Click opens notification panel (slide-in or dropdown)
- List notifications from GET /api/notifications
- Clear all button → DELETE /api/notifications
- SSE listener for real-time notification events

### 10. Command Palette (⌘K)
- Global keyboard shortcut Cmd+K / Ctrl+K
- Search across page names + query GET /api/search?q=...
- Arrow key navigation + Enter to open
- Show results with type labels

### 11. Settings
- Server status: uptime, memory (GET /api/status)
- Reload button
- Quick links

## Technical requirements
1. SSE integration: listen to /api/events for 'notification' events, push them into notification state
2. All fetch() calls use the api client from lib/api.ts — import { api }
3. Every page must load without JS errors
4. Use Tailwind v4 utility classes (already configured)
5. Preserve the existing build pipeline: npx vite build → cp dist/index.html ../ → cp dist/assets/* ../assets/
6. After you finish, rebuild with: npx vite build && cp dist/index.html ../ && cp dist/assets/* ../assets/

## Build and verify
1. Create all components
2. Run npx vite build — must succeed with 0 errors
3. Copy output to deploy root
4. Tell me when done
