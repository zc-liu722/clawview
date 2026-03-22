# ClawView — Implementation Plan

> Maps `docs/ux_design.md` to the existing codebase without redesigning architecture.
> Every file path, component, and API call is grounded in what already exists.

---

## Current State Assessment

The app is a **single scrollable dashboard** (`DashboardPage`) rendering six feature panels vertically. There is no tab navigation, no routing, no bottom sheets, no expand/collapse interactions, and no animated status light. Data flows through a single `GET /api/v1/dashboard` endpoint, with SSE merging into the same TanStack Query cache.

```
Current:  App → MobileLayout → DashboardPage → [StatusPanel, TaskFlowPanel, CostPanel, MemoryPanel, AlertsPanel, ApprovalPanel]
Target:   App → MobileLayout → TabShell → [LiveTab | TasksTab | CostTab | MemoryTab | AlertsTab]
```

---

## Phase 1 — Tab Navigation

Transform the single-page dashboard into a tabbed control console.

### Files to create

#### `apps/web/src/components/ui/tab-bar.tsx`

- **Change**: New presentational component — the fixed-bottom 5-tab navigation bar.
- **Component structure**:
  ```
  TabBar
  ├── props: { activeTab, onTabChange, badges }
  ├── renders 5 TabBarItem children (Live, Tasks, Cost, Memory, Alerts)
  └── each item: icon + label + optional badge (count or dot)
  ```
- **Styling**: Fixed bottom, 56px height, `safe-area-inset-bottom` padding, 44×44px touch targets.
- **API calls**: None — pure presentational.

#### `apps/web/src/stores/navigation.store.ts`

- **Change**: New Zustand store for client-side tab state.
- **Component structure**:
  ```
  NavigationState
  ├── activeTab: 'live' | 'tasks' | 'cost' | 'memory' | 'alerts'
  ├── setActiveTab(tab)
  └── badge counts derived from dashboard data (computed in consuming hooks)
  ```
- **API calls**: None — client state only.

#### `apps/web/src/app/tab-shell.tsx`

- **Change**: New container that replaces `DashboardPage` as the primary layout child. Owns the tab switching logic and conditionally renders the correct tab view.
- **Component structure**:
  ```
  TabShell
  ├── reads activeTab from navigation.store
  ├── reads dashboardQuery from useDashboardQuery
  ├── renders: loading skeleton | error state | active tab content
  ├── renders: <TabBar /> fixed at bottom
  └── renders: <ConnectionBanner /> when SSE is disconnected
  ```
- **API calls**: Uses existing `useDashboardQuery()` — no new endpoints.

#### `apps/web/src/app/tabs/live-tab.tsx`

- **Change**: New tab view composing `StatusPanel` + `TaskFlowPanel` + inline `ApprovalBanner` + quick cost summary.
- **Component structure**:
  ```
  LiveTab
  ├── props: { status, activeTask, costs, approvals }
  ├── <StatusHeader />  (extracted from StatusPanel)
  ├── <ApprovalBanner /> (conditional, pinned top)
  ├── <TaskFlowPanel task={activeTask} />
  └── <QuickCostBar costs={costs} onTap → switch to Cost tab />
  ```
- **API calls**: None — data from parent via props.

#### `apps/web/src/app/tabs/tasks-tab.tsx`

- **Change**: New tab view showing task history list with detail drill-down.
- **Component structure**:
  ```
  TasksTab
  ├── props: { tasks }
  ├── task status filter chips (All / Running / Completed / Failed)
  ├── <TaskList> with virtual scrolling for >50 items
  └── tapping a task opens <TaskDetailSheet />
  ```
- **API calls**: None initially — data from dashboard query. Phase 3 adds per-task fetch.

#### `apps/web/src/app/tabs/cost-tab.tsx`

- **Change**: New tab view wrapping `CostPanel` with period selector and budget settings.
- **Component structure**:
  ```
  CostTab
  ├── props: { costs }
  └── <CostPanel costs={costs} /> (enhanced in Phase 4)
  ```
