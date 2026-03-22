# ClawView — Full Engineering Audit Report

---

## 1. Architecture Summary

**ClawView** is a mobile-first PWA transparency console for OpenClaw AI Agent. It translates OpenClaw's engineering-level logs and session data into a user-friendly dashboard showing: agent status, task step flow, cost tracking, memory governance, alerts, and human-in-the-loop approval.

**Tech stack (actual, not what docs claim):**
- **Frontend**: React 19 + Vite 6 + plain CSS (NOT Tailwind CSS 4, NOT shadcn/ui — despite docs claiming both)
- **Backend**: Hono 4 + @hono/node-server + pino logger
- **Shared types**: Zod validators + TypeScript interfaces in `packages/shared`
- **Monorepo**: pnpm workspaces with corepack
- **No database**: No SQLite, no Drizzle ORM, no Turso (despite docs claiming all three)
- **State**: TanStack Query for server state, Zustand for client state
- **Realtime**: SSE (Server-Sent Events) via event bus pattern

**Data sources:**
- `mock` mode: hardcoded mock data in `mock-data.service.ts`
- `openclaw` mode: reads files from `~/.openclaw` directory via `openclaw-files.adapter.ts`

---

## 2. Intended Runtime Workflow

1. User runs launch script or `pnpm dev`
2. Server starts on port 8787, loads config from env vars (with Zod validation + defaults)
3. Vite dev server starts on port 5173, proxies `/api` to the backend
4. Frontend fetches `/api/v1/dashboard` to get initial data
5. Frontend opens SSE connection to `/api/v1/realtime/events` for live updates
6. Server publishes mock tick events every 12 seconds (or OpenClaw snapshot events in openclaw mode)
7. Dashboard renders: status, task flow, costs, memory, alerts, approvals

---

## 3. Critical Issues Preventing Execution

### CRITICAL-1: `TaskFlowPanel` crashes on empty `tasks` array (THE PRIMARY BLOCKER)

**Location**: `apps/web/src/app/dashboard-page.tsx` line ~54 + `apps/web/src/features/task-flow/components/task-flow-panel.tsx`

**Symptom**: User sees "页面发生错误，请刷新重试。" — a blank error page.

**Mechanism**:

```52:52:apps/web/src/app/dashboard-page.tsx
        <TaskFlowPanel task={tasks[0]} />
```

When the API returns `tasks: []` (which happens in `openclaw` mode because the adapter cannot find sessions), `tasks[0]` is `undefined`. The `TaskFlowPanel` component does NOT handle this:

```8:13:apps/web/src/features/task-flow/components/task-flow-panel.tsx
interface TaskFlowPanelProps {
  task: TaskExecutionLog;
}

export function TaskFlowPanel({ task }: TaskFlowPanelProps) {
  return (
```

It immediately accesses `task.userPromptSummary`, `task.status`, and `task.steps`, which throws `TypeError: Cannot read properties of undefined`. The `ErrorBoundary` catches this and renders the fallback, killing the entire page.

**Browser console error confirmed:**
```
TypeError: Cannot read properties of undefined (reading 'userPromptSummary')
The above error occurred in the <TaskFlowPanel> component.
React will try to recreate this component tree from scratch using the error boundary you provided, ErrorBoundary.
```

### CRITICAL-2: OpenClaw adapter targets a non-existent directory structure

**Location**: `apps/server/src/adapters/openclaw-files.adapter.ts`

**What the adapter expects:**
- `~/.openclaw/sessions/` — directory with session subdirectories, each containing `transcript.jsonl`
- `~/.openclaw/MEMORY.md`
- `~/.openclaw/memory/*.md`

**What actually exists at `~/.openclaw/`:**
- `agents/main/sessions/` — sessions are nested two levels deeper
- Session transcripts are flat `.jsonl` files (e.g., `48c18ab8-....jsonl`), NOT subdirectories
- There is also a `sessions.json` metadata file
- No `MEMORY.md` or `memory/` directory at root
- No matching structure at any level

This means in `openclaw` mode, the adapter silently finds nothing: `tasks: []`, `memory: []`. This triggers CRITICAL-1.

---

## 4. Additional Issues Found

### HIGH

**HIGH-1: Hono error handler middleware does not actually send error responses**

```7:22:apps/server/src/middleware/error-handler.middleware.ts
export async function errorHandler(c: Context, next: Next): Promise<void> {
  try {
    await next();
  } catch (error) {
    if (error instanceof ClawViewError) {
      c.status(error.httpStatus as StatusCode);
      c.json({
        error: {
          code: error.code,
          message: error.message,
        },
      });
      return;
    }
    // ...
  }
}
```

