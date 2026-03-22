# ClawView Deep Audit & Product Redesign Plan

> **Audit Date**: 2026-03-17
> **Audit Approach**: Comprehensive codebase analysis + user experience audit + architectural review
> **Auditor**: AI Product Architect

---

## 1. Overall Assessment

**Project Level: Late Prototype / Pre-Alpha**

This is a functioning proof-of-concept that reads OpenClaw transcripts and displays them in a mobile tab UI. The architecture docs are impressive and well-thought-out, but the implementation has significant gaps between aspiration and reality.

### The TWO Biggest Problems

1. **The product has no data-cleaning boundary between raw OpenClaw output and the user-facing UI.** Task descriptions, step narratives, and memory content can all leak raw code, JSON, file paths, and debug artifacts straight into the interface. The `sanitizePromptSummary` regex exists but is insufficient for production — it can't handle nested structures, multi-language content mixing, or large prompt payloads. This single issue makes the product feel like a developer debug console, not a user tool.

2. **The implementation dramatically under-delivers on its own architecture spec.** Tailwind CSS is not installed. shadcn/ui is not used. PWA (manifest, service worker) is not configured. There is no auth system. There is no router. The Narrative Engine service doesn't exist (logic is hardcoded in the adapter). `narrative-rules.yaml` doesn't exist. There are zero tests. This gap between documentation and reality means the project will accumulate technical debt exponentially if not addressed.

### Why It Currently Fails as a Product

- Users see raw technical data instead of human-readable summaries
- Memory module is read-only in production mode (OpenClaw) — writes don't persist to disk
- Multiple interactive elements are fake (settings button, budget save button)
- All data loads through a single monolithic dashboard API call — no pagination, no lazy loading
- No offline capability despite PWA being a core requirement
- No localization system — Chinese/English mixing throughout the UI

---

## 2. Deep Analysis of Known Issues

### Issue 1: Poor Layout / Spacing

**Root Cause:** The project uses a single 975-line `styles.css` file with raw CSS instead of Tailwind CSS (despite the architecture spec mandating Tailwind 4). There is no design token system — all spacing values (padding, margin, gap) are hardcoded pixel values scattered throughout the stylesheet with no systematic scale.

**Affected Files:**
- `apps/web/src/styles.css` — all layout rules
- Every component file — inline styles mixed with CSS classes

**Specific Problems:**

| Area | Issue | Evidence |
|------|-------|----------|
| `.panel` | 18px padding everywhere — too tight for content-heavy panels | L106-107 |
| `.timeline-item` | Only 8px padding, 12px gap — cramped for touch | L248-250 |
| `.metric-card` | 14px padding — text hits edges on small screens | L184 |
| `.page-content` | 16px horizontal padding — acceptable but inconsistent with inner elements | L58 |
| Typography | No systematic scale — font sizes are arbitrary (12px, 13px, 15px, 18px, 21px, 24px) | Throughout |
| Vertical rhythm | No consistent spacing scale — gap values are 6, 8, 10, 12, 14, 16px randomly | Throughout |

**Fix Strategy:**
1. Define a spacing scale as CSS custom properties: `--space-1: 4px`, `--space-2: 8px`, `--space-3: 12px`, `--space-4: 16px`, `--space-5: 20px`, `--space-6: 24px`, `--space-8: 32px`
2. Define a typography scale: body-sm (13px), body (15px), body-lg (17px), heading-sm (18px), heading (21px), heading-lg (28px), display (clamp)
3. Replace all hardcoded values systematically
4. Increase panel inner padding to 20-24px
5. Increase timeline item padding to 12-16px

**Priority:** High
**Side Effects:** Visual changes across entire app — needs visual regression review

---

### Issue 2: Task Description Pollution (MOST CRITICAL)

**Root Cause (Deep):** The data pipeline has THREE failure points, not one:

1. **Adapter level** (`openclaw-files.adapter.ts` L419-427): `sanitizePromptSummary()` uses regex to strip code blocks, JSON, and paths, but regexes are fundamentally insufficient for this:
   - Nested/unbalanced brackets break the `\{[\s\S]*?\}` pattern
   - Content after code removal may still contain technical jargon
   - 60-char truncation is arbitrary and can cut mid-word/mid-sentence
   - No semantic understanding — can't distinguish "user intent" from "technical context"

2. **Narrative level** (`buildNarrative()` L221-253): Hardcoded in the adapter instead of being a configurable service. The translation rules are primitive `includes()` checks that miss many tool types and can produce misleading narratives.

