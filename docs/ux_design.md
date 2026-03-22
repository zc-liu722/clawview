# ClawView — UX Interaction Design Specification

> **Version**: v1.0.0
> **Design philosophy**: The user is not debugging an agent — they are **watching a digital employee work**. Every pixel must reinforce trust, clarity, and control.

---

## 1. UX Structure

### 1.1 Information Architecture

ClawView organizes all information around a single mental model: **"What is my AI doing right now, and is it safe?"**

The hierarchy follows the user's anxiety gradient — from most urgent to least:

```
Level 0: Glanceable Safety Signal (Status Light)
  └─ "Is it alive? Is it safe?"

Level 1: Active Task Console (Step Flow + Cost)
  └─ "What exactly is it doing? How much is it spending?"

Level 2: Control Actions (Approval + Kill Switch)
  └─ "I need to intervene right now."

Level 3: Historical Context (Memory + Task History)
  └─ "What does it remember? What has it done before?"

Level 4: System Health (Alerts + Diagnostics)
  └─ "Are there problems I should know about?"
```

### 1.2 Navigation Model — Tab Bar + Drill-Down

ClawView uses a **flat tab bar** (not a hamburger menu) because on mobile, hidden navigation is forgotten navigation. Every core function is one tap away.

```
┌─────────────────────────────────────────────────┐
│                  Content Area                   │
│              (scrollable, 100vh)                 │
│                                                 │
│                                                 │
│                                                 │
├─────────────────────────────────────────────────┤
│  🟢 Live    📋 Tasks    💰 Cost   🧠 Memory   ⚠️ Alerts │
│  (tab bar, fixed bottom, 56px height)           │
└─────────────────────────────────────────────────┘
```

| Tab | Label | Primary Content | Badge |
|-----|-------|-----------------|-------|
| **Live** | 实况 | Status light + active task step flow | Pulsing dot when agent is working |
| **Tasks** | 任务 | Task history list + detail drill-down | Count of running tasks |
| **Cost** | 费用 | Cost dashboard (task / daily / monthly) | Warning icon if over budget |
| **Memory** | 记忆 | Memory entries with governance controls | Count of new memories since last visit |
| **Alerts** | 告警 | Alert feed + approval queue | Unread count badge (red for critical) |

### 1.3 View Hierarchy

```
App Shell
├── Tab: Live (default landing)
│   ├── Status Header (always visible within tab)
│   ├── Active Task Panel (expandable)
│   │   ├── Step Flow (real-time streaming)
│   │   └── Task Cost Summary (inline)
│   └── Approval Banner (conditional, slides in from top)
│
├── Tab: Tasks
│   ├── Task List (virtual scrolling)
│   └── Task Detail Sheet (bottom sheet overlay)
│       ├── Full Step Timeline
│       ├── Cost Breakdown
│       └── Error Detail (if failed)
│
├── Tab: Cost
│   ├── Period Selector (Task / Today / Month)
│   ├── Cost Summary Card
│   ├── Model Breakdown Chart
│   ├── Budget Progress Bar
│   └── Cost Trend Sparkline
│
├── Tab: Memory
│   ├── Search Bar (sticky top)
│   ├── Memory List (grouped by source)
│   └── Memory Detail Sheet
│       ├── Full Content
│       ├── Source Reference
│       ├── Usage Stats
│       └── Governance Actions (mute / expire / delete)
│
├── Tab: Alerts
│   ├── Pending Approvals Section (pinned top)
│   │   └── Approval Card (swipe or tap to decide)
│   └── Alert History (grouped by severity)
│
└── Global Overlays
    ├── Approval Full-Screen Modal (for CRITICAL risk)
    ├── Connection Lost Banner (sticky top)
    ├── Toast Notifications
    └── Settings Sheet
```

---

## 2. Panel Layout

### 2.1 Mobile Layout (375px baseline)

All measurements in logical pixels. Touch targets minimum 44×44px.

#### Live Tab — The Command Console