- **API calls**: None initially — data from dashboard query.

#### `apps/web/src/app/tabs/memory-tab.tsx`

- **Change**: New tab view wrapping `MemoryPanel` with search bar.
- **Component structure**:
  ```
  MemoryTab
  ├── props: { memory }
  └── <MemoryPanel memory={memory} /> (enhanced in Phase 5)
  ```
- **API calls**: None initially — data from dashboard query.

#### `apps/web/src/app/tabs/alerts-tab.tsx`

- **Change**: New tab view combining `ApprovalPanel` (pinned top) + `AlertsPanel` (scrollable).
- **Component structure**:
  ```
  AlertsTab
  ├── props: { alerts, approvals }
  ├── Section 1: <ApprovalPanel approvals={approvals} />  (pending only, pinned)
  └── Section 2: <AlertsPanel alerts={alerts} />  (enhanced in Phase 6)
  ```
- **API calls**: None — data from parent via props.

### Files to modify

#### `apps/web/src/app/App.tsx`

- **Change**: Replace `<DashboardPage />` with `<TabShell />` inside `<MobileLayout>`.

#### `apps/web/src/app/layouts/mobile-layout.tsx`

- **Change**: Add `padding-bottom: 56px` (tab bar height) to `page-content` to prevent content from hiding behind the fixed tab bar. Add `safe-area-inset-bottom` support.

#### `apps/web/src/styles.css`

- **Change**: Add styles for `.tab-bar`, `.tab-bar-item`, `.tab-bar-badge`, `.connection-banner`. Adjust `.page-content` bottom padding. Move `.toast-stack` to `bottom: 72px` (above tab bar).

#### `apps/web/src/app/dashboard-page.tsx`

- **Change**: Keep file but refactor to be a simple re-export or delete in favor of `tab-shell.tsx`. The `ToastViewport` component moves into `tab-shell.tsx` or `App.tsx`.

---

## Phase 2 — Live Tab Interaction

Make the Live tab feel like a real-time control console.

### 2A — Animated Status Light

#### Files to create

##### `apps/web/src/components/composed/status-light.tsx`

- **Change**: New component replacing the `StatusBadge` pill in the Live tab header with an animated dot.
- **Component structure**:
  ```
  StatusLight
  ├── props: { status: AgentStatusCode, className? }
  ├── 12px circle with status-specific color
  ├── CSS animation class per status:
  │   ├── online → subtle pulse (2s ease-in-out, opacity 0.7→1.0)
  │   ├── thinking → breathing (1.5s, scale 0.9→1.1)
  │   ├── tool_calling → spinning ring (1s rotation)
  │   ├── awaiting_approval → double-pulse (0.8s)
  │   ├── degraded → slow blink (3s)
  │   ├── offline → static, no animation
  │   └── error → fast blink (0.5s)
  └── box-shadow glow matching status color
  ```
- **API calls**: None — pure presentational.

##### `apps/web/src/features/status/components/status-header.tsx`

- **Change**: New compact header component extracted from `StatusPanel`, designed for the Live tab top bar (64px fixed height).
- **Component structure**:
  ```
  StatusHeader
  ├── props: { status: AgentStatus, onSettingsTap }
  ├── left: <StatusLight /> + agent name
  ├── center: statusText (14px, dynamic)
  ├── right: settings gear icon (24px, 44×44px touch target)
  └── bottom row: connected channels as chips
  ```
- **API calls**: None — data via props.

### 2B — Step Flow Expansion

#### Files to modify

##### `apps/web/src/features/task-flow/components/task-flow-panel.tsx`

- **Change**: Add expand/collapse per step. Currently each step renders `narrative + meta` in a flat `timeline-item`. Add:
  - `expandedStepId` local state (`useState<string | null>`)
  - Tapping a completed/failed step toggles expansion
  - Expanded view shows: `rawEventType`, `toolName`, `modelName`, full `durationMs`, `costCents` breakdown, `errorMessage` (if failed)
  - Running step is always visually highlighted (accent left border + background tint)
  - Auto-scroll behavior: track `userHasScrolled` ref. If `false`, scroll to latest step on new SSE update. If `true`, show "Jump to latest" floating button.