3. **Frontend level** (task-flow-panel.tsx, task-list.tsx, task-detail-sheet.tsx, live-tab.tsx): Components render `task.userPromptSummary` and `step.narrative` as raw text with zero frontend-side sanitization or structure. No distinction between "summary" and "detail" in the UI.

**Affected Files:**
- `apps/server/src/adapters/openclaw-files.adapter.ts` — sanitizePromptSummary(), buildNarrative()
- `apps/web/src/features/task-flow/components/task-flow-panel.tsx` — L42 (eyebrow), L74 (step narrative)
- `apps/web/src/features/task-flow/components/task-list.tsx` — L51
- `apps/web/src/features/task-flow/components/task-detail-sheet.tsx` — L21
- `apps/web/src/app/tabs/live-tab.tsx` — L27

**Fix Strategy (Layered Defense):**

Layer 1 — Backend sanitization (improve `sanitizePromptSummary`):
- Add smarter content extraction: find first natural language sentence
- Strip markdown headers, links, images
- Remove XML/HTML tags
- Collapse whitespace and normalize punctuation
- Limit to 80 chars with word-boundary truncation
- Fallback: generate summary from first meaningful sentence

Layer 2 — Structured data model:
- Add `userPromptSummaryClean: string` (always safe for display)
- Keep `userPromptRaw: string` (original, for developer view)
- Step model: `narrative` (clean) + `rawDetail` (technical, hidden by default)

Layer 3 — Frontend information hierarchy:
- Default: show only clean summary
- Expandable: technical details behind a "show details" toggle
- Never show raw content at the top level

**Priority:** Critical
**Side Effects:** Changes data model (shared types), adapter logic, and frontend rendering

---

### Issue 3: Memory Module Broken

**Root Cause (Deep):** There are TWO fundamental problems:

1. **Path misconfiguration:** The memory path is controlled by `CLAWVIEW_OPENCLAW_HOME` + `MEMORY.md` / `memory/*.md` / `workspace/*.md`. The user reports the correct path should be the local `clawd` directory (same level as the project). The current default is `/data/openclaw` which doesn't exist on macOS. There's no guidance or auto-detection for the correct path.

