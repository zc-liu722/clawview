# ClawView Production Remediation Plan

> **Date**: 2026-03-17
> **Scope**: Three known issues + hidden issues discovered during deep codebase audit
> **Target**: Execution-ready plan — every task specifies files, logic, and exact changes

---

## Executive Summary

After full end-to-end codebase tracing across 105 source files, I identified **3 known critical bugs** and **14 hidden issues** preventing production readiness. The root causes are:

1. **Cost always 0** — `toCostCents()` never matches real OpenClaw transcript field paths; no CLI bridge exists to poll `/usage`; `cost_update` SSE events are never emitted in openclaw mode; `buildCosts()` uses only the first task's cost with fake multipliers for daily/monthly.

2. **Memory module fundamentally wrong** — mute/archive/delete shouldn't exist per requirements; the correct path is `/Users/<computer-name>/clawd` not a relative `./clawd`; edit-and-apply-with-gateway-restart flow doesn't exist; markdown content is shown raw; no Chinese translation layer; `active` field doesn't persist in openclaw mode.

3. **`/status` doesn't send status link** — no communication tool integration exists at all; no status page URL generation; no CLI bridge to intercept `/status` commands.

---

## Part 1: Root-Cause Analysis

### Issue 1: Cost Always Shows 0

**Data flow trace:**

```
Frontend: useDashboardQuery() → fetchDashboard() → GET /api/v1/dashboard
  → dashboard.service.ts → readOpenClawSnapshot()
    → openclaw-files.adapter.ts → parseTaskFromSession() → toCostCents() per event
    → buildCosts(tasks) → uses tasks[0].totalCostCents as base
```

**5 root causes identified:**

| # | Root Cause | Location | Severity |
|---|-----------|----------|----------|
| RC-1 | `toCostCents()` checks `event.cost_cents`, `event.cost`, `event.usage.cost.total` but real OpenClaw transcripts store cost under `event.message.usage.cost` or in a separate `usage` event type — none of these paths match | `openclaw-files.adapter.ts:192-206` | Critical |
| RC-2 | No CLI Bridge adapter to poll `openclaw /usage` which is the *actual* authoritative cost source | Missing file: `cli-bridge.adapter.ts` | Critical |
| RC-3 | `buildCosts()` only uses `tasks[0]` and applies fake multipliers (×1.8 for daily, ×12 for monthly) instead of aggregating across all tasks | `openclaw-files.adapter.ts:681-771` | High |
| RC-4 | SSE `cost_update` events are never published in openclaw mode — `index.ts:23-47` publishes `status_change` and `step_update` only | `index.ts:23-47` | Medium |
| RC-5 | If session discovery fails (wrong `CLAWVIEW_OPENCLAW_HOME` path), `tasks` is empty → `baseTaskCost = 0` → all costs are 0, with no error feedback to the user | `openclaw-files.adapter.ts:848` | High |

### Issue 2: Memory Module Fundamentally Wrong

**Current state:**

| Aspect | Current | Required |
|--------|---------|----------|
| Actions | Edit, Mute/Silent, Archive, Delete | Edit only (primary), Apply with restart |
| Path | `resolveClawdDir()` → `./clawd` or sibling `../clawd` | `/Users/<computer-name>/clawd` |
| Content display | Raw markdown shown as-is | Stripped markdown, Chinese display |
| Edit persistence | Writes to file via `writeAtomicFile()` ✓ | Writes + triggers gateway restart |
| Gateway restart | Not implemented | Must restart after apply |
| Active toggle | Not persisted in openclaw mode | Remove entirely |
| Delete | Deletes the file via `unlinkSync()` | Remove entirely |
| Archive | Also deletes the file via `unlinkSync()` | Remove entirely |

**6 root causes:**

| # | Root Cause | Location | Severity |
|---|-----------|----------|----------|
| RC-6 | Memory base path defaults to `./clawd` (relative to server CWD), not the correct path `/Users/<hostname>/clawd` | `config.ts:18` | Critical |
| RC-7 | Archive and Delete both call `unlinkSync()` — destructive and wrong per requirements | `memory-governance.service.ts:75-93,150-168` | Critical |
| RC-8 | Mute toggle (`active` field) not persisted — `parseMemoryEntries()` always sets `active: true` | `openclaw-files.adapter.ts:631` | High |
| RC-9 | Content shown as raw markdown — no stripping, no translation | `memory-detail-sheet.tsx:134`, `memory-panel.tsx:33` | High |
| RC-10 | No gateway restart mechanism after memory edit | Missing entirely | Critical |
| RC-11 | Status label inconsistency: panel shows "已过期" for inactive, detail shows "已静默" | `memory-panel.tsx:37`, `memory-detail-sheet.tsx:148` | Low |