```
┌─────────────────────────────────────┐  0px
│ ┌─────────────────────────────────┐ │
│ │  ● ONLINE        ⚙️  │ │  16px status bar
│ │  "Claw is idle"    12:34 PM │ │
│ └─────────────────────────────────┘ │  64px
│                                     │
│ ┌─ Connected Channels ────────────┐ │
│ │ 📱 Telegram ✅   💬 Feishu ✅   │ │  40px
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─ Active Task ───────────────────┐ │
│ │ "整理今天的客户线索"             │ │
│ │ ⏱ 2m 34s   💰 ¥0.42   🔄 Running│ │  88px task header
│ ├─────────────────────────────────┤ │
│ │                                 │ │
│ │  ✅ 1. 读取 CRM 客户备注        │ │
│ │     GPT-4o · 1,240 tokens · 8s │ │
│ │                                 │ │
│ │  ✅ 2. 搜索公司融资新闻          │ │
│ │     GPT-4o · 890 tokens · 12s  │ │
│ │                                 │ │
│ │  🔄 3. 生成跟进建议 ← pulsing   │ │  step flow
│ │     GPT-4o · streaming...      │ │  (scrollable)
│ │                                 │ │
│ │  ⏳ 4. 输出最终报告              │ │
│ │     pending                    │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─ Quick Cost ────────────────────┐ │
│ │ 本任务 ¥0.42  │ 今日 ¥3.80     │ │  48px
│ └─────────────────────────────────┘ │
│                                     │
├─────────────────────────────────────┤
│  🟢 Live   📋 Tasks   💰 Cost  🧠  ⚠️  │  56px tab bar
└─────────────────────────────────────┘
```

#### Approval Banner (slides in when approval is pending)

```
┌─────────────────────────────────────┐
│ ⚠️ APPROVAL REQUIRED               │
│ Agent wants to delete 23 files      │
│ Risk: HIGH  ⏱ Expires in 4:32      │
│                                     │
│  [ ✅ Approve ]    [ ❌ Deny ]      │  120px
│                                     │
└─────────────────────────────────────┘
```

### 2.2 Responsive Breakpoints

| Breakpoint | Width | Layout Adaptation |
|------------|-------|-------------------|
| **xs (base)** | 0–374px | Single column, compact spacing, abbreviated labels |
| **sm** | 375–639px | Single column, standard spacing (primary target) |
| **md** | 640–1023px | Two-column for Cost tab (summary + chart side by side) |
| **lg** | 1024px+ | Sidebar navigation replaces tab bar; Live + Tasks side by side |

#### Desktop Layout (lg: 1024px+)

```
┌──────────┬─────────────────────────────────────────────┐
│          │  Status Header                              │
│  🟢 Live │─────────────────────────────────────────────│
│          │                                             │
│  📋 Tasks│  ┌─ Active Task ───┐  ┌─ Alert Feed ─────┐ │
│          │  │                 │  │                   │ │
│  💰 Cost │  │  Step Flow      │  │  Recent alerts    │ │
│          │  │  (real-time)    │  │  + approval queue │ │
│  🧠 Memory│  │                 │  │                   │ │
│          │  │                 │  │                   │ │
│  ⚠️ Alerts│  └─────────────────┘  └───────────────────┘ │
│          │                                             │
│  ⚙️ Settings│  ┌─ Cost Summary ──────────────────────┐   │
│          │  │  Task ¥0.42 │ Today ¥3.80 │ Month ¥89 │   │
│          │  └────────────────────────────────────────┘   │
└──────────┴─────────────────────────────────────────────┘
```

### 2.3 Panel Component Specifications

#### Status Header Panel

| Property | Value |
|----------|-------|
| Height | 64px (fixed, non-scrollable) |
| Background | Solid surface color with subtle bottom border |
| Status indicator | 12px circle with glow effect + breathing animation when active |
| Status text | 16px semibold, dynamic from Narrative Engine |
| Timestamp | 12px muted, relative time ("2 min ago") updating every 10s |
| Settings icon | 24px, top-right, opens settings sheet |

#### Step Flow Panel