- **Component structure** (updated):
  ```
  TaskFlowPanel
  ├── props: { task?: TaskExecutionLog }
  ├── state: expandedStepId, userHasScrolled
  ├── task header: prompt summary + duration + cost + status pill
  ├── step list:
  │   └── StepItem (per step)
  │       ├── collapsed: dot + narrative + time
  │       ├── expanded: + rawEventType + tool + model + tokens + cost + duration + error
  │       └── running: highlighted bg + pulse dot + "streaming..." label
  └── "Jump to latest ↓" FAB (conditional)
  ```
- **API calls**: None — data via props from SSE-updated TanStack Query cache.

#### `apps/web/src/styles.css`

- **Change**: Add styles for `.timeline-item-expanded`, `.timeline-item-active`, `.jump-to-latest-fab`, step expand/collapse transition (200ms ease-in-out), active step highlight (left-border accent + background tint).

### 2C — Approval Banner

#### Files to create

##### `apps/web/src/features/approval/components/approval-banner.tsx`

- **Change**: New component for the slide-in approval banner in the Live tab. Distinct from the full `ApprovalPanel` in the Alerts tab.
- **Component structure**:
  ```
  ApprovalBanner
  ├── props: { approval: ApprovalRequest | null, onApprove, onDeny, isPending }
  ├── if no pending approval: render nothing
  ├── slide-in animation (400ms spring) when approval appears
  ├── left border: 4px solid risk-level color (amber for high, red for critical)
  ├── background: risk-level color at 10% opacity
  ├── content: actionLabel + reason + countdown timer
  ├── actions: Approve (green) + Deny (red), full-width, 48px height
  └── countdown: derived from expiresAt, updates every second via setInterval
  ```
- **API calls**: Calls existing `submitApprovalDecision` from `approval.api.ts` via parent callback props.

##### `apps/web/src/features/approval/hooks/use-approval-countdown.ts`

- **Change**: New hook that takes `expiresAt` timestamp and returns `{ remainingMs, remainingText, isExpired }`, updating every second.
- **Component structure**: Custom hook with `setInterval` + cleanup.
- **API calls**: None.

#### Files to modify

##### `apps/web/src/features/approval/components/approval-panel.tsx`

- **Change**: Minor — add visual distinction between pending vs. resolved approvals. Resolved approvals show decision + timestamp. No structural refactor needed since this component already handles approve/deny mutations.

---

## Phase 3 — Task Detail

Add task history browsing and drill-down detail view.

### Files to create

#### `apps/web/src/components/ui/bottom-sheet.tsx`

- **Change**: New reusable bottom sheet overlay component. Used by Task Detail, Memory Detail, and Budget Settings.
- **Component structure**:
  ```
  BottomSheet
  ├── props: { open, onClose, title?, children }
  ├── backdrop: semi-transparent overlay, tap to close
  ├── sheet: slides up from bottom (350ms spring), max-height 85vh
  ├── drag handle: 36×4px pill at top, swipe-down to close
  ├── content: scrollable children area
  └── focus trap when open
  ```
- **API calls**: None — pure presentational.

#### `apps/web/src/features/task-flow/components/task-list.tsx`

- **Change**: New component for the Tasks tab — renders the full list of tasks (not just the active one).
- **Component structure**:
  ```
  TaskList
  ├── props: { tasks: TaskExecutionLog[], onSelectTask }
  ├── filter chips: All | Running | Completed | Failed (local state)
  ├── filtered list rendering:
  │   └── TaskListItem (per task)
  │       ├── left: status dot (color by task.status)
  │       ├── center: userPromptSummary + step count + source channel
  │       ├── right: totalCostCents formatted + relative time
  │       └── tap → onSelectTask(task)
  └── empty state: "No tasks yet" with guidance text
  ```