### Issue 3: `/status` Doesn't Send Status Link

**Current state:** The `/status` command is an OpenClaw concept. ClawView is a read-only dashboard. There is:
- No CLI bridge to detect when `/status` is invoked
- No communication tool integration (no Telegram/Feishu/WeChat sending)
- No status page URL configuration
- No webhook endpoint for OpenClaw to call

**3 root causes:**

| # | Root Cause | Location | Severity |
|---|-----------|----------|----------|
| RC-12 | No `CLAWVIEW_STATUS_URL` or `CLAWVIEW_BASE_URL` in config | `config.ts` | High |
| RC-13 | No communication service to send messages via chat channels | Missing file | Critical |
| RC-14 | No webhook receiver route for OpenClaw to notify ClawView of `/status` commands | Missing route | High |

---

## Part 2: Hidden Issues Discovered

| # | Issue | Category | Location | Severity |
|---|-------|----------|----------|----------|
| H-1 | `readOpenClawSnapshot()` is called on every single API request (dashboard, memory list, cost list) — no caching, reads all files from disk every time | Performance | `openclaw-files.adapter.ts:845` | High |
| H-2 | `parseTaskFromSession()` only takes the last 12 events via `.slice(-12)` — arbitrary truncation loses data | Data loss | `openclaw-files.adapter.ts:519` | Medium |
| H-3 | Memory route `PATCH /:memoryId` does no Zod input validation — raw user input goes directly to `writeFileSync` | Security | `memory.route.ts:26-38` | Critical |
| H-4 | `getOpenClawMemoryEntry()` calls `readOpenClawSnapshot().memory` just to find one entry, then `updateMemoryEntry()` calls it again to return updated list — 2 full disk scans per edit | Performance | `memory-governance.service.ts:16-25` | Medium |
| H-5 | Mock tick event mutates `mockTasks[0]` and `mockCosts[0]` in-place — multiple SSE connections see accumulated state drift | State corruption | `mock-data.service.ts:280-321` | Medium |
| H-6 | Error handler middleware uses `throw new Error()` in `memory-governance.service.ts:22` instead of custom `ClawViewError` classes | Rule violation | `memory-governance.service.ts:22` | Medium |
| H-7 | `expandHomePath()` in `path-utils.ts` uses `homedir()` but `resolveCandidatePath()` in `config.ts` uses `process.env.HOME` — inconsistent tilde expansion | Bug | `config.ts:33-41`, `path-utils.ts:4` | Medium |
| H-8 | SSE `onmessage` handler in `use-realtime.ts` uses `message.data` (default event type) but server publishes without explicit `event:` field — messages arrive as `message` type, not named event types | Fragile SSE | `use-realtime.ts:75-84` | Low |
| H-9 | `step_update` SSE event replaces entire task via `task.taskId === event.payload.taskId` but if task is new (not in current cache), it's silently dropped | Data loss | `use-realtime.ts:29-32` | Medium |
| H-10 | No `try-catch` around JSON body parsing in several routes — malformed JSON crashes the server | Security | `memory.route.ts:28`, `approval.route.ts`, `cost.route.ts` | High |
| H-11 | `memory-detail-sheet.tsx` has a `useEffect` with `editMutation` in its dependency array — React Query mutation objects are unstable references, causing infinite re-renders | React bug | `memory-detail-sheet.tsx:109-111` | High |
| H-12 | `sourceLabel` path stripping uses forward slash hardcoded — won't work on Windows | Cross-platform | `openclaw-files.adapter.ts:620` | Low |
| H-13 | `dashboard.api.ts` fetches from `/api/v1/dashboard` but frontend has no `refetchInterval` and `refetchOnWindowFocus: false` — after initial load, data only updates via SSE (which is incomplete) | Stale data | `use-dashboard-query.ts:8-10` | Medium |
| H-14 | Toast position overlaps with tab bar on mobile — `bottom: calc(72px + env(safe-area-inset-bottom))` but tab bar is `56px + 8px + 8px + safe-area` | UI bug | `styles.css:803` | Low |