| Property | Value |
|----------|-------|
| Container | Card with 12px border-radius, 16px internal padding |
| Step item height | Min 56px, expandable to show raw event detail |
| Step icon | 20px status icon (✅ ● 🔄 ❌ ⏳) with color coding |
| Step text | 14px regular, single line with ellipsis, expandable |
| Step meta | 12px muted, model + tokens + duration |
| Active step | Highlighted background + left border accent + pulse animation |
| Auto-scroll | Scrolls to active step when new step arrives, unless user has scrolled up |
| Max visible | Show all steps; virtual scroll if > 50 |

#### Approval Card Panel

| Property | Value |
|----------|-------|
| Position | Pinned to top of Live tab (pushes content down) or full-screen modal for CRITICAL |
| Background | Warning amber (MEDIUM/HIGH) or danger red (CRITICAL) at 10% opacity |
| Border | Left 4px solid accent matching risk level |
| Action buttons | Full-width, 48px height, Approve (green) + Deny (red) |
| Timer | Countdown ring animation, turns red at < 60s |
| Haptic | Vibrate on appearance (if supported) |

---

## 3. Interaction Flow

### 3.1 Core User Journey: "Watch AI Work"

```
User opens ClawView (PWA / bookmark)
        │
        ▼
   Live Tab loads
        │
        ├── Agent is IDLE
        │   └── Show: status light (green), last task summary,
        │           "No active tasks" placeholder, quick cost summary
        │
        ├── Agent is WORKING (THINKING / TOOL_CALLING)
        │   └── Show: status light (blue pulse), active task card
        │         with streaming step flow, live cost counter
        │         │
        │         ├── User taps a completed step
        │         │   └── Step expands: raw event type, full duration,
        │         │       token breakdown, tool parameters (sanitized)
        │         │
        │         ├── User scrolls up in step flow
        │         │   └── Auto-scroll pauses, "Jump to latest ↓" FAB appears
        │         │
        │         └── New step arrives
        │             └── If user hasn't scrolled up: auto-scroll + animate in
        │                 If user has scrolled up: increment badge on FAB
        │
        ├── Agent needs APPROVAL
        │   └── Approval banner slides in with haptic buzz
        │       │
        │       ├── MEDIUM/HIGH risk: inline banner at top of Live tab
        │       │   ├── User taps "Approve" → confirmation toast → agent continues
        │       │   └── User taps "Deny" → confirmation dialog → agent stops
        │       │
        │       └── CRITICAL risk: full-screen modal with biometric/PIN
        │           ├── User authenticates + "Approve" → agent continues
        │           └── User authenticates + "Deny" → agent stops + audit log
        │
        └── Agent is OFFLINE / ERROR
            └── Show: status light (red), diagnostic info,
                last known state, "Reconnecting..." message
```

### 3.2 Approval Flow (Human-in-the-Loop)

This is the highest-stakes interaction. Speed and clarity are critical.

```
BFF pushes approval_requested SSE event
        │
        ▼
PWA receives event
        │
        ├── App is in foreground
        │   ├── MEDIUM/HIGH: slide-in banner + haptic
        │   └── CRITICAL: full-screen takeover + haptic + sound
        │
        └── App is in background
            └── Push notification with action buttons
                "Agent wants to delete 23 files — Approve / Deny"
                │
                └── User taps notification → opens app to approval screen
        │
        ▼
User sees Approval Card:
  ┌────────────────────────────────────────┐
  │ ⚠️  HIGH RISK ACTION                  │
  │                                        │
  │ "Agent is about to delete 23 files     │
  │  in /data/reports/ directory"          │
  │                                        │
  │ 📁 Affected: /data/reports/*.csv       │
  │ 💰 Estimated impact: irreversible      │
  │ ⏱  Auto-deny in: 4:32                 │
  │                                        │
  │ [▼ View technical details]             │
  │                                        │
  │ ┌────────────┐  ┌────────────────────┐ │
  │ │  ❌ Deny   │  │  ✅ Approve        │ │
  │ └────────────┘  └────────────────────┘ │
  └────────────────────────────────────────┘
        │
        ├── User taps "View technical details"
        │   └── Expand: raw tool name, parameters, file paths
        │
        ├── User taps "Approve"
        │   ├── MEDIUM/HIGH: instant approval → success toast
        │   └── CRITICAL: biometric prompt → then approval → success toast
        │
        ├── User taps "Deny"
        │   └── Confirmation dialog: "Stop this action?"
        │       ├── "Yes, deny" → agent halts → toast "Action blocked"
        │       └── "Cancel" → return to approval card
        │
        └── Timer expires
            └── Auto-denied → toast "Action auto-blocked (timeout)"
```