In Hono v4, `c.json()` creates and **returns** a `Response` object — calling it without returning it discards the response. The middleware returns `void`, so the client gets an empty/default response instead of the JSON error. The correct pattern is `return c.json(...)`.

**HIGH-2: `.env` file is not loaded by Node.js**

The server uses `configSchema.parse(process.env)` but there is no `dotenv` package. When running `pnpm dev` directly (not via launch scripts), env vars from `.env` are NOT loaded. The server silently falls back to Zod defaults (`mock` mode). Only the launch scripts explicitly pass env vars.

**HIGH-3: The `.env` has inconsistent `CLAWVIEW_ALLOWED_ORIGIN`**

The `.env` file currently has `CLAWVIEW_ALLOWED_ORIGIN=http://localhost:5173`, but `.env.example` has `http://localhost:3000`. The launch script always rewrites it to `http://localhost:5173`. In Docker mode (port 3000), the CORS origin would need to be `http://localhost:3000`. The awk script in `write_env_file` always writes `http://localhost:5173` regardless of mode.

### MEDIUM

**MEDIUM-1: No `tailwind-merge`, no Tailwind CSS 4, no shadcn/ui**

The `.cursorrules` and docs claim "React 19 + Vite 6 + Tailwind CSS 4 + shadcn/ui". None of these are installed or used. The project uses plain CSS in `styles.css`. The docs and rules are aspirational, not reflective of reality.

**MEDIUM-2: No database layer exists**

Docs claim "Drizzle ORM + SQLite/Turso". There is zero database code. All data is either mock or read from the filesystem.

**MEDIUM-3: `react-router-dom` is installed but never used**

Listed as a dependency in `apps/web/package.json` but never imported. The app is a single-page dashboard with no routing.

**MEDIUM-4: `narrative-rules.yaml` is not loaded by any code**

The file `apps/server/narrative-rules.yaml` exists but is never referenced or loaded. Narrative generation is hardcoded in the adapter's `buildNarrative()` function.

**MEDIUM-5: Real-time SSE `mergeRealtimePayload` handler has incomplete type coverage**

The `use-realtime.ts` handler handles `cost_update` expecting `event.payload` to be `CostSnapshot[]`, but the server's mock tick event publishes a single `TaskExecutionLog` as payload for `step_update` events. The `cost_update` and other event types are never actually published by the server.

### LOW

**LOW-1: `pnpm` is not globally installed**

Running `pnpm dev` directly fails with "command not found: pnpm". Must use `corepack pnpm dev` or set `COREPACK_HOME`. The README documents this but it's a friction point.

**LOW-2: The `biome check .` lint command may trigger deprecation warnings from esbuild**

pnpm shows: "Ignored build scripts: @biomejs/biome, esbuild. Run `pnpm approve-builds`..."

**LOW-3: Docker Compose bootstrap script has fragile auto-install logic**

The `bootstrap-clawview.sh` uses `osascript` for macOS dialogs, `brew install --cask docker`, and attempts to auto-start Docker Desktop. This is inherently unreliable across different macOS configurations and security policies.

---

## 5. Reproduced Failure Points

| # | Command | Result | Error |
|---|---------|--------|-------|
| 1 | `pnpm dev` | FAIL | `command not found: pnpm` |
| 2 | `corepack pnpm install` | PASS | Dependencies install correctly |
| 3 | `corepack pnpm build` | PASS | All 3 packages compile, Vite builds |
| 4 | `corepack pnpm typecheck` | PASS | All 3 packages typecheck |
| 5 | `corepack pnpm dev` (mock mode) | Server starts, frontend crashes | `TaskFlowPanel` crash (but mock mode has tasks, so crash only happens if data shape changes) |
| 6 | Launch script with `CLAWVIEW_DATA_SOURCE=openclaw` | Server starts, API returns `tasks: []` | Frontend crashes on empty tasks |
| 7 | Open `http://localhost:5173` after launch script | **BLANK ERROR PAGE** | "页面发生错误，请刷新重试。" |