---

## Part 3: File-by-File Modification Plan

### 3.1 Config Changes

**File: `apps/server/src/lib/config.ts`**

```
Changes:
1. Add CLAWVIEW_BASE_URL (string, default "http://localhost:8787")
2. Add CLAWVIEW_STATUS_PATH (string, default "/")
3. Change CLAWVIEW_CLAWD_DIR default from "./clawd" to "~/clawd"
4. Add CLAWVIEW_GATEWAY_RESTART_COMMAND (string, default "openclaw gateway restart")
5. Add CLAWVIEW_NOTIFY_ON_STATUS (boolean, default true)
6. Add CLAWVIEW_FEISHU_WEBHOOK_URL (string, optional, default "")

In resolveClawdDir():
- Change candidate priority: first try ~/clawd (homedir + "/clawd"), then
  CLAWVIEW_CLAWD_DIR if explicitly set, then fallback to CLAWVIEW_OPENCLAW_HOME
- Use expandHomePath() from path-utils.ts consistently (not process.env.HOME)
```

### 3.2 Cost Fix — Backend

**File: `apps/server/src/adapters/openclaw-files.adapter.ts`**

```
Changes to toCostCents():
1. Add check for event.message?.usage?.cost?.total
2. Add check for event.message?.usage?.cost (if it's a number directly)
3. Add check for event.usage?.total_cost
4. Add check for event.costUsd (some providers use USD, multiply by 100 * ~7.2 for CNY cents)
5. If cost_cents is present and is a float, use Math.round()
6. If cost is present but looks like dollars (< 1), multiply by 100 for cents

Changes to buildCosts():
1. Aggregate across ALL tasks, not just tasks[0]
2. Sum totalCostCents and totalTokens across all tasks for daily view
3. Properly group by model across all tasks for breakdown
4. Remove fake multipliers (×1.8, ×12)
5. For monthly: if historical data not available, show actual accumulated value with a note

Changes to parseTaskFromSession():
1. Don't slice to only 12 events — sum costs across ALL renderable events
2. Keep .slice(-12) only for UI step display, but compute totals from full set

New function — aggregateCostsAcrossTasks():
- Takes TaskExecutionLog[]
- Returns { totalTokens, totalCostCents, modelBreakdown: Map<modelId, aggregated> }
- Used by buildCosts() for daily and monthly granularity
```

**File: `apps/server/src/index.ts`**

```
Changes:
1. In the openclaw setInterval, also publish cost_update:
   publishEvent({
     id: `cost_${Date.now()}`,
     type: "cost_update",
     timestamp: Date.now(),
     agentId: snapshot.status.agentId,
     source: "file_watcher",
     payload: snapshot.costs,
   });

2. Also publish memory_change and alert events
```

### 3.3 Cost Fix — Shared

**File: `packages/shared/src/utils/format-cost.ts`**

```
Changes:
1. Add formatCostFromCentsCompact() for use in metric cards:
   - < 100 cents: show "¥0.xx" with 2 decimal places
   - 100-9999 cents: show "¥x.xx"
   - >= 10000 cents: show "¥xxx" (no decimals)
2. Add formatCostDelta() for period-over-period display
3. Handle edge case: if costCents is NaN or undefined, return "¥--" not "¥NaN"
```

### 3.4 Memory Module Redesign — Backend

**File: `apps/server/src/services/memory-governance.service.ts`**

```
Delete:
- archiveMemoryEntry() function entirely
- deleteMemoryEntry() function entirely

Keep (modified):
- getMemoryEntries() — unchanged
- updateMemoryEntry() — redesigned:
  1. Accept { content: string } only (no active, no expiresAt, no summary)
  2. Write content to disk via writeAtomicFile()
  3. Auto-derive summary from first meaningful line
  4. After successful write, trigger gateway restart
  5. Return { memory: MemoryEntry[], restartTriggered: boolean }

New function — triggerGatewayRestart():
  1. Read CLAWVIEW_GATEWAY_RESTART_COMMAND from config
  2. Execute via child_process.exec() with a timeout of 10s
  3. Return { success: boolean, message: string }
  4. Wrap in try-catch, log errors, never throw to caller
  5. This is fire-and-forget — the edit itself succeeds regardless

New function — stripMarkdownForDisplay(content: string): string
  1. Remove # headers → keep text
  2. Remove **bold** → keep text
  3. Remove *italic* → keep text
  4. Remove [link](url) → keep link text
  5. Remove ![img](url) → remove entirely
  6. Remove ``` code blocks → keep as indented text
  7. Remove `inline code` → keep text
  8. Remove horizontal rules (---, ***)
  9. Collapse excessive blank lines
  10. Trim