### 3.3 Memory Governance Flow

```
User navigates to Memory tab
        │
        ▼
Memory list loads (paginated, search bar sticky top)
        │
        ├── Each memory card shows:
        │   │ "用户偏好早上 9 点开会"
        │   │ Source: conversation · Used 5 times · Last used 2d ago
        │   │ Status: 🟢 Active
        │   └── Tags: [preferences] [schedule]
        │
        ├── User taps a memory card
        │   └── Bottom sheet opens with full detail:
        │       ├── Full raw content (sanitized)
        │       ├── Source conversation/file reference
        │       ├── Usage timeline (when was it referenced)
        │       ├── Action buttons:
        │       │   ├── 🔇 Mute — "Don't use this memory but keep it"
        │       │   ├── ⏰ Set expiry — date picker → "Auto-archive after X days"
        │       │   ├── 📦 Archive — "Remove from active recall"
        │       │   └── 🗑️ Delete — confirmation required → permanent removal
        │       └── Edit tags (chip input)
        │
        ├── User long-presses a memory card
        │   └── Multi-select mode activates
        │       ├── Batch mute
        │       ├── Batch archive
        │       └── Batch delete (with count confirmation)
        │
        └── User types in search bar
            └── Real-time filter by content + tags
                (debounced 300ms, client-side for loaded items,
                 server-side search for full corpus)
```

### 3.4 Cost Exploration Flow

```
User navigates to Cost tab
        │
        ▼
Cost dashboard loads with default view: "Today"
        │
        ├── Period selector (segmented control): Task │ Today │ Month
        │
        ├── "Today" selected:
        │   ├── Hero number: "¥3.80" (large, prominent)
        │   ├── Budget bar: "38% of daily ¥10.00 budget"
        │   ├── vs. yesterday: "+12%" or "−5%" with color coding
        │   ├── Model breakdown (horizontal stacked bar):
        │   │   ├── GPT-4o: ¥2.10 (55%)
        │   │   ├── GPT-4o-mini: ¥1.20 (32%)
        │   │   └── Claude Sonnet: ¥0.50 (13%)
        │   └── Task cost list (sorted by cost, descending):
        │       ├── "整理客户线索" — ¥1.20 — 12 steps
        │       ├── "查询航班信息" — ¥0.80 — 5 steps
        │       └── "写周报草稿" — ¥0.60 — 8 steps
        │
        ├── User taps a task in cost list
        │   └── Navigate to task detail (same as Tasks tab detail)
        │
        ├── User taps model in breakdown
        │   └── Expand: input tokens, output tokens, call count, avg cost per call
        │
        └── User taps budget bar
            └── Budget settings sheet:
                ├── Daily budget: number input with ¥ prefix
                ├── Monthly budget: number input
                ├── Alert threshold: slider (50% / 80% / 100%)
                └── Save → confirmation toast
```

### 3.5 Alert Triage Flow

```
User navigates to Alerts tab
        │
        ▼
Alert feed loads (two sections)
        │
        ├── Section 1: Pending Approvals (pinned, always on top)
        │   └── Same approval cards as Live tab
        │
        └── Section 2: Alert History (reverse chronological)
            │
            ├── Severity filter chips: All │ Critical │ Error │ Warning │ Info
            │
            ├── Each alert card:
            │   │ 🔴 CRITICAL · Cost Anomaly
            │   │ "过去 10 分钟花费 ¥15.80，超出日常均值 300%"
            │   │ Suggested: "检查是否有循环调用"
            │   │ 3 min ago · [Mark as read]
            │   └──
            │
            ├── User taps an alert
            │   └── Expand inline:
            │       ├── Full description
            │       ├── Related task link (tap to navigate)
            │       ├── Suggested action (highlighted)
            │       └── "Mark as read" button
            │
            └── User swipes left on an alert
                └── Quick "Mark as read" action (swipe gesture)
```