- **API calls**: None — data via props.

#### `apps/web/src/features/task-flow/components/task-detail-sheet.tsx`

- **Change**: New component wrapping `BottomSheet` with full task detail.
- **Component structure**:
  ```
  TaskDetailSheet
  ├── props: { task: TaskExecutionLog | null, open, onClose }
  ├── <BottomSheet open={open} onClose={onClose}>
  │   ├── task header: prompt + status pill + duration + total cost
  │   ├── full step timeline (reuses step rendering from TaskFlowPanel)
  │   ├── cost breakdown: model-by-model (reuses MetricCard)
  │   └── error section (if task.status === 'failed')
  └── </BottomSheet>
  ```
- **API calls**: None initially. Future: `GET /api/v1/tasks/:taskId` for lazy-loaded step detail.

#### `apps/web/src/features/task-flow/hooks/use-task-filter.ts`

- **Change**: New hook encapsulating the filter chips logic.
- **Component structure**:
  ```
  useTaskFilter(tasks)
  ├── state: activeFilter ('all' | 'running' | 'completed' | 'failed')
  ├── returns: { filteredTasks, activeFilter, setFilter }
  └── filters tasks array by status
  ```
- **API calls**: None — pure client-side filtering.

### Files to modify

#### `apps/web/src/app/tabs/tasks-tab.tsx` (created in Phase 1)

- **Change**: Wire up `TaskList` + `TaskDetailSheet` with local `selectedTask` state.
- **Component structure** (updated):
  ```
  TasksTab
  ├── props: { tasks }
  ├── state: selectedTask (TaskExecutionLog | null)
  ├── <TaskList tasks={tasks} onSelectTask={setSelectedTask} />
  └── <TaskDetailSheet task={selectedTask} open={!!selectedTask} onClose={() => setSelectedTask(null)} />
  ```

#### `apps/web/src/styles.css`

- **Change**: Add `.bottom-sheet-*` styles (backdrop, sheet container, drag handle, slide animation), `.task-list-item` styles, `.filter-chips` styles.

### Server-side (future, not MVP-blocking)

#### `apps/server/src/routes/tasks.route.ts` (to create later)

- **Change**: New route `GET /api/v1/tasks/:taskId` returning a single `TaskExecutionLog` with full steps. Currently tasks are embedded in the dashboard payload, which suffices for MVP.

---

## Phase 4 — Cost Dashboard

Enhance the Cost tab with period switching, budget progress, and model detail expansion.

### Files to create

#### `apps/web/src/components/ui/segmented-control.tsx`

- **Change**: New presentational component for the period selector (Task | Today | Month).
- **Component structure**:
  ```
  SegmentedControl<T>
  ├── props: { options: { value: T, label: string }[], selected: T, onChange }
  ├── renders horizontal pill group with active indicator
  └── 44px height, full-width, rounded corners
  ```
- **API calls**: None.

#### `apps/web/src/components/composed/budget-bar.tsx`

- **Change**: New component showing budget progress as a visual bar.
- **Component structure**:
  ```
  BudgetBar
  ├── props: { budget: BudgetStatus, label: string, onTap? }
  ├── renders: progress bar (filled portion colored by threshold)
  │   ├── <50%: emerald
  │   ├── 50-80%: amber
  │   └── >80%: red
  ├── text: "¥X.XX / ¥Y.YY (ZZ%)"
  └── tappable → opens budget settings
  ```
- **API calls**: None.

#### `apps/web/src/features/cost/components/cost-settings-sheet.tsx`

- **Change**: New bottom sheet for editing budget limits.
- **Component structure**:
  ```
  CostSettingsSheet
  ├── props: { open, onClose, currentBudgets }
  ├── <BottomSheet>
  │   ├── Daily budget input (number, ¥ prefix)
  │   ├── Monthly budget input (number, ¥ prefix)
  │   ├── Alert threshold selector (50% | 80% | 100%)
  │   └── Save button → POST /api/v1/costs/budget
  └── </BottomSheet>
  ```