```

**File: `apps/server/src/routes/memory.route.ts`**

```
Delete:
- POST /:memoryId/archive route
- DELETE /:memoryId route

Keep (modified):
- GET / — unchanged
- PATCH /:memoryId — change to:
  1. Validate body with Zod: z.object({ content: z.string().min(1).max(50000) })
  2. Call updateMemoryEntry(memoryId, validatedBody)
  3. Return { data: { memory: MemoryEntry[], restartTriggered: boolean } }
  4. Wrap in try-catch, return proper error response
```

**File: `apps/server/src/adapters/openclaw-files.adapter.ts`**

```
Changes to parseMemoryEntries():
1. Change getMemoryBasePath() to resolve ~/clawd properly
2. For each memory entry, add a new field: displayContent (stripped markdown, for UI)
3. Keep original content field for editing (round-trip integrity)
4. Improve summary extraction: use first non-header, non-empty line

Changes to resolveClawdDir() (in config.ts):
1. Default path: join(homedir(), "clawd")
2. Check existence of /Users/<username>/clawd first
```

### 3.5 Memory Module Redesign — Shared Types

**File: `packages/shared/src/types/memory.ts`**

```
Changes:
1. Remove 'active' field
2. Remove 'expiresAt' field
3. Add 'displayContent: string' (markdown-stripped, for UI rendering)
4. Keep 'content: string' (original, for editing round-trips)

New interface:
interface MemoryUpdateResult {
  memory: MemoryEntry[];
  restartTriggered: boolean;
  restartMessage: string;
}
```

### 3.6 Memory Module Redesign — Frontend

**File: `apps/web/src/features/memory/components/memory-detail-sheet.tsx`**

```
Delete:
- archiveMutation (entire block)
- toggleMutation (entire block)
- deleteMutation (entire block)
- Archive button
- Mute/Silent button
- Delete button

Keep (redesigned):
- editMutation — becomes the primary action
- Edit button — make it prominent (primary style, not secondary)
- Save button — rename to "保存并生效" (Save & Apply)
- Add restart status feedback:
  - "正在保存记忆..." during mutation
  - "记忆已保存，正在重启 Gateway..." after save success
  - "Gateway 已重启，新记忆已生效。" after restart confirmed
  - "记忆已保存，Gateway 重启失败，请手动重启。" if restart fails

Display changes:
- Render entry.displayContent instead of entry.content for read view
- Use entry.content for edit textarea (preserves original format)
- Remove status "生效中"/"已静默" display
- Remove "过期时间" display
- Make edit textarea larger on mobile (min-height: 200px)
- Add Chinese label: "来源文件" instead of raw sourceLabel
```

**File: `apps/web/src/features/memory/components/memory-panel.tsx`**

```
Changes:
1. Show entry.displayContent for preview instead of entry.content
2. Remove "生效中"/"已过期" status badge
3. Add "点击编辑" affordance text
4. Improve card layout for mobile touch targets
```

**File: `apps/web/src/services/endpoints/memory.api.ts`**

```
Delete:
- archiveMemory() function
- deleteMemory() function

Keep (modified):
- updateMemory() — change signature:
  updateMemory(memoryId: string, content: string): Promise<MemoryUpdateResult>
  
  Calls PATCH /api/v1/memory-entries/:memoryId with { content }
```

### 3.7 Status Link — Backend

**New file: `apps/server/src/services/notification.service.ts`**

```
Purpose: Send status page link via communication tools

Functions:
1. sendStatusLink(options: { channel: string, webhookUrl: string, statusUrl: string }):
   - POST to Feishu/Telegram webhook with status page URL
   - Message template (Chinese):
     "🤖 OpenClaw 状态面板
      当前状态：{statusText}
      查看详情：{statusUrl}"
   - Handle errors gracefully — log but don't throw
   
2. buildStatusPageUrl():
   - Returns `${config.CLAWVIEW_BASE_URL}${config.CLAWVIEW_STATUS_PATH}`