---

## 4. Clickable Elements & Interaction Catalog

### 4.1 Global Elements

| Element | Location | Tap Action | Long-Press | Swipe |
|---------|----------|------------|------------|-------|
| **Tab bar item** | Bottom bar | Switch tab; if already on tab, scroll to top | — | — |
| **Status light** | Status header | Open status detail popover (gateway info, heartbeat, channels) | — | — |
| **Settings gear** | Status header, top-right | Open settings bottom sheet | — | — |
| **Connection banner** | Top of screen (when disconnected) | Tap to retry connection | — | Swipe up to dismiss temporarily |
| **Toast** | Bottom center | Tap to dismiss | — | Swipe right to dismiss |

### 4.2 Live Tab Elements

| Element | Tap Action | Long-Press | Swipe |
|---------|------------|------------|-------|
| **Active task header** | Collapse/expand step flow | Copy task ID | — |
| **Step item (completed)** | Expand to show raw event detail, model, tokens, duration | Copy step narrative text | — |
| **Step item (running)** | No action (already highlighted) | — | — |
| **Step item (failed)** | Expand to show error message + suggested fix | — | — |
| **"Jump to latest" FAB** | Auto-scroll to bottom of step flow | — | — |
| **Quick cost summary** | Navigate to Cost tab | — | — |
| **Approval banner** | Expand approval detail | — | Swipe up to temporarily minimize (re-appears after 30s) |
| **Approve button** | Submit approval (with optional biometric for CRITICAL) | — | — |
| **Deny button** | Open deny confirmation dialog | — | — |
| **Channel chip** | Show channel detail popover (connection time, last message) | — | — |

### 4.3 Tasks Tab Elements

| Element | Tap Action | Long-Press | Swipe |
|---------|------------|------------|-------|
| **Task list item** | Open task detail bottom sheet | Copy task summary | Swipe left to reveal "View cost" shortcut |
| **Task status filter** | Filter by status (All / Running / Completed / Failed) | — | — |
| **Task detail close** | Close bottom sheet (also: swipe down on handle) | — | Swipe down to close |
| **Step in detail view** | Same as Live tab step interactions | — | — |
| **Error retry button** | (If applicable) Trigger task retry via API | — | — |

### 4.4 Cost Tab Elements

| Element | Tap Action | Long-Press | Swipe |
|---------|------------|------------|-------|
| **Period segment** (Task/Today/Month) | Switch cost view granularity | — | — |
| **Hero cost number** | No action (informational) | Copy value | — |
| **Budget progress bar** | Open budget settings sheet | — | — |
| **Model bar segment** | Expand model detail (tokens, calls, avg cost) | — | — |
| **Task in cost list** | Navigate to task detail | — | — |
| **Trend sparkline** | (Desktop) Show tooltip with exact values | — | — |

### 4.5 Memory Tab Elements

| Element | Tap Action | Long-Press | Swipe |
|---------|------------|------------|-------|
| **Search bar** | Focus + show keyboard | — | — |
| **Memory card** | Open memory detail bottom sheet | Enter multi-select mode | Swipe left to reveal quick-delete |
| **Tag chip** | Filter memories by that tag | — | — |
| **Mute button** | Mute memory (toggleable) | — | — |
| **Set expiry button** | Open date picker for auto-archive | — | — |
| **Archive button** | Archive with confirmation toast (undoable for 5s) | — | — |
| **Delete button** | Open delete confirmation dialog | — | — |
| **Multi-select checkbox** | Toggle selection | — | — |
| **Batch action bar** | Execute batch action on selected items | — | — |

### 4.6 Alerts Tab Elements

