# Agent OS Dashboard v2 — Upgrade Specification

## Project Location
`/home/admin/.openclaw/workspace/agent-dashboard-deploy/app/`

## Current State
- React + Vite + TypeScript + Tailwind v4 app
- 9 pages implemented: Dashboard, Dispatch, Tasks, Projects, Captures, Logs, Health, Notifications, Settings
- Components: Sidebar, CommandPalette
- API client: `src/lib/api.ts` (typed, covers all server endpoints)
- Server at `../server.js` — **DO NOT MODIFY** (serves APIs, SSE, static files)
- Auth: Basic auth (admin / Shady#01) — browser prompts, normal fetch() calls
- Build pipeline: `npx vite build && cp dist/index.html ../ && cp dist/assets/* ../assets/`

## What to Do
Read ALL existing source files first (src/), then enhance and extend the app. Do not scrap what exists — build on top of it with significant improvements.

## Mandatory Technical Requirements
1. Read existing files before writing anything — understand the patterns
2. All fetch calls use `import { api }` from `src/lib/api.ts`
3. SSE integration: listen to `/api/events` for real-time notifications
4. Zero JS build errors — `npx vite build` must pass
5. Tailwind v4 utility classes only
6. Build and deploy: `npx vite build && cp dist/index.html ../ && cp dist/assets/* ../assets/`
7. Every page must load without JS errors

## Design System (already in `index.css`)
- `--color-bg: #0a0a0a` `--color-surface: #111` `--color-raised: #161616`
- `--color-border: #1e1e1e` `--color-border2: #282828`
- `--color-text: #e0e0e0` `--color-dim: #666` `--color-faint: #444`
- `--color-amber: #d4a017` `--color-green: #00b85a` `--color-red: #c33` `--color-blue: #3b82f6`
- `--color-a-soft: #d4a01714` `--color-g-soft: #00b85a14`
- Font: monospace (SF Mono, Fira Code, JetBrains Mono)
- Icons: lucide-react (already installed)

## Enhancements to Each Page

### 1. Dashboard (Mission Control)
**Current:** KPI cards, system card, notifications mini-feed, agent activity grid
**Enhance:**
- Add a task trend chart (last 7 days completed/failed using Chart.js or a simple inline SVG — Chart.js CDN is available from the v1 app precedent)
- Add agent completion pie/ring chart or use simple colored bars
- Add "quick actions" row: buttons for New Task, New Capture, New Goal, Dispatch Agent
- Show workspace stats (total projects, total captures, total goals from their APIs — you'll need to fetch `api.goals.list()` — already exists in api.ts)
- Add a "Recent Activity" feed that combines recent tasks + notifications + agent logs chronologically
- Add hover states on everything for polish
- Show tooltips on KPI cards explaining what each metric means

### 2. Agent Dispatch
**Current:** 5 agent cards, chat input, send button, result display, recent tasks
**Enhance:**
- Add system-style "typing indicator" when dispatching (already partially done)
- Show agent status badges (online/offline/busy — infer from stats: if running > 0, busy)
- Add command history sidebar or toggle — show previous dispatches to this agent
- Add keyboard shortcut: Cmd+Enter to send
- Agent cards should show animated pulse when busy (running > 0)
- Add "Quick Commands" dropdown for each agent (common tasks — "Research X", "Review PR", "Check health")
- Show dispatch response time / acknowledgment
- Add a "Copy result" button on system responses
- Better empty states with helpful suggestions

### 3. Tasks
**Current:** Inline create, status dropdown, delete, agent label
**Enhance:**
- Add inline search/filter bar (filter by status, agent, text search)
- Add priority field support (low/medium/high with color-coded badges) — check if server stores it; if not, add it to the form
- Add task count badges in the header
- Add bulk actions (select multiple, batch status change, batch delete)
- Add sidebar filters: "All", "Pending", "In Progress", "Done", "Failed" with counts
- Improve date display with relative timestamps ("2h ago", "yesterday")
- Add expandable task detail view (click to see full description, metadata)

### 4. Projects
**Current:** Create form, card grid, status badges
**Enhance:**
- Add delete/archive button on project cards
- Add project detail clickable cards (expand to show more info)
- Show task count per project (fetch tasks and count by project if server supports, or just show total tasks)
- Add in-line status change (click badge to cycle through active/completed/archived)
- Better card layout with descriptions, timestamps, and progress indicator

### 5. Captures
**Current:** List with intent tag, text, timestamp
**Enhance:**
- Add create capture form (inline expandable)
- Add filter by intent tag
- Add search within captures
- Show preview text (truncate long content with "read more")
- Better visual hierarchy — group by intent or date
- Add copy-to-clipboard on each capture

### 6. Agent Logs
**Current:** Fetch from Supabase agent_logs, date grouping, color-coded status
**Enhance:**
- Add model column/badge
- Add search/filter by agent name
- Add time range filter (last hour, today, this week, all)
- Show run duration if available
- Better empty state when Supabase is not configured (the server returns 503)
- Add "retry" action for failed tasks
- Add export button to copy log data as JSON

### 7. System Health
**Current:** CPU/RAM/Disk bars, error feed
**Enhance:**
- Add auto-refresh toggle (poll every 10s when enabled)
- Add last checked timestamp
- Add process list (fetch from server — if no endpoint, show just the resource data)
- Show load average trend with mini sparkline (simple CSS bars are fine)
- Better empty state for errors: "No recent errors — system healthy" with green styling
- Add network info (hostname, platform from system resources)
- Show memory usage over time with a simple trend indicator (just show multiple data points)

### 8. Notifications
**Current:** Bell badge, SSE push, clear all, mark read
**Enhance:**
- Add notification type icons (error=red, warning=amber, success=green, info=blue)
- Add dismiss single notification button
- Add "mark all read" button alongside "clear all"
- Better slide-in/transition animation
- Group similar notifications
- Show notification count in page header
- Add timestamp display

### 9. Settings
**Current:** Server uptime, memory, reload button
**Enhance:**
- Add environment info display (Node version, platform, hostname)
- Show data store sizes (read the JSON files and display file sizes, item counts)
- Add server config display (show which features are enabled — Supabase configured?, feature flags)
- Add link to open workspace docs directory
- Show active stores list with item counts (tasks, projects, captures, goals, notifications)
- Better layout with organized sections

### 10. Goals Page — NEW
**Purpose:** Manage strategic goals (CRUD)
**API:** `api.goals.list()`, `api.goals.create()` already exist in api.ts
**Build:**
- Create form (title + description)
- Card/list view of all goals with status badges
- Inline status toggle
- Delete goal button
- Show description text on cards

### 11. Ideas / Content Studio Page — NEW
**Purpose:** Browse content ideas from the contentIdeas store
**Note:** The server has a `contentIdeas` store but no API endpoint. You'll need to add endpoints to server.js:
- `GET /api/ideas` — list ideas (same pattern as projects)
- `POST /api/ideas` — create idea
- `PATCH /api/ideas/:id` — update idea status
- `DELETE /api/ideas/:id` — delete idea
**Frontend:**
- Card grid showing ideas with title, summary, status
- Create form
- Status badges (draft, published, archived)
- Search/filter

### 12. Goals → Link to Tasks
**Enhancement:** On the Goals page, allow linking a goal to one or more tasks. Show related tasks beneath each goal.

## Quality Standards
- Every page loads without JS console errors
- All API calls wrapped in try/catch with error states
- Loading skeletons (pulse animation) for all async data
- Empty states with helpful messages
- Hover states on clickable elements
- Consistent spacing and alignment
- No horizontal scroll on any page
- Keyboard shortcuts documented (Cmd+K for palette already works)
- Mobile-responsive layout (stack on small screens)
- Color-coded status badges everywhere
- Toast/notification for successful actions

## Build and Deploy
After completing all changes:
```bash
cd /home/admin/.openclaw/workspace/agent-dashboard-deploy/app
npx vite build
cp dist/index.html ../
cp dist/assets/* ../assets/
```

Then verify by opening http://100.110.151.53:45680/ in a browser and checking for JS errors.

## Final Check
- No console errors on any page
- All API endpoints tested via actual fetch
- Loading states visible during data fetch
- Error states when API fails
- All existing functionality preserved
- Build succeeds with 0 errors