- **API calls**: New — `POST /api/v1/costs/budget` (to create).

#### `apps/web/src/services/endpoints/cost.api.ts`

- **Change**: New API endpoint file for cost-specific operations.
- **Functions**:
  ```
  updateBudget(options: { dailyLimitCents, monthlyLimitCents, alertThresholdPercent })
    → POST /api/v1/costs/budget
  ```

### Files to modify

#### `apps/web/src/features/cost/components/cost-panel.tsx`

- **Change**: Add period selector (`SegmentedControl`) at top. Show `BudgetBar` for the selected period. Make model breakdown rows expandable (tap to show input/output token split, avg cost per call). Add period-over-period change indicator ("+12%" or "−5%").
- **Component structure** (updated):
  ```
  CostPanel
  ├── props: { costs: CostSnapshot[] }
  ├── state: selectedGranularity ('task' | 'daily' | 'monthly'), expandedModelId, showSettings
  ├── <SegmentedControl> for period
  ├── Hero cost number (28px, bold)
  ├── <BudgetBar> for selected period
  ├── Model breakdown list (expandable rows):
  │   └── ModelRow
  │       ├── collapsed: name + cost + call count
  │       └── expanded: + input tokens + output tokens + avg cost per call
  ├── Task cost list (when granularity is 'daily' or 'monthly')
  └── <CostSettingsSheet open={showSettings} />
  ```

#### `apps/web/src/styles.css`

- **Change**: Add `.segmented-control`, `.budget-bar`, `.budget-bar-fill`, `.cost-hero`, `.model-row-expanded` styles.

### Server-side

#### `apps/server/src/routes/cost.route.ts`

- **Change**: Add `POST /budget` endpoint for saving budget settings.

#### `apps/server/src/services/cost-tracker.service.ts`

- **Change**: Add `updateBudget()` function that persists budget limits (in-memory for MVP, DB for V2).

---

## Phase 5 — Memory Governance

Upgrade memory from a simple list with archive buttons to a full governance console.

### Files to create

#### `apps/web/src/features/memory/components/memory-search-bar.tsx`

- **Change**: New sticky search bar at the top of the Memory tab.
- **Component structure**:
  ```
  MemorySearchBar
  ├── props: { query, onQueryChange }
  ├── input with search icon, clear button
  ├── debounced onChange (300ms)
  └── sticky position at top of memory list
  ```
- **API calls**: None — filtering happens client-side via parent.

#### `apps/web/src/features/memory/components/memory-detail-sheet.tsx`

- **Change**: New bottom sheet showing full memory detail + governance actions.
- **Component structure**:
  ```
  MemoryDetailSheet
  ├── props: { entry: MemoryEntry | null, open, onClose, onAction }
  ├── <BottomSheet>
  │   ├── Summary (large text)
  │   ├── Source reference
  │   ├── Usage stats: hit count display, last used (relative time)
  │   ├── Status indicator (active / muted / expiring / archived)
  │   ├── Tags (future — not in current MemoryEntry type)
  │   ├── Action buttons:
  │   │   ├── Mute — "Don't use but keep" → PATCH /api/v1/memory-entries/:id
  │   │   ├── Set expiry — date/time picker → PATCH /api/v1/memory-entries/:id
  │   │   ├── Archive → existing POST /api/v1/memory-entries/:id/archive
  │   │   └── Delete → DELETE /api/v1/memory-entries/:id (with confirmation dialog)
  └── </BottomSheet>
  ```
- **API calls**: Existing `archiveMemory` + new `updateMemory`, `deleteMemory`.

#### `apps/web/src/features/memory/hooks/use-memory-search.ts`

- **Change**: New hook for client-side memory filtering.
- **Component structure**:
  ```
  useMemorySearch(memories: MemoryEntry[])
  ├── state: query (string)
  ├── returns: { query, setQuery, filteredMemories }
  └── filters by summary content match (case-insensitive)
  ```
- **API calls**: None.

#### `apps/web/src/services/endpoints/memory.api.ts` (modify existing)