| Element | Tap Action | Long-Press | Swipe |
|---------|------------|------------|-------|
| **Severity filter chip** | Toggle filter | — | — |
| **Alert card** | Expand inline to show full detail | Copy alert ID | Swipe left → "Mark as read" |
| **Related task link** | Navigate to task detail | — | — |
| **Mark as read button** | Mark alert acknowledged | — | — |
| **Approval card** (in alerts) | Same as Live tab approval interactions | — | — |

### 4.7 Settings Sheet Elements

| Element | Tap Action |
|---------|------------|
| **Agent name** | Open rename text input |
| **Daily budget** | Open number input with ¥ prefix |
| **Monthly budget** | Open number input |
| **Alert threshold** | Toggle between 50% / 80% / 100% |
| **Notification preferences** | Toggle push notifications per severity level |
| **High-risk rules** | Open sub-sheet to configure which actions require approval |
| **Theme toggle** | Switch light/dark mode |
| **About / Version** | Show app version + connection info |
| **Sign out** | Sign out with confirmation |

---

## 5. Mobile-First Design

### 5.1 Design Principles

| # | Principle | Implementation |
|---|-----------|----------------|
| 1 | **Glanceability** | The most critical info (status + current step) is visible without scrolling on the smallest screen |
| 2 | **Thumb-zone optimization** | Primary actions (Approve/Deny, tab switching) sit in the bottom 40% of the screen — the natural thumb reach zone |
| 3 | **Progressive disclosure** | Surface the narrative first ("正在搜索网页"), hide technical detail (tool_call:web_search) behind a tap |
| 4 | **Interrupt-driven** | Approvals interrupt the user with appropriate urgency (banner → modal → push notification) |
| 5 | **One-hand operation** | All critical flows completable with one thumb. Bottom sheet > full page navigation |
| 6 | **Offline resilience** | Show last known state with "Last updated X ago" when offline. Queue approval decisions for retry |

### 5.2 Touch Target Specifications

| Element Type | Minimum Size | Recommended Size | Spacing |
|-------------|-------------|-----------------|---------|
| Tab bar item | 44×44px | 48×56px | 0px (edge-to-edge) |
| Button (primary) | 44×44px | full-width × 48px | 16px horizontal margin |
| List item | 44px height | 56–72px height | 0px (divider line) |
| Icon button | 44×44px | 44×44px | 8px from edges |
| Chip / Tag | 32×32px (with padding area 44px) | 36×36px | 8px gap |
| Bottom sheet handle | 36×20px (drag area 100% × 40px) | — | — |

### 5.3 Typography Scale (Mobile)

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| **Display** | 28px | Bold (700) | 34px | Cost hero number |
| **Title** | 20px | Semibold (600) | 26px | Section headers |
| **Subtitle** | 16px | Semibold (600) | 22px | Card titles, step narrative |
| **Body** | 14px | Regular (400) | 20px | Descriptions, alert text |
| **Caption** | 12px | Regular (400) | 16px | Timestamps, metadata, token counts |
| **Overline** | 11px | Medium (500) | 14px | Labels, status indicators |

### 5.4 Color System — Status-Driven Semantics

Colors communicate agent state at a glance. The palette is intentionally limited to prevent cognitive overload.

| Semantic | Light Mode | Dark Mode | Usage |
|----------|-----------|-----------|-------|
| **Online / Safe** | `#10B981` (emerald-500) | `#34D399` | Status dot, success states |
| **Working / Active** | `#3B82F6` (blue-500) | `#60A5FA` | Thinking/tool-calling status, active step highlight |
| **Warning / Attention** | `#F59E0B` (amber-500) | `#FBBF24` | Degraded state, budget warnings, medium-risk approvals |
| **Danger / Critical** | `#EF4444` (red-500) | `#F87171` | Errors, offline, critical approvals, over-budget |
| **Awaiting / Pending** | `#8B5CF6` (violet-500) | `#A78BFA` | Awaiting approval state |
| **Muted / Inactive** | `#6B7280` (gray-500) | `#9CA3AF` | Completed steps, archived items, disabled |
| **Surface** | `#FFFFFF` | `#1F2937` | Card backgrounds |
| **Background** | `#F9FAFB` | `#111827` | Page background |
| **Text primary** | `#111827` | `#F9FAFB` | Main text |
| **Text secondary** | `#6B7280` | `#9CA3AF` | Captions, metadata |