**The exact failure reproduction:**
1. User runs `./scripts/launch-local-clawview.sh` (or double-clicks `launch-local-clawview.command`)
2. Script sets `CLAWVIEW_DATA_SOURCE=openclaw` and starts both servers
3. Browser opens `http://localhost:5173`
4. Frontend fetches `/api/v1/dashboard`
5. Server returns `{ data: { tasks: [], ... } }` (empty tasks because adapter can't find sessions)
6. `DashboardPage` renders `<TaskFlowPanel task={undefined} />`
7. `TaskFlowPanel` tries to access `undefined.userPromptSummary` → `TypeError`
8. `ErrorBoundary` catches → shows "页面发生错误，请刷新重试。"
9. User sees a blank page with an error message

---

## 6. Root Cause Analysis

The project fails due to a **chain of two interacting bugs**, both classic AI-generated code problems:

**Root Cause A — Hallucinated filesystem structure**: The `openclaw-files.adapter.ts` was written against an imagined OpenClaw directory layout (`sessions/` at root, with subdirectories per session). The real OpenClaw stores sessions at `agents/main/sessions/` as flat `.jsonl` files. The adapter silently returns empty data.

**Root Cause B — No null-safety on `tasks[0]`**: The `DashboardPage` passes `tasks[0]` directly to `TaskFlowPanel` without checking if tasks exist. In mock mode this works (mock always has tasks). In openclaw mode it crashes because `tasks` is empty.

**These two bugs together make the primary user flow (launch with real OpenClaw data) completely broken.** The app starts, the API works, but the frontend crashes on render because the data is empty.

**Contributing factors:**
- The error boundary is too coarse — it wraps the entire app, so one component crash kills everything
- No `.env` loading means dev mode always falls back to mock (hiding the openclaw bug during development)
- The adapter has no tests and no fallback for unrecognized directory structures

---

## 7. Proposed Repair Plan

### Phase A — Make the frontend resilient (15 min, fixes the crash)

1. **Guard `tasks[0]` in `DashboardPage`**: Add a null check before rendering `TaskFlowPanel`. If no tasks, show an appropriate empty state.
2. **Make `TaskFlowPanel` accept `task: TaskExecutionLog | undefined`**: Render an empty state card when task is undefined.

This alone makes the app stop crashing, even with empty data.

### Phase B — Fix the OpenClaw adapter (30-45 min, makes real data work)

1. **Discover the real OpenClaw directory layout**: Map `~/.openclaw/agents/main/sessions/*.jsonl` and related paths.
2. **Update path resolution in the adapter**: Change `sessions/` to `agents/main/sessions/`, handle flat `.jsonl` files instead of subdirectories with `transcript.jsonl`.
3. **Parse the actual `.jsonl` format**: Read a real session file, understand its event schema, and update `TranscriptEvent` interface accordingly.
4. **Find the real memory storage**: Check if OpenClaw has equivalent memory files elsewhere in its directory tree.

### Phase C — Fix the error handler middleware (5 min)

1. Change `c.json(...)` to `return c.json(...)` in both catch branches of `error-handler.middleware.ts`.

### Phase D — Add `.env` loading for dev mode (5 min)

1. Install `dotenv` and call `dotenv.config()` at the top of `apps/server/src/index.ts`, or use Vite's env loading for the frontend.

### Phase E — Cleanup (15 min, optional)

1. Remove unused `react-router-dom` dependency.
2. Update docs/rules to reflect actual tech stack (no Tailwind, no shadcn/ui, no Drizzle/SQLite).
3. Load `narrative-rules.yaml` or remove it.
4. Add granular error boundaries around individual panels instead of one global boundary.

**Repair order**: A → B → C → D → E

**Estimated total time**: ~1-2 hours for A-D (minimum viable fix), plus optional cleanup.

---

## 8. Risk Assessment

| Dimension | Assessment |
|-----------|-----------|
| **Architecture salvageability** | The architecture is fundamentally sound. The monorepo structure, type sharing, SSE realtime pattern, and mock/adapter separation are well designed. The codebase is clean and well-organized. |
| **Code quality** | Surprisingly good for AI-generated code. TypeScript strict mode is enforced, Zod validation is used correctly, the component hierarchy is clean, and naming is consistent. |
| **Blocker severity** | LOW to fix. The two critical bugs (null guard + adapter paths) are straightforward repairs, not architectural rewrites. |
| **Data layer risk** | MEDIUM. The OpenClaw adapter was built on assumptions. The real `.jsonl` format needs to be reverse-engineered from actual files to build a correct parser. |
| **Security** | LOW risk. No auth is implemented (docs mention zero-trust, but no auth code exists). For a local-only tool, this is acceptable for MVP. |
| **Mock mode viability** | WORKS TODAY with the `tasks[0]` null guard fix. Mock mode always has data, so only the missing guard is needed. |
| **Is the project worth fixing vs. rewriting?** | **Definitely worth fixing.** The repairs are surgical. The codebase is clean. Rewriting would be wasteful — 90%+ of the code is correct. |

**Bottom line**: Two bugs, both in data handling at the frontend-backend boundary. Fix the null guard and the adapter paths, and the project runs.