- **Change**: Add `updateMemory` and `deleteMemory` functions.
- **New functions**:
  ```
  updateMemory(memoryId, options: { active?, expiresAt? })
    → PATCH /api/v1/memory-entries/:id

  deleteMemory(memoryId)
    → DELETE /api/v1/memory-entries/:id
  ```

### Files to modify

#### `apps/web/src/features/memory/components/memory-panel.tsx`

- **Change**: Replace the flat list with search + tappable cards + detail sheet.
- **Component structure** (updated):
  ```
  MemoryPanel
  ├── props: { memory: MemoryEntry[] }
  ├── state: selectedEntry, showDetail
  ├── <MemorySearchBar /> (sticky top)
  ├── memory list (filtered):
  │   └── MemoryCard (per entry)
  │       ├── summary text (bold)
  │       ├── source label
  │       ├── last used (relative time)
  │       ├── status indicator (active/expired badge)
  │       ├── tap → open detail sheet
  │       └── swipe-left → quick archive (stretch goal)
  ├── <MemoryDetailSheet entry={selectedEntry} />
  └── empty state: "No memories yet" with guidance
  ```

#### `apps/web/src/styles.css`

- **Change**: Add `.memory-search-bar`, `.memory-card`, `.memory-card-status`, `.memory-action-row` styles.

### Server-side

#### `apps/server/src/routes/memory.route.ts`

- **Change**: Add `PATCH /:memoryId` for status/expiry updates and `DELETE /:memoryId` for deletion.

#### `apps/server/src/services/memory-governance.service.ts`

- **Change**: Add `updateMemoryEntry(memoryId, updates)` and `deleteMemoryEntry(memoryId)` functions.

---

## Phase 6 — Alerts Feed

Upgrade from a flat list to a triaged feed with severity filtering and acknowledge actions.

### Files to create

#### `apps/web/src/features/alerts/components/alert-filter-chips.tsx`

- **Change**: New component for severity filter toggle chips.
- **Component structure**:
  ```
  AlertFilterChips
  ├── props: { activeFilter, onFilterChange }
  ├── chips: All | Critical | Error | Warning | Info
  ├── each chip uses Pill component with appropriate tone
  └── horizontal scroll if needed on small screens
  ```
- **API calls**: None.

#### `apps/web/src/features/alerts/components/alert-card.tsx`

- **Change**: New component replacing the inline `<article>` in `AlertsPanel`. Adds expand/collapse and acknowledge action.
- **Component structure**:
  ```
  AlertCard
  ├── props: { alert: AlertEvent, onAcknowledge }
  ├── collapsed view:
  │   ├── severity icon + color indicator
  │   ├── title (bold)
  │   ├── risk level pill
  │   └── relative timestamp
  ├── expanded view (tap to toggle):
  │   ├── full description
  │   ├── recommended action (highlighted)
  │   ├── related task link (if alert has taskId — future type extension)
  │   └── "Mark as read" button
  └── swipe-left: quick acknowledge (stretch goal)
  ```
- **API calls**: New — `POST /api/v1/alerts/:alertId/acknowledge` via parent callback.

#### `apps/web/src/features/alerts/hooks/use-alert-filter.ts`

- **Change**: New hook for client-side alert filtering by severity.
- **Component structure**:
  ```
  useAlertFilter(alerts: AlertEvent[])
  ├── state: activeFilter ('all' | RiskLevel)
  ├── returns: { filteredAlerts, activeFilter, setFilter }
  └── filters by riskLevel match
  ```
- **API calls**: None.

#### `apps/web/src/services/endpoints/alerts.api.ts`

- **Change**: New API endpoint file for alert operations.
- **Functions**:
  ```
  acknowledgeAlert(alertId: string)
    → POST /api/v1/alerts/:alertId/acknowledge
  ```

### Files to modify

#### `apps/web/src/features/alerts/components/alerts-panel.tsx`