### 5.5 Status Light — The Heartbeat

The status light is ClawView's signature element. It must feel **alive**.

| Status | Color | Animation | Glow |
|--------|-------|-----------|------|
| **Online (idle)** | Emerald | Steady, subtle pulse (2s ease-in-out, opacity 0.7→1.0) | Soft 8px glow |
| **Thinking** | Blue | Breathing pulse (1.5s, scale 0.9→1.1) | Medium 12px glow |
| **Tool calling** | Blue | Spinning ring around dot (1s rotation) | Medium 12px glow |
| **Awaiting approval** | Violet | Urgent double-pulse (0.8s) | Strong 16px glow |
| **Degraded** | Amber | Slow blink (3s, opacity 0.4→1.0) | Warm 8px glow |
| **Offline** | Red | No animation (static) | No glow |
| **Error** | Red | Fast blink (0.5s) | Strong 12px red glow |

### 5.6 Motion & Animation Specifications

| Animation | Duration | Easing | Trigger |
|-----------|----------|--------|---------|
| **Step flow item enter** | 300ms | ease-out | New step arrives from SSE |
| **Step flow item expand** | 200ms | ease-in-out | User taps completed step |
| **Bottom sheet open** | 350ms | spring(1, 0.8, 0) | User taps list item |
| **Bottom sheet close** | 250ms | ease-in | User swipes down or taps backdrop |
| **Approval banner slide-in** | 400ms | spring(1, 0.7, 0) | Approval request arrives |
| **Tab switch** | 150ms | ease-in-out | User taps tab |
| **Toast appear** | 200ms | ease-out | System event |
| **Toast dismiss** | 150ms | ease-in | Auto (3s) or user swipe |
| **Cost counter tick** | 100ms per digit | ease-out | Real-time cost update |
| **Status light pulse** | See status table above | CSS keyframes | Continuous while in state |
| **Skeleton loading** | 1.5s shimmer loop | linear | While data is loading |

### 5.7 Gesture Support

| Gesture | Context | Action |
|---------|---------|--------|
| **Pull to refresh** | Any tab's main list | Refetch latest data from server |
| **Swipe left** | Alert card | Quick "Mark as read" |
| **Swipe left** | Memory card | Quick delete (with undo) |
| **Swipe left** | Task list item | Reveal "View cost" button |
| **Swipe down** | Bottom sheet | Close sheet |
| **Swipe down** | Top of Live tab (when at top) | Pull to refresh |
| **Long press** | Memory card | Enter multi-select mode |
| **Long press** | Task/step text | Copy text to clipboard |
| **Pinch zoom** | Cost trend chart (desktop) | Zoom time axis |

### 5.8 Empty States & Edge Cases

Every screen needs a thoughtful empty state — this is where trust is built or broken.

| Screen | Empty State |
|--------|-------------|
| **Live tab, no active task** | Illustration of a relaxed robot + "Claw is idle — waiting for your next task" + last completed task preview |
| **Tasks tab, no history** | "No tasks yet — send a message to your AI in Telegram or Feishu to get started" |
| **Cost tab, no data** | "No usage data yet — costs will appear here once Claw starts working" |
| **Memory tab, empty** | "Claw hasn't formed any memories yet — memories are created as you interact" |
| **Alerts tab, all clear** | Checkmark illustration + "All clear — no alerts or pending approvals" |
| **Offline state** | Cloud-off icon + "Connection lost — showing last known data from [time]" + reconnection countdown |
| **Loading state** | Skeleton screens matching the layout of each panel (never a full-screen spinner) |

### 5.9 Notification Strategy