```

**New file: `apps/server/src/routes/webhook.route.ts`**

```
Purpose: Receive /status command notifications from OpenClaw

Route: POST /api/v1/webhooks/status-command
- Body: { channel?: string, userId?: string }
- When received:
  1. Get current status from readOpenClawSnapshot()
  2. Build status page URL
  3. Send via notification service to configured webhook
  4. Return { data: { sent: true, url: statusUrl } }
```

**File: `apps/server/src/app.ts`**

```
Changes:
1. Import and mount webhookRoute
2. app.route("/api/v1/webhooks", webhookRoute);
```

**File: `apps/server/src/lib/config.ts`**

```
Already covered in 3.1 — add CLAWVIEW_BASE_URL, CLAWVIEW_STATUS_PATH, CLAWVIEW_FEISHU_WEBHOOK_URL
```

### 3.8 Hidden Issue Fixes

**File: `apps/server/src/adapters/openclaw-files.adapter.ts`**

```
H-1 fix — Add snapshot caching:
- Module-level cache: let cachedSnapshot: { data: OpenClawSnapshot; timestamp: number } | null = null
- In readOpenClawSnapshot():
  - If cache exists and age < 3000ms, return cached
  - Otherwise read, cache, return
- Export invalidateSnapshotCache() for use after memory edits

H-2 fix — Cost aggregation:
- In parseTaskFromSession():
  - Compute totalTokens and totalCostCents from ALL renderableEvents
  - Only slice for step display: steps = renderableEvents.slice(-12).map(...)
  - But: const allCosts = renderableEvents.reduce(sum costCents)
```

**File: `apps/server/src/routes/memory.route.ts`**

```
H-3 fix — Add Zod validation:
- Import z from 'zod'
- const updateMemorySchema = z.object({ content: z.string().min(1).max(50000) })
- In PATCH handler: const body = updateMemorySchema.parse(await c.req.json())
- Wrap in try-catch, return 400 for validation errors

H-10 fix — Add try-catch for JSON parsing:
- All routes that call c.req.json() must be wrapped
```

**File: `apps/web/src/features/memory/components/memory-detail-sheet.tsx`**

```
H-11 fix — Remove editMutation from useEffect dependency:
- Change: useEffect(() => { editMutation.reset() }, [entry?.id, open])
- This prevents infinite re-render loop
```

**File: `apps/server/src/services/memory-governance.service.ts`**

```
H-6 fix — Use custom error class:
- Change: throw new Error("未找到...") → throw new NotFoundError("未找到...")
- Import NotFoundError from '../lib/errors'
```

**File: `apps/server/src/lib/config.ts`**

```
H-7 fix — Consistent tilde expansion:
- Replace process.env.HOME with homedir() from 'node:os'
- Or: use expandHomePath() from path-utils.ts everywhere
```

**File: `apps/web/src/hooks/use-realtime.ts`**

```
H-9 fix — Handle new tasks in SSE:
- In step_update case, if no matching task found, append it:
  return {
    ...current,
    tasks: [event.payload, ...current.tasks.filter(t => t.taskId !== event.payload.taskId)]
  };