2. **Write operations don't persist:** In `memory-governance.service.ts`, the `updateMemoryEntry()`, `archiveMemoryEntry()`, and `deleteMemoryEntry()` functions only modify in-memory data when `CLAWVIEW_DATA_SOURCE === "openclaw"`. They don't write back to the actual MEMORY.md or memory/*.md files. This means:
   - User edits a memory → sees success toast → refreshes → change is gone
   - This is worse than "not editable" — it's **deceptively editable** (gives false feedback)

**Affected Files:**
- `apps/server/src/lib/config.ts` — path configuration
- `apps/server/src/adapters/openclaw-files.adapter.ts` — `parseMemoryEntries()` reads from filesystem
- `apps/server/src/services/memory-governance.service.ts` — write operations don't persist
- `apps/web/src/features/memory/components/memory-detail-sheet.tsx` — editing UI
- `apps/web/src/features/memory/components/memory-panel.tsx` — list display
- `apps/web/src/services/endpoints/memory.api.ts` — API calls

**Fix Strategy:**
1. Add `CLAWVIEW_CLAWD_DIR` config option that points to the local `clawd` directory
2. Update `parseMemoryEntries()` to read from `clawd/` directory
3. Implement actual file-write logic in `memory-governance.service.ts`:
   - `updateMemoryEntry` → modify the line in MEMORY.md and write back
   - `deleteMemoryEntry` → remove the line from MEMORY.md and write back
   - Use atomic file writes (write to temp file, then rename) to prevent corruption
4. Add optimistic UI with rollback on write failure
5. Add clear error messages when write fails (permissions, file locked, etc.)

**Priority:** Critical
**Side Effects:** File system writes — needs careful error handling and potential file locking

---

## 3. Newly Discovered Issues

### Issue N1: Fake Interactive Elements
**Severity:** High
**Why it matters:** Users see clickable UI that does nothing — this destroys trust.
- `status-header.tsx` L22-24: Settings button has no `onClick` handler
- `cost-settings-sheet.tsx` L41-44: "保存并关闭" only calls `onClose()`, never calls `updateBudget`
- Budget limits entered in the form are discarded on close

**How to fix:** Either implement the functionality or remove the buttons. Never show non-functional interactive elements.

### Issue N2: Tailwind CSS Not Installed
**Severity:** High
**Why it matters:** The entire architecture spec and `.cursorrules` mandate Tailwind 4. The actual codebase uses a 975-line raw CSS file. This means every architectural decision about responsive design, spacing, and component styling is based on a false assumption.

**How to fix:** Either install and migrate to Tailwind, or update all documentation to reflect the plain CSS approach. Given the project is mobile-first PWA, Tailwind's responsive utilities would be a significant improvement. However, the plain CSS approach is working — the pragmatic choice is to keep it but add a design token system via CSS custom properties.

### Issue N3: No PWA Configuration
**Severity:** High
**Why it matters:** The architecture spec calls this a "PWA" in every section. There is no `manifest.json`, no service worker, no `vite-plugin-pwa`. The app cannot be installed on mobile home screens and has no offline capability.

**How to fix:** Add `vite-plugin-pwa` with minimal manifest and caching strategy.

### Issue N4: Monolithic Dashboard API
**Severity:** Medium
**Why it matters:** `GET /api/v1/dashboard` returns ALL data (status, tasks, costs, memory, alerts, approvals) in a single request. As data grows, this becomes a performance bottleneck. There's no pagination for tasks or memory entries. The 12-second polling in `index.ts` re-reads the entire filesystem snapshot every cycle.

**How to fix:** Split into separate endpoints per resource (already defined in API_CONTRACT_DRAFT.md but not implemented). Add pagination to lists. Use SSE for incremental updates instead of full refreshes.

### Issue N5: No Error Handlers on Multiple Mutations
**Severity:** Medium
**Why it matters:** Several `useMutation` calls lack `onError` handlers:
- `archiveMutation` in memory-detail-sheet.tsx
- `toggleMutation` in memory-detail-sheet.tsx
- `deleteMutation` in memory-detail-sheet.tsx
- Alert acknowledge mutation in alerts-panel.tsx

Silent failures on mobile are unacceptable — user taps "delete", nothing happens, no feedback.

**How to fix:** Add `onError` with toast notification to every mutation.

### Issue N6: 12-Second Hardcoded Polling Interval
**Severity:** Medium
**Why it matters:** `index.ts` uses `setInterval(() => { ... }, 12_000)` — hardcoded magic number violating the project's own anti-pattern AP-1. This controls how often the server re-reads OpenClaw files and publishes events. 12 seconds is too slow for a "real-time" dashboard (architecture spec says SLA ≤ 3s).

**How to fix:** Move to named constant in config. Consider file-watching (chokidar) instead of polling for true real-time updates.

### Issue N7: No Authentication System
**Severity:** Medium (for local use), Critical (for any network exposure)
**Why it matters:** The architecture spec defines JWT auth, RBAC, device fingerprinting. None of it is implemented. With `CLAWVIEW_HOST: "0.0.0.0"`, the server is exposed to the entire network with zero authentication. Any device on the LAN can read all data and modify memory.

**How to fix:** For MVP, add at minimum a shared secret/PIN check. Full auth can come later.

### Issue N8: Accessibility Gaps
**Severity:** Medium
**Why it matters:** Mobile-first PWA needs accessibility:
- Toast notifications have no `aria-live` region
- SegmentedControl has `role="tablist"` but no keyboard navigation
- Filter chips lack `aria-pressed`/`aria-selected`
- Timeline expand/collapse lacks `aria-expanded`
- Bottom sheet has no focus trap

**How to fix:** Add ARIA attributes systematically. Implement focus trap in bottom sheet.

### Issue N9: No Virtual Scrolling
**Severity:** Low (currently), High (at scale)
**Why it matters:** The project's own rules require virtual scrolling for lists > 50 items. No list uses virtualization. With real OpenClaw usage, task step lists can easily exceed 100 items.

**How to fix:** Add `@tanstack/react-virtual` to timeline and task list.

### Issue N10: Types Diverge from API Contract
**Severity:** Low
**Why it matters:** The actual TypeScript types in `packages/shared/src/types/` are simplified versions of what `API_CONTRACT_DRAFT.md` specifies. For example, `MemoryEntry` has 7 fields in code vs 15 fields in the spec. `AlertEvent` has different field names. This creates confusion for anyone reading the docs.

**How to fix:** Either update types to match spec, or mark the spec as "target state" and add current types as "MVP state."

---

## 4. Information Architecture Redesign

### Current Problem

Task data is displayed as a flat dump:

```
[eyebrow] raw user prompt (may contain code/JSON/paths)
[title]   任务步骤流
[pill]    running

Step 1: 正在搜索：<raw content leaked here>
        tool_name · 1,234 tokens · ¥0.00
Step 2: 正在调用 bash：rm -rf /important/dir
        bash · 0 tokens · ¥0.00
```

### Redesigned Information Hierarchy

**Level 0: Glance View (always visible)**
```
┌─────────────────────────────────────────┐
│ 🟢 正在执行任务                          │
│                                         │
│ "帮我整理本周的会议纪要"                  │  ← Clean 1-line summary
│                                         │
│ 步骤 3/5 · 进行中 · ¥0.12              │  ← Progress + cost
│ ████████░░ 60%                          │  ← Visual progress bar
└─────────────────────────────────────────┘
```

**Level 1: Step Timeline (default expanded)**
```
● 收到任务请求                    14:32
  ───────────────────────────
● 搜索相关文件                    14:32
  15 tokens · ¥0.01 · 1.2s
  ───────────────────────────
◉ 正在整理内容                    14:33   ← Active step highlighted
  生成中...
  ───────────────────────────
○ 输出结果                        等待中
```

**Level 2: Step Detail (tap to expand)**
```
● 搜索相关文件                    14:32
  15 tokens · ¥0.01 · 1.2s

  ▼ 技术详情                               ← Expandable section
  ┌─────────────────────────────────────┐
  │ 事件类型: tool_call:file_search     │
  │ 工具: file_search                   │
  │ 模型: gpt-4o                        │
  │ 输入 tokens: 10                     │
  │ 输出 tokens: 5                      │
  │ 耗时: 1,234ms                       │
  └─────────────────────────────────────┘
```

**Level 3: Raw Data (developer mode, separate view)**
```
Bottom Sheet: "原始数据"
┌─────────────────────────────────────┐
│ {                                   │
│   "type": "tool_call",              │
│   "tool_name": "file_search",       │
│   ...                               │
│ }                                   │
│                                     │
│ [复制 JSON]                          │
└─────────────────────────────────────┘
```

### Information Placement Rules

| Data Type | Where | Why |
|-----------|-------|-----|
| Task summary (1 line, clean) | Card header, always visible | User needs instant context |
| Step count + progress | Below summary, always visible | Progress awareness |
| Total cost | Summary area, always visible | Budget awareness |
| Step narrative (human) | Timeline, default visible | Follow along |
| Step cost/tokens | Timeline subtitle, default visible | Quick reference |
| Step technical detail | Expandable per-step | Power users only |
| Raw event JSON | Separate bottom sheet | Developer debug only |
| File paths, raw code | NEVER shown at glance | Pollution prevention |

---

## 5. UI/UX Redesign Plan

### 5.1 Design Token System

Add to the top of `styles.css`:

```css
:root {
  /* Spacing scale (4px base) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;

  /* Typography scale */
  --text-xs: 11px;
  --text-sm: 13px;
  --text-base: 15px;
  --text-lg: 17px;
  --text-xl: 20px;
  --text-2xl: 24px;
  --text-3xl: 30px;

  /* Line heights */
  --leading-tight: 1.2;
  --leading-normal: 1.5;
  --leading-relaxed: 1.65;

  /* Border radius */
  --radius-sm: 8px;
  --radius-md: 14px;
  --radius-lg: 18px;
  --radius-xl: 24px;
  --radius-full: 999px;

  /* Shadows */
  --shadow-sm: 0 4px 12px rgba(15, 23, 42, 0.04);
  --shadow-md: 0 12px 32px rgba(15, 23, 42, 0.06);
  --shadow-lg: 0 20px 60px rgba(15, 23, 42, 0.08);
}
```

### 5.2 Typography Hierarchy

| Role | Size | Weight | Color | Usage |
|------|------|--------|-------|-------|
| Display | clamp(28px, 7vw, 40px) | 800 | #0f172a | Page hero numbers (cost) |
| Heading L | 24px | 700 | #0f172a | Panel titles |
| Heading M | 20px | 700 | #0f172a | Section headers |
| Heading S | 17px | 600 | #0f172a | Card titles |
| Body | 15px | 400 | #334155 | Default content |
| Body S | 13px | 400 | #475569 | Secondary info, metadata |
| Caption | 11px | 600 | #64748b | Labels, kickers |
| Mono | 13px | 500 | #475569 | Technical detail (inside expanded sections only) |

### 5.3 Spacing Rules

| Context | Value | Why |
|---------|-------|-----|
| Page horizontal padding | 16px (mobile), 24px (tablet+) | Standard mobile margin |
| Panel internal padding | 20px | Breathing room for content |
| Gap between panels | 16px | Clear separation |
| Gap between list items | 12px | Related items stay grouped |
| Gap between metadata items | 8px | Tight but readable |
| Timeline step padding | 14px | Touch-friendly |
| Button minimum height | 44px | Apple HIG touch target |

### 5.4 Card vs List Structure

| Content | Structure | Why |
|---------|-----------|-----|
| Active task | Full card with progress bar | Primary focus |
| Task list (history) | Compact list items | Scan-friendly |
| Memory entries | Card with summary + status pill | Medium density |
| Alert items | Expandable card | Detail on demand |
| Cost breakdown | Metric grid (2-col) | Quick comparison |
| Steps timeline | Timeline with expand | Chronological flow |

### 5.5 Mobile Layout Behavior

- **375px base**: All designs start here
- **768px+**: 2-column grid for dashboard panels, centered tab bar
- **Bottom sheet**: Max 85vh, handle for drag, focus trap
- **Tab bar**: Fixed bottom, 5 tabs, safe area insets, 56px height per tab item
- **Scroll containers**: Timeline max 56vh, smooth scroll, "jump to latest" FAB
- **Touch**: All interactive elements ≥ 44px tap target

---

## 6. Memory Module Redesign

### 6.1 Data Flow (Read)

```
clawd/MEMORY.md          ← primary memory file
clawd/memory/*.md        ← additional memory files
         │
         ▼
parseMemoryEntries()     ← reads all .md files, parses sections
         │
         ▼
GET /api/v1/memory-entries
         │
         ▼
MemoryPanel (list)  →  MemoryDetailSheet (detail + edit)
```

### 6.2 Correct Path Configuration

**Config change:**
```typescript
const configSchema = z.object({
  // Replace CLAWVIEW_OPENCLAW_HOME with more specific paths
  CLAWVIEW_CLAWD_DIR: z.string().default("./clawd"),
  // ... keep other config
});
```

The server should resolve `CLAWVIEW_CLAWD_DIR` relative to the server's working directory. Auto-detection logic:
1. Check `./clawd/` (same level as server)
2. Check `../clawd/` (parent directory)
3. Check env var `CLAWVIEW_CLAWD_DIR`
4. Fail with clear error message if not found

### 6.3 Editing UX

**View Mode:**
```
┌─────────────────────────────────────┐
│ 记忆详情                             │
│                                     │
│ "用户偏好早上 9 点开会"              │  ← summary (tappable to edit)
│                                     │
│ 来源: 对话         上次引用: 3天前   │
│ 状态: 生效中 🟢     过期: 未设置     │
│                                     │
│ [✏️ 编辑] [😶 静默] [📦 归档] [🗑 删除] │
└─────────────────────────────────────┘
```

**Edit Mode:**
```
┌─────────────────────────────────────┐
│ 编辑记忆                             │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 用户偏好早上 9 点开会            │ │  ← textarea, autofocus
│ │                                 │ │
│ │                                 │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [取消]                    [💾 保存]  │
└─────────────────────────────────────┘
```

### 6.4 Save Logic

```typescript
async function saveMemoryEdit(memoryId: string, newSummary: string): Promise<void> {
  // 1. Optimistic UI update
  queryClient.setQueryData(DASHBOARD_QUERY_KEY, (old) => {
    // update memory entry in cache
  });

  try {
    // 2. API call
    await updateMemory(memoryId, { summary: newSummary });
    pushToast("记忆已更新");
  } catch (error) {
    // 3. Rollback on failure
    queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
    pushToast("保存失败，请重试");
  }
}
```

Backend write logic:
```typescript
function updateMemoryInFile(memoryId: string, newSummary: string): void {
  const filePath = resolveMemoryFile(memoryId);
  const content = readFileSync(filePath, "utf-8");
  const updated = replaceMemoryLine(content, memoryId, newSummary);

  // Atomic write: temp file → rename
  const tempPath = `${filePath}.tmp`;
  writeFileSync(tempPath, updated, "utf-8");
  renameSync(tempPath, filePath);
}
```

### 6.5 Error Handling

| Scenario | User Feedback | Technical Action |
|----------|--------------|------------------|
| File not found | "记忆文件不存在，请检查配置" | Log error, return 404 |
| Permission denied | "没有写入权限，请检查文件权限" | Log error, return 403 |
| File locked | "文件正在被其他程序使用" | Retry once, then return 423 |
| Invalid content | "内容格式有误" | Validate before write |
| Network error | "网络错误，请重试" | Show retry button |

### 6.6 Mobile Usability

- Textarea should auto-resize to content
- Save button should be sticky at bottom of sheet
- Keyboard should not obscure the textarea (use `visualViewport` API)
- Support swipe-to-dismiss on bottom sheet
- Confirm before delete (double-tap or confirmation dialog)

---

## 7. Executable Task Breakdown

### Task 1: Add Design Token System
**What to change:** Add CSS custom properties for spacing, typography, radius, shadows
**Files:** `apps/web/src/styles.css`
**Exact change:** Add `:root` block with all design tokens. Replace the ~50 hardcoded values in the file with token references.
**Completion criteria:** All spacing, font-size, border-radius, and shadow values reference CSS variables. No magic numbers remain in styles.css.

### Task 2: Improve Task Description Sanitization
**What to change:** Rewrite `sanitizePromptSummary()` with multi-pass cleaning
**Files:** `apps/server/src/adapters/openclaw-files.adapter.ts`
**Exact change:**
- Enhance `sanitizePromptSummary()` to: strip markdown headers/links/images, strip HTML tags, strip XML tags, handle multi-line code blocks more robustly, extract first natural-language sentence, truncate at word boundary to 80 chars
- Add `sanitizeNarrative()` for step narratives with similar cleaning
- Ensure `buildNarrative()` never passes raw content longer than 100 chars to the UI
**Completion criteria:** No raw code, JSON, file paths, or markdown syntax appears in task summaries or step narratives in the UI.

### Task 3: Implement Information Hierarchy in Task Display
**What to change:** Restructure task-flow-panel to use 3-level information display
**Files:**
- `apps/web/src/features/task-flow/components/task-flow-panel.tsx`
- `apps/web/src/features/task-flow/components/task-list.tsx`
- `apps/web/src/features/task-flow/components/task-detail-sheet.tsx`
- `apps/web/src/styles.css`
**Exact change:**
- Add progress indicator (step X/Y + progress bar) below task summary
- Default: show only `step.narrative` (always visible) + time + cost
- Expanded: show technical details (rawEventType, toolName, modelName, durationMs)
- Add `aria-expanded` to expand buttons
- Never show rawEventType at the default level
**Completion criteria:** Users see clean, scannable timeline. Technical data only appears on tap/expand.

### Task 4: Fix Memory Module Path Configuration
**What to change:** Add `CLAWVIEW_CLAWD_DIR` config and update memory path resolution
**Files:**
- `apps/server/src/lib/config.ts` — add new config field
- `apps/server/src/adapters/openclaw-files.adapter.ts` — update `parseMemoryEntries()` to use new path
**Exact change:**
- Add `CLAWVIEW_CLAWD_DIR: z.string().default("./clawd")` to config schema
- Update `parseMemoryEntries()` to read from `config.CLAWVIEW_CLAWD_DIR` + `/MEMORY.md` and `config.CLAWVIEW_CLAWD_DIR` + `/memory/*.md`
- Add startup validation: check if directory exists and is readable before serving requests
**Completion criteria:** Memory module reads from the correct local `clawd` directory. Missing directory produces a clear log message.

### Task 5: Implement Memory Write Persistence
**What to change:** Make memory edit/delete/archive actually write to disk
**Files:**
- `apps/server/src/services/memory-governance.service.ts` — implement file write operations
- `apps/server/src/routes/memory.route.ts` — ensure PATCH/DELETE routes pass through to file writes
**Exact change:**
- `updateMemoryEntry()`: parse the memory file, find the entry, replace the summary line, write back atomically (temp file + rename)
- `deleteMemoryEntry()`: remove the entry from the file, write back atomically
- Add proper error handling for file I/O (wrap in try-catch, return appropriate ClawViewError subclass)
**Completion criteria:** Editing a memory in the UI persists the change to disk. Refreshing the page shows the updated content. File write errors show user-facing error messages.

### Task 6: Fix Fake Interactive Elements
**What to change:** Either implement or remove non-functional buttons
**Files:**
- `apps/web/src/features/status/components/status-header.tsx` — settings button
- `apps/web/src/features/cost/components/cost-settings-sheet.tsx` — save button
- `apps/web/src/services/endpoints/cost.api.ts` — `updateBudget` function
**Exact change:**
- `cost-settings-sheet.tsx`: Wire "保存并关闭" to call `updateBudget()` API, add loading state and error handling
- `status-header.tsx`: Either add settings sheet (preferred) or remove the button entirely
- If settings button is removed, also remove the associated CSS class
**Completion criteria:** Every visible button has a working onClick handler. No button is decorative.

### Task 7: Add Error Handlers to All Mutations
**What to change:** Add `onError` callbacks with toast feedback to every `useMutation`
**Files:**
- `apps/web/src/features/memory/components/memory-detail-sheet.tsx` — archiveMutation, toggleMutation, deleteMutation
- `apps/web/src/features/alerts/components/alerts-panel.tsx` — acknowledge mutation
**Exact change:**
- Add `onError: () => pushToast("操作失败，请重试")` to each mutation
- For delete mutations, add confirmation dialog before executing
**Completion criteria:** Every mutation shows error feedback on failure. No silent failures.

### Task 8: Create i18n Maps and Complete Chinese Localization
**What to change:** Ensure all user-facing text is in Chinese
**Files:**
- `apps/web/src/lib/i18n-maps.ts` — verify all maps exist (STATUS_LABELS, RISK_LABELS, TASK_STATUS_LABELS, STEP_STATUS_LABELS, COST_GRANULARITY_LABELS, MEMORY_STATUS_LABELS)
- All component files that display status/enum values
**Exact change:**
- Verify every component uses i18n-maps for enum display
- Fix any remaining English text in UI
- Add MEMORY_STATUS_LABELS map if missing
**Completion criteria:** No English enum values visible in the UI. All user-facing text is Chinese.

### Task 9: Extract Polling Interval to Config
**What to change:** Replace hardcoded 12000ms with named constant
**Files:**
- `apps/server/src/lib/config.ts` — add config field
- `apps/server/src/index.ts` — use config value
**Exact change:**
- Add `CLAWVIEW_POLL_INTERVAL_MS: z.coerce.number().int().default(5000)` to config
- Replace `12_000` in `setInterval()` with `config.CLAWVIEW_POLL_INTERVAL_MS`
**Completion criteria:** No hardcoded interval values in index.ts. Default is 5 seconds (closer to 3-second SLA).

### Task 10: Improve Panel and Timeline Spacing
**What to change:** Update CSS to use design tokens and improve spacing
**Files:** `apps/web/src/styles.css`
**Exact change:**
- `.panel` padding: 18px → `var(--space-5)` (20px)
- `.timeline-item` padding: 8px → `var(--space-3)` (12px)
- `.metric-card` padding: 14px → `var(--space-4)` (16px)
- `.timeline-scroll` gap: 14px → `var(--space-3)` (12px)
- `.panel-title` font-size: 21px → `var(--text-xl)` (20px)
- `.panel-eyebrow` font-size: 13px → `var(--text-sm)` (13px)
- All other hardcoded values → token references
**Completion criteria:** All spacing/font values use design tokens. Visual spacing is consistent and breathable.

---

## 8. Key Implementation Strategies

### 8.1 How to CLEAN Task Descriptions

**Multi-pass sanitization pipeline:**

```typescript
function sanitizePromptSummary(raw: string): string {
  if (!raw || raw.trim().length === 0) return "OpenClaw 任务";

  let text = raw;

  // Pass 1: Remove code blocks (markdown fenced + indented)
  text = text.replace(/```[\s\S]*?```/g, " ");
  text = text.replace(/^( {4}|\t).+$/gm, " ");

  // Pass 2: Remove inline code
  text = text.replace(/`[^`]+`/g, " ");

  // Pass 3: Remove HTML/XML tags
  text = text.replace(/<[^>]+>/g, " ");

  // Pass 4: Remove JSON objects and arrays (greedy but bounded)
  text = text.replace(/\{[^{}]*\}/g, " ");
  text = text.replace(/\[[^\[\]]*\]/g, " ");

  // Pass 5: Remove file paths
  text = text.replace(/(?:\/[\w.-]+){2,}/g, " ");
  text = text.replace(/[A-Z]:\\[\w\\.-]+/g, " ");

  // Pass 6: Remove markdown formatting
  text = text.replace(/^#{1,6}\s+/gm, "");
  text = text.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1");
  text = text.replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1");

  // Pass 7: Remove special character sequences (code residue)
  text = text.replace(/[<>=/\\|{}[\]()]{3,}/g, " ");

  // Pass 8: Normalize whitespace
  text = text.replace(/\s+/g, " ").trim();

  // Pass 9: Word-boundary truncation
  if (text.length > 80) {
    const truncated = text.slice(0, 80);
    const lastSpace = truncated.lastIndexOf(" ");
    text = (lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated) + "…";
  }

  return text || "OpenClaw 任务";
}
```

### 8.2 How to Prevent Code Leakage into UI

**Defense in depth:**

1. **Backend adapter** (`sanitizePromptSummary`, `sanitizeNarrative`): Primary defense — clean all text before it enters the data model
2. **Shared type constraint**: `userPromptSummary` should have a max length (e.g., 100 chars) enforced by Zod schema
3. **Frontend guard**: A utility function `safeSummary(text: string): string` that runs a lightweight client-side check as a last resort — if it detects code patterns (consecutive braces, forward slashes, semicolons), it truncates and appends "…"
4. **CSS defense**: `.panel-eyebrow` and summary text containers should have `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` (or `line-clamp: 2` for multi-line) to prevent visual overflow even if cleaning fails

### 8.3 How to Implement Layered Information Display

**Component structure:**

```
TaskFlowPanel
├── TaskSummaryBar          ← Always visible: clean summary + progress + cost
├── StepTimeline            ← Default expanded: narrative + time
│   └── StepItem
│       ├── StepHeader      ← narrative + timestamp (always visible)
│       ├── StepMeta        ← tool + tokens + cost (always visible, compact)
│       └── StepDetail      ← rawEventType, model, duration (expandable)
└── JumpToLatestFAB
```

**Expand/collapse pattern:**
- Tap timeline dot → toggle `StepDetail` visibility
- Add `aria-expanded` attribute to dot button
- Use CSS `max-height` transition for smooth reveal
- Only one step expanded at a time (accordion pattern)

### 8.4 How to Safely Fix Path Issues

1. **Never break existing setups:** Keep `CLAWVIEW_OPENCLAW_HOME` working if set
2. **Add new config:** `CLAWVIEW_CLAWD_DIR` with auto-detection
3. **Resolution order:**
   - If `CLAWVIEW_CLAWD_DIR` is explicitly set → use it
   - If `./clawd/` exists → use it
   - If `CLAWVIEW_OPENCLAW_HOME` is set → fall back to it
   - Else → log error with clear instructions
4. **Startup validation:** Check directory exists and is readable before serving requests
5. **Atomic file writes:** Always write to `.tmp` file first, then rename — prevents data corruption on crash

---

## 9. Final Execution Summary

### Priority Order

```
Phase 1: Core Data Quality (blocks everything else)
  ├── Task 2: Improve sanitization         ← Highest ROI
  ├── Task 4: Fix memory path config       ← Unblocks memory feature
  └── Task 5: Memory write persistence     ← Makes memory usable

Phase 2: UI Credibility
  ├── Task 6: Fix fake buttons             ← Removes trust-breakers
  ├── Task 7: Error handlers on mutations  ← No silent failures
  └── Task 8: Complete Chinese localization

Phase 3: Visual Polish
  ├── Task 1: Design token system          ← Foundation for consistency
  ├── Task 10: Spacing improvements        ← Uses tokens from Task 1
  └── Task 3: Information hierarchy        ← Clean task display

Phase 4: Infrastructure
  └── Task 9: Config-driven polling        ← Performance + correctness
```

### Execution Constraints

- All changes must maintain backward compatibility with existing `mock` data source
- File writes must use atomic operations (temp + rename)
- Every user action must produce visible feedback (success toast or error toast)
- No new npm dependencies unless absolutely necessary (keep bundle small)
- All new CSS should use the design token variables
- Test each change in both `mock` and `openclaw` data source modes

### Critical Rules for Implementation

1. **Never render raw content at the top level** — always sanitize
2. **Every mutation gets an onError** — no exceptions
3. **Every button does something** — or doesn't exist
4. **Design tokens first, then styling** — no new hardcoded values
5. **Atomic file writes only** — never write directly to source files
6. **Clear error messages in Chinese** — users don't read English stack traces

This plan transforms ClawView from a developer debug interface into a product that ordinary users can trust and use on their phones. The prioritization ensures the most impactful changes (data quality, broken features) come first, with visual polish following.