| Event | In-App | Push Notification | Sound | Haptic |
|-------|--------|-------------------|-------|--------|
| **Approval request (CRITICAL)** | Full-screen modal | Yes, with action buttons | Alert tone | Strong vibration (3 pulses) |
| **Approval request (HIGH)** | Banner at top of Live tab | Yes, with action buttons | Subtle chime | Medium vibration (1 pulse) |
| **Approval request (MEDIUM)** | Banner at top of Live tab | Yes, silent | None | Light tap |
| **Alert (CRITICAL)** | Toast + badge on Alerts tab | Yes | Alert tone | Medium vibration |
| **Alert (ERROR)** | Toast + badge | Yes, silent | None | Light tap |
| **Alert (WARNING)** | Badge only | Optional (user setting) | None | None |
| **Task completed** | Toast | Optional (user setting) | None | Success tap |
| **Budget threshold reached** | Toast + Cost tab badge | Yes | None | Medium vibration |
| **Connection lost** | Sticky banner | Yes (after 60s) | None | None |

### 5.10 Accessibility

| Requirement | Implementation |
|-------------|----------------|
| **Screen reader** | All status lights have `aria-label` describing the state in full text. Step flow items are `role="listitem"` with narrative as accessible name |
| **Color-blind safety** | Status is never communicated by color alone — always paired with icon + text. Green/red pairs use distinct shapes (circle vs. triangle) |
| **Reduced motion** | Respect `prefers-reduced-motion`: disable pulse animations, use instant transitions, keep functionality identical |
| **Font scaling** | Support up to 200% system font size without layout breaking (use rem units) |
| **Focus management** | Approval modals trap focus. Bottom sheets return focus to trigger on close. Tab bar items have visible focus rings |
| **Contrast ratios** | All text meets WCAG 2.1 AA (4.5:1 for body, 3:1 for large text) |

---

## Appendix A: Screen-by-Screen Wireframe Index

| # | Screen | Entry Point | Exit Point |
|---|--------|-------------|------------|
| S1 | Live — Idle | App launch / tab tap | Tab switch |
| S2 | Live — Active Task | Automatic when task starts | Task completes → S1 |
| S3 | Live — Approval Banner | SSE approval_requested | Approve/Deny → S2 |
| S4 | Approval — Full Screen Modal | CRITICAL risk event | Decision → S2 |
| S5 | Tasks — List | Tab tap | Tap task → S6 |
| S6 | Tasks — Detail Sheet | Tap task in S5 | Swipe down / back → S5 |
| S7 | Cost — Dashboard | Tab tap | Tap task → S6, Tap budget → S8 |
| S8 | Cost — Budget Settings | Tap budget bar in S7 | Save → S7 |
| S9 | Memory — List | Tab tap | Tap memory → S10 |
| S10 | Memory — Detail Sheet | Tap memory in S9 | Action → S9, Swipe down → S9 |
| S11 | Alerts — Feed | Tab tap | Tap alert → expand inline, Tap task link → S6 |
| S12 | Settings | Gear icon in header | Swipe down / back |
| S13 | Connection Lost | Auto (SSE disconnect) | Auto (reconnect) |

## Appendix B: State-to-UI Mapping

Maps `AgentStatusCode` to complete visual representation:

| AgentStatusCode | Status Text (example) | Light | Tab Badge | UI Behavior |
|---|---|---|---|---|
| `online` | "Claw 空闲中" | 🟢 steady | None | Show idle state, last task preview |
| `thinking` | "正在思考..." | 🔵 breathing | 🔵 on Live | Show active task, step flow streaming |
| `tool_calling` | "正在搜索网页资料" | 🔵 spinning | 🔵 on Live | Show active task, current tool step highlighted |
| `awaiting_approval` | "等待你的审批" | 🟣 urgent pulse | 🔴 on Alerts | Show approval banner/modal, block other actions |
| `degraded` | "模型接口拥堵，等待重试" | 🟡 slow blink | ⚠️ on Alerts | Show degraded banner, keep step flow visible |
| `offline` | "设备离线" | 🔴 static | 🔴 on Live | Show last known state, reconnection info |
| `error` | "发生错误，请检查" | 🔴 fast blink | 🔴 on Alerts | Show error detail, suggested actions |