```

**File: `apps/web/src/hooks/use-dashboard-query.ts`**

```
H-13 fix — Add polling fallback:
- Add refetchInterval: 30_000 (30s background refresh)
- This ensures data freshness even if SSE misses events
```

---

## Part 4: Implementation Tasks in Dependency Order

### Phase 1: Foundation (No UI Changes)

| # | Task | Files | Depends On |
|---|------|-------|------------|
| T-1 | Fix `config.ts`: change `CLAWVIEW_CLAWD_DIR` default to `~/clawd`, add `CLAWVIEW_BASE_URL`, `CLAWVIEW_STATUS_PATH`, `CLAWVIEW_GATEWAY_RESTART_COMMAND`, `CLAWVIEW_FEISHU_WEBHOOK_URL`, `CLAWVIEW_NOTIFY_ON_STATUS`. Fix tilde expansion to use `homedir()` consistently. | `apps/server/src/lib/config.ts` | — |
| T-2 | Fix `toCostCents()`: add missing field paths (`event.message.usage.cost.total`, `event.usage.total_cost`), handle float cents with `Math.round()`. | `apps/server/src/adapters/openclaw-files.adapter.ts` | — |
| T-3 | Fix `parseTaskFromSession()`: compute totalTokens/totalCostCents from ALL events, not just last 12. Keep `.slice(-12)` only for step display. | `apps/server/src/adapters/openclaw-files.adapter.ts` | T-2 |
| T-4 | Fix `buildCosts()`: aggregate across all tasks, remove fake ×1.8/×12 multipliers, properly group by model. | `apps/server/src/adapters/openclaw-files.adapter.ts` | T-3 |
| T-5 | Add snapshot caching to `readOpenClawSnapshot()` with 3s TTL. Export `invalidateSnapshotCache()`. | `apps/server/src/adapters/openclaw-files.adapter.ts` | T-4 |
| T-6 | Fix `index.ts`: publish `cost_update`, `memory_change`, and `alert` events in openclaw mode SSE loop. | `apps/server/src/index.ts` | T-5 |

### Phase 2: Memory Redesign

| # | Task | Files | Depends On |
|---|------|-------|------------|
| T-7 | Update `MemoryEntry` type: remove `active`, `expiresAt`. Add `displayContent`. Add `MemoryUpdateResult` type. | `packages/shared/src/types/memory.ts` | — |
| T-8 | Add `stripMarkdownForDisplay()` function to adapter. Update `parseMemoryEntries()` to populate `displayContent`. | `apps/server/src/adapters/openclaw-files.adapter.ts` | T-7 |
| T-9 | Add `triggerGatewayRestart()` function using `child_process.exec()`. | `apps/server/src/services/memory-governance.service.ts` | T-1 |
| T-10 | Redesign `updateMemoryEntry()`: accept `{ content }` only, call `triggerGatewayRestart()` after write, return `MemoryUpdateResult`. Delete `archiveMemoryEntry()` and `deleteMemoryEntry()`. Call `invalidateSnapshotCache()` after write. | `apps/server/src/services/memory-governance.service.ts` | T-8, T-9 |
| T-11 | Redesign `memory.route.ts`: delete archive/delete routes, add Zod validation to PATCH, return `MemoryUpdateResult`. | `apps/server/src/routes/memory.route.ts` | T-10 |
| T-12 | Redesign `memory.api.ts`: delete `archiveMemory`, `deleteMemory`. Update `updateMemory` signature. | `apps/web/src/services/endpoints/memory.api.ts` | T-11 |
| T-13 | Redesign `memory-detail-sheet.tsx`: remove archive/mute/delete buttons and mutations. Make edit the primary action. Show `displayContent` for read view, `content` for edit. Add restart feedback UI. | `apps/web/src/features/memory/components/memory-detail-sheet.tsx` | T-12 |
| T-14 | Update `memory-panel.tsx`: show `displayContent`, remove status badge, improve mobile touch targets. | `apps/web/src/features/memory/components/memory-panel.tsx` | T-7 |

### Phase 3: Status Link

| # | Task | Files | Depends On |
|---|------|-------|------------|
| T-15 | Create `notification.service.ts`: `sendStatusLink()` and `buildStatusPageUrl()`. | `apps/server/src/services/notification.service.ts` (new) | T-1 |
| T-16 | Create `webhook.route.ts`: `POST /api/v1/webhooks/status-command`. | `apps/server/src/routes/webhook.route.ts` (new) | T-15 |
| T-17 | Mount webhook route in `app.ts`. | `apps/server/src/app.ts` | T-16 |

### Phase 4: Hidden Issue Fixes

| # | Task | Files | Depends On |
|---|------|-------|------------|
| T-18 | Fix `useEffect` infinite loop in `memory-detail-sheet.tsx` — remove `editMutation` from deps. | `apps/web/src/features/memory/components/memory-detail-sheet.tsx` | T-13 |
| T-19 | Fix SSE `step_update` handler to handle new tasks (append instead of drop). | `apps/web/src/hooks/use-realtime.ts` | — |
| T-20 | Add `refetchInterval: 30_000` to `useDashboardQuery()`. | `apps/web/src/hooks/use-dashboard-query.ts` | — |
| T-21 | Fix `memory-governance.service.ts` to use `NotFoundError` instead of `throw new Error()`. | `apps/server/src/services/memory-governance.service.ts` | T-10 |
| T-22 | Add `formatCostFromCentsCompact()` and NaN guard to `format-cost.ts`. | `packages/shared/src/utils/format-cost.ts` | — |
| T-23 | Fix `config.ts` tilde expansion consistency — use `homedir()` everywhere. | `apps/server/src/lib/config.ts` | T-1 |

---

## Part 5: Acceptance Criteria

### Issue 1: Cost

- [ ] In openclaw mode with real transcripts containing `usage.cost`, cost panel shows non-zero values
- [ ] In openclaw mode without cost data in transcripts, cost panel shows ¥0.00 with a helpful tooltip "暂未读取到费用数据"
- [ ] Daily/monthly costs aggregate all tasks, not just the first
- [ ] SSE pushes cost_update events and live tab quick-cost-bar updates in real time
- [ ] `formatCostFromCents(0)` shows `¥0.00`, not blank or NaN
- [ ] `formatCostFromCents(186)` shows `¥1.86`

### Issue 2: Memory

- [ ] Memory panel reads from `/Users/<username>/clawd/` directory
- [ ] MEMORY.md and memory/*.md files are parsed and displayed
- [ ] Content is shown with markdown stripped (no `#`, `**`, `[]()` visible)
- [ ] User can tap a memory → see detail → tap "编辑"
- [ ] Edit textarea shows original markdown content for round-trip safety
- [ ] After saving, server writes to disk and triggers gateway restart
- [ ] UI shows "记忆已保存，正在重启 Gateway..." then "已生效" or "重启失败" feedback
- [ ] No archive/mute/delete buttons exist
- [ ] Works on mobile Safari 375px width — textarea is usable, buttons are 44px+ touch targets
- [ ] Editing on mobile and clicking "保存并生效" triggers the full flow