- **Change**: Replace flat list with filter chips + `AlertCard` components + acknowledge mutation.
- **Component structure** (updated):
  ```
  AlertsPanel
  ├── props: { alerts: AlertEvent[] }
  ├── <AlertFilterChips /> (sticky top)
  ├── filtered alert list:
  │   └── <AlertCard /> per alert (with expand/collapse)
  ├── acknowledge mutation (useMutation → POST acknowledge endpoint)
  └── empty state: "All clear — no alerts" with checkmark
  ```

#### `apps/web/src/styles.css`

- **Change**: Add `.alert-card`, `.alert-card-expanded`, `.alert-severity-icon`, `.alert-acknowledge-btn`, `.filter-chips` (if not already added in Phase 3).

### Server-side

#### `apps/server/src/routes/alerts.route.ts`

- **Change**: Add `POST /:alertId/acknowledge` endpoint.

#### `apps/server/src/services/alert-evaluator.service.ts`

- **Change**: Add `acknowledgeAlert(alertId)` that sets `alert.open = false` and records acknowledgement timestamp.

---

## Shared Infrastructure Changes (Cut Across All Phases)

These changes support multiple phases and should be built as needed.

### `apps/web/src/components/ui/bottom-sheet.tsx` (Phase 3)

Reused by: Task Detail (Phase 3), Cost Settings (Phase 4), Memory Detail (Phase 5).

### `apps/web/src/lib/constants.ts`

- **Change**: Add named constants required by UX spec:
  ```
  APPROVAL_COUNTDOWN_INTERVAL_MS = 1000
  SEARCH_DEBOUNCE_MS = 300
  TOAST_DURATION_MS = 3000  (already exists as magic number in toast.store.ts — extract)
  STEP_EXPAND_TRANSITION_MS = 200
  BOTTOM_SHEET_ANIMATION_MS = 350
  TAB_BAR_HEIGHT_PX = 56
  SSE_RECONNECT_DELAY_MS = 3000  (already exists as magic number in use-realtime.ts — extract)
  ```

### `apps/web/src/lib/format.ts`

- **Change**: Add formatting functions:
  ```
  formatCountdown(remainingMs: number): string  → "4:32"
  formatDuration(durationMs: number): string     → "2m 34s"
  formatPercentage(ratio: number): string         → "53%"
  ```

### `apps/web/src/styles.css`

- **Change**: Add CSS keyframe animations for status light states:
  ```
  @keyframes pulse-subtle     → online (opacity)
  @keyframes pulse-breathing  → thinking (scale)
  @keyframes spin-ring        → tool_calling (rotation)
  @keyframes pulse-urgent     → awaiting_approval (double-pulse)
  @keyframes blink-slow       → degraded (opacity)
  @keyframes blink-fast       → error (opacity)
  ```

---

## Dependency & API Summary

### New API Endpoints Required

| Method | Path | Phase | Server File |
|--------|------|-------|-------------|
| `POST` | `/api/v1/costs/budget` | 4 | `cost.route.ts` |
| `PATCH` | `/api/v1/memory-entries/:id` | 5 | `memory.route.ts` |
| `DELETE` | `/api/v1/memory-entries/:id` | 5 | `memory.route.ts` |
| `POST` | `/api/v1/alerts/:alertId/acknowledge` | 6 | `alerts.route.ts` |

### Existing API Endpoints Used (No Changes)

| Method | Path | Used By |
|--------|------|---------|
| `GET` | `/api/v1/dashboard` | `useDashboardQuery` — all tabs |
| `GET` | `/api/v1/realtime/events` (SSE) | `useRealtime` — all tabs |
| `POST` | `/api/v1/memory-entries/:id/archive` | Memory panel |
| `POST` | `/api/v1/approvals/:id/decision` | Approval banner + panel |

### New Frontend Files (17 files)