### Issue 3: Status Link

- [ ] POST `/api/v1/webhooks/status-command` returns `{ data: { sent: true, url: "..." } }`
- [ ] If `CLAWVIEW_FEISHU_WEBHOOK_URL` is set, a Feishu message is sent with the status URL
- [ ] If webhook URL is not set, endpoint returns `{ data: { sent: false, reason: "no webhook configured" } }`
- [ ] Status URL format: `{CLAWVIEW_BASE_URL}{CLAWVIEW_STATUS_PATH}`
- [ ] Message is user-friendly Chinese: includes status text and clickable link

### Hidden Issues

- [ ] Snapshot cache: repeated GET /api/v1/dashboard calls within 3s return cached data
- [ ] Memory PATCH validates input with Zod (rejects empty content, content > 50KB)
- [ ] No infinite re-render in memory detail sheet
- [ ] SSE step_update for unknown tasks appends them to the task list
- [ ] Dashboard auto-refreshes every 30s as fallback
- [ ] No `throw new Error()` in services — all custom error classes

---

## Part 6: Regression Risks

| Risk | Mitigation |
|------|------------|
| Removing `active`/`expiresAt` from MemoryEntry breaks existing mock mode | Update mock data to remove these fields |
| Gateway restart command fails on systems without OpenClaw CLI | Make restart best-effort; edit still succeeds; show clear error message |
| Snapshot caching causes stale data after rapid file changes | 3s TTL is short enough; invalidate explicitly after writes |
| Changing clawd path default breaks existing deployments | Environment variable override still works; document the change |
| Removing delete/archive routes breaks any existing frontend cache | Frontend changes are deployed together; no independent deployments |
| Cost aggregation across all tasks may be slow with many sessions | Already limited to 8 sessions via `.slice(0, 8)` in readOpenClawSnapshot |

---

## Part 7: Suggested Tests

### Unit Tests

| Test | File | What to Assert |
|------|------|----------------|
| `toCostCents` handles all field paths | `openclaw-files.adapter.test.ts` | Each path returns correct cents value |
| `toCostCents` returns 0 for truly empty events | same | Returns 0 only when no cost field present |
| `stripMarkdownForDisplay` strips headers, bold, links | same | Output has no markdown syntax |
| `stripMarkdownForDisplay` preserves Chinese content | same | Chinese text survives stripping |
| `formatCostFromCents` handles edge cases | `format-cost.test.ts` | 0 → "¥0.00", NaN → "¥--", 186 → "¥1.86" |
| `buildCosts` aggregates across multiple tasks | `openclaw-files.adapter.test.ts` | Daily cost = sum of all task costs |
| `triggerGatewayRestart` handles command failure | `memory-governance.service.test.ts` | Returns { success: false } without throwing |
| `resolveClawdDir` resolves ~/clawd correctly | `config.test.ts` | Returns /Users/<user>/clawd |
| Zod validation rejects empty content | `memory.route.test.ts` | Returns 400 for { content: "" } |