| # | Path | Phase |
|---|------|-------|
| 1 | `components/ui/tab-bar.tsx` | 1 |
| 2 | `components/ui/bottom-sheet.tsx` | 3 |
| 3 | `components/ui/segmented-control.tsx` | 4 |
| 4 | `components/composed/status-light.tsx` | 2 |
| 5 | `components/composed/budget-bar.tsx` | 4 |
| 6 | `stores/navigation.store.ts` | 1 |
| 7 | `app/tab-shell.tsx` | 1 |
| 8 | `app/tabs/live-tab.tsx` | 1 |
| 9 | `app/tabs/tasks-tab.tsx` | 1 |
| 10 | `app/tabs/cost-tab.tsx` | 1 |
| 11 | `app/tabs/memory-tab.tsx` | 1 |
| 12 | `app/tabs/alerts-tab.tsx` | 1 |
| 13 | `features/status/components/status-header.tsx` | 2 |
| 14 | `features/approval/components/approval-banner.tsx` | 2 |
| 15 | `features/approval/hooks/use-approval-countdown.ts` | 2 |
| 16 | `features/task-flow/components/task-list.tsx` | 3 |
| 17 | `features/task-flow/components/task-detail-sheet.tsx` | 3 |
| 18 | `features/task-flow/hooks/use-task-filter.ts` | 3 |
| 19 | `features/cost/components/cost-settings-sheet.tsx` | 4 |
| 20 | `features/memory/components/memory-search-bar.tsx` | 5 |
| 21 | `features/memory/components/memory-detail-sheet.tsx` | 5 |
| 22 | `features/memory/hooks/use-memory-search.ts` | 5 |
| 23 | `features/alerts/components/alert-filter-chips.tsx` | 6 |
| 24 | `features/alerts/components/alert-card.tsx` | 6 |
| 25 | `features/alerts/hooks/use-alert-filter.ts` | 6 |
| 26 | `services/endpoints/cost.api.ts` | 4 |
| 27 | `services/endpoints/alerts.api.ts` | 6 |

### Modified Frontend Files (9 files)

| # | Path | Phase(s) |
|---|------|----------|
| 1 | `app/App.tsx` | 1 |
| 2 | `app/layouts/mobile-layout.tsx` | 1 |
| 3 | `app/dashboard-page.tsx` | 1 (refactor/delete) |
| 4 | `features/task-flow/components/task-flow-panel.tsx` | 2 |
| 5 | `features/approval/components/approval-panel.tsx` | 2 |
| 6 | `features/cost/components/cost-panel.tsx` | 4 |
| 7 | `features/memory/components/memory-panel.tsx` | 5 |
| 8 | `features/alerts/components/alerts-panel.tsx` | 6 |
| 9 | `services/endpoints/memory.api.ts` | 5 |
| 10 | `lib/constants.ts` | all |
| 11 | `lib/format.ts` | 2, 3, 4 |
| 12 | `styles.css` | all |

### Modified Server Files (4 files)

| # | Path | Phase |
|---|------|-------|
| 1 | `routes/cost.route.ts` | 4 |
| 2 | `routes/memory.route.ts` | 5 |
| 3 | `routes/alerts.route.ts` | 6 |
| 4 | `services/cost-tracker.service.ts` | 4 |
| 5 | `services/memory-governance.service.ts` | 5 |
| 6 | `services/alert-evaluator.service.ts` | 6 |

---

## Phase Dependency Graph

```
Phase 1 (Navigation)
   │
   ├──→ Phase 2 (Live Tab) ──→ requires tab-shell from Phase 1
   │
   ├──→ Phase 3 (Task Detail) ──→ requires tabs + bottom-sheet
   │        │
   │        └──→ Phase 4 (Cost) ──→ reuses bottom-sheet from Phase 3
   │
   ├──→ Phase 5 (Memory) ──→ reuses bottom-sheet from Phase 3
   │
   └──→ Phase 6 (Alerts) ──→ independent, only needs Phase 1 tabs
```

Phase 1 must be completed first. Phases 2–6 can be parallelized after Phase 1, with the caveat that Phases 4 and 5 depend on the `BottomSheet` component from Phase 3.

Recommended execution order: **1 → 2 → 3 → 4 → 5 → 6**