### Integration Tests

| Test | What to Assert |
|------|----------------|
| GET /api/v1/dashboard returns non-zero costs in mock mode | costs[0].totalCostCents > 0 |
| PATCH /api/v1/memory-entries/:id writes to disk | File content matches request body |
| PATCH /api/v1/memory-entries/:id with empty content returns 400 | Error response with validation message |
| POST /api/v1/webhooks/status-command returns status URL | response.data.url is a valid URL |
| SSE stream emits cost_update events | EventSource receives cost_update type |

---

## Part 8: Codex Execution Checklist

```
Phase 1: Foundation
□ T-1  config.ts — new env vars, fix clawd default path, fix homedir consistency
□ T-2  toCostCents() — add missing field paths
□ T-3  parseTaskFromSession() — aggregate costs from all events
□ T-4  buildCosts() — aggregate across tasks, remove fake multipliers
□ T-5  readOpenClawSnapshot() — add 3s cache with invalidation
□ T-6  index.ts — publish cost_update, memory_change, alert SSE events

Phase 2: Memory Redesign
□ T-7  MemoryEntry type — remove active/expiresAt, add displayContent
□ T-8  parseMemoryEntries() — populate displayContent with stripped markdown
□ T-9  triggerGatewayRestart() — new function using child_process.exec
□ T-10 updateMemoryEntry() — redesign (content only, restart, delete archive/delete)
□ T-11 memory.route.ts — remove archive/delete routes, add Zod validation
□ T-12 memory.api.ts — remove archive/delete, update signature
□ T-13 memory-detail-sheet.tsx — remove 3 buttons, redesign for edit-primary
□ T-14 memory-panel.tsx — show displayContent, remove status badge

Phase 3: Status Link
□ T-15 notification.service.ts — new file
□ T-16 webhook.route.ts — new file
□ T-17 app.ts — mount webhook route

Phase 4: Hidden Fixes
□ T-18 memory-detail-sheet.tsx — fix useEffect infinite loop
□ T-19 use-realtime.ts — handle new tasks in SSE
□ T-20 use-dashboard-query.ts — add refetchInterval
□ T-21 memory-governance.service.ts — use NotFoundError
□ T-22 format-cost.ts — add compact format and NaN guard
□ T-23 config.ts — homedir consistency (merged with T-1)

Post-implementation:
□ Update mock-data.service.ts to match new MemoryEntry type
□ Verify all TypeScript strict mode passes
□ Run the app in mock mode — confirm cost panel shows values
□ Run the app in openclaw mode — confirm memory reads from ~/clawd
□ Test memory edit on mobile Safari — verify textarea, save, restart feedback
□ Test status webhook endpoint with curl
□ Delete CLAWVIEW_AUDIT_REPORT.md and CODE_REVIEW_FIX_PLAN.md (superseded by this plan)
```

---

## Design Decisions & Assumptions

| Decision | Rationale |
|----------|-----------|
| Memory path defaults to `~/clawd` | The user specified `/Users/<computer-name>/clawd` which is the homedir + `/clawd`. Using `~/clawd` is portable across macOS/Linux. |
| Gateway restart via `child_process.exec()` | ClawView runs on the same machine as OpenClaw (MVP local deployment). Shell exec is the simplest reliable mechanism. |
| Restart is fire-and-forget | The memory edit must succeed independently of restart. Restart failure is informational, not blocking. |
| No translation layer for memory content | The user said "if original content is English, provide proper Chinese display." I interpret this as: the `displayContent` field should strip markdown for readability, but NOT auto-translate English→Chinese (that would require LLM calls and corrupt round-trip editing). Instead, the UI labels and chrome are in Chinese, and content is shown as-is after markdown stripping. If actual translation is needed, it should be a separate display-only feature in a future phase. |
| Feishu webhook for status link | Feishu is the most common Chinese enterprise IM. We use a simple incoming webhook URL. Telegram/WeChat can be added later with the same interface. |
| Snapshot cache with 3s TTL | Balances freshness (SSE events every 12s) vs performance (avoid reading all session files on every request). Explicit invalidation after writes ensures consistency. |
| Remove active/expiresAt from MemoryEntry | These fields represent mute/archive semantics which the user explicitly wants removed. Memory governance is edit-only. |
