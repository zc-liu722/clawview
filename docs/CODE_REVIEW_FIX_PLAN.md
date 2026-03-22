# ClawView 代码审阅与问题修复计划

> **审阅日期**: 2026-03-17
> **审阅依据**: `docs/Clawview_PRD.md` + 运行状态实测 + 代码结构全面审查
> **总结**: 发现 5 个用户报告问题 + 3 个代码审阅额外问题，共 8 项待修复。

---

## 一、审阅发现的所有问题

### 用户报告的 5 个问题

#### 问题 1: 网站只能本地访问，手机端无法查看

Vite dev server 和 Hono server 均默认绑定 `localhost`，同局域网手机无法访问。

| 文件 | 问题 |
|------|------|
| `apps/web/vite.config.ts` | `server.host` 未设置（默认 localhost） |
| `apps/server/src/index.ts` | `serve()` 只传了 `port`，未传 `hostname` |
| `apps/server/src/lib/config.ts` | 无 `CLAWVIEW_HOST` 配置项 |

---

#### 问题 2: Token 计费精度不足，费用显示为 0

**根本原因**: cost 使用整数 cents（分）存储，Zod schema 校验 `z.number().int()`。对于低 token 量的步骤，实际费用可能不到 0.5 分，`Math.round()` 后变为 0。所有步骤都为 0 时，任务总费用也为 0。

| 文件 | 行号 | 问题 |
|------|------|------|
| `apps/server/src/adapters/openclaw-files.adapter.ts` | L188-201 | `toCostCents()` 使用 `Math.round()` 导致精度丢失 |
| `packages/shared/src/validators/task-execution.schema.ts` | L19, L35 | `costCents: z.number().int().min(0)` 强制整数 |
| `packages/shared/src/utils/format-cost.ts` | L1-7 | `formatCostFromCents` 用 `costCents / 100`，整数 0 分 = 显示 ¥0.00 |

**复现路径**: 当 OpenClaw transcript 中的单个事件 cost 不足 0.5 分 → `Math.round()` 取整为 0 → 每步 0 分 → 总计 0 分 → 前端显示 ¥0.00。

---

#### 问题 3: 记忆板块操作按钮不清晰，缺少编辑/修改入口

| 文件 | 行号 | 问题 |
|------|------|------|
| `apps/web/src/features/memory/components/memory-detail-sheet.tsx` | L79 | 按钮用英文 "Mute"，条件分支另一侧才是中文 "恢复" |
| 同上 | L85 | "Archive" 英文 |
| 同上 | L92 | "Delete" 英文 |
| 同上 | L70 | 状态显示 "active" / "muted" 英文 |
| `apps/web/src/features/memory/components/memory-panel.tsx` | L36 | 状态 badge 显示 "active" / "expired" 英文 |
| 整体 | — | 无法编辑记忆内容（修改 summary），只能静默/归档/删除 |

**PRD 对照**: PRD 第 4 节场景 4 明确要求记忆中心应有"查看、搜索、删除、设过期"功能，第 5.1 节第 4 条要求"查看、搜索、删除、设过期"。但当前无**编辑内容**的入口，这是用户最直觉期待的操作。

---

#### 问题 4: "警告"写成"告警"

| 文件 | 行号 | 当前文案 | 应改为 |
|------|------|----------|--------|
| `apps/web/src/components/ui/tab-bar.tsx` | L25 | `label: "告警"` | `label: "警告"` |
| `apps/web/src/features/alerts/components/alerts-panel.tsx` | L34 | `"告警已标记已读。"` | `"警告已标记已读。"` |
| `apps/web/src/features/alerts/components/alerts-panel.tsx` | L39 | `title="异常告警"` | `title="异常警告"` |

> 注：PRD 中使用的是"异常告警"，但用户认为应为"警告"。将统一改为"警告"以符合用户预期。

---

#### 问题 5: 任务描述直接展示原始内容，观感差

| 文件 | 行号 | 问题 |
|------|------|------|
| `apps/server/src/adapters/openclaw-files.adapter.ts` | L426-427 | `userPromptSummary` 直接取 transcript 中的 user message 全文内容，不做截断和代码清理 |

**影响范围**: 前端多处直接渲染 `task.userPromptSummary`：

- `apps/web/src/features/task-flow/components/task-list.tsx` L51
- `apps/web/src/features/task-flow/components/task-flow-panel.tsx` L41
- `apps/web/src/features/task-flow/components/task-detail-sheet.tsx` L20
- `apps/web/src/app/tabs/live-tab.tsx` L27

**现象**: 用户的 prompt 可能包含代码块、JSON、长文本、文件路径等技术内容，直接显示在 UI 上，不符合 PRD 中"翻译成人话"的核心理念。

---

### 代码审阅发现的额外问题

#### 问题 6: 大量中英文混杂，产品面向中文用户但 UI 混入英文

| 文件 | 行号 | 英文内容 | 应改为 |
|------|------|----------|--------|
| `apps/web/src/features/cost/components/cost-panel.tsx` | L39 | SegmentedControl: "Task" / "Today" / "Month" | "本任务" / "今日" / "本月" |
| 同上 | L49 | budget label: `"task budget"` | `"本任务预算"` / `"今日预算"` / `"本月预算"` |
| `apps/web/src/components/composed/status-badge.tsx` | L19 | `status.replaceAll("_", " ")`（如 "tool calling"） | 使用中文映射表 |
| `apps/web/src/features/alerts/components/alerts-panel.tsx` | L43 | 空状态 "All clear - no alerts" | "暂无警告" |
| `apps/web/src/features/alerts/components/alert-card.tsx` | L31 | 风险等级 pill 显示 "low" / "medium" 等 | "低" / "中" / "高" / "紧急" |
| `apps/web/src/features/task-flow/components/task-flow-panel.tsx` | L42 | 任务状态 pill 显示 "running" / "completed" | "进行中" / "已完成" 等 |
| 同上 | L79 | `"streaming..."` | `"生成中..."` |
| 同上 | L107 | `"Jump to latest"` | `"跳到最新"` |
| `apps/web/src/features/task-flow/components/task-detail-sheet.tsx` | L22 | 状态 `task.status` 直接展示英文 | 使用中文映射 |
| `apps/web/src/features/approval/components/approval-banner.tsx` | L48 | `"APPROVAL REQUIRED"` | `"需要审批"` |
| 同上 | L52 | `"Risk: HIGH"` | `"风险等级：高"` |
| `apps/web/src/features/memory/components/memory-detail-sheet.tsx` | L70 | 状态 "active" / "muted" | "生效中" / "已静默" |
| `apps/web/src/features/memory/components/memory-panel.tsx` | L36 | 状态 badge "active" / "expired" | "生效中" / "已过期" |

---

#### 问题 7: 缺少状态码和风险等级的中文映射工具函数

当前没有统一的中文翻译 map，各组件直接显示英文枚举值。需要新增工具函数统一管理中文映射。

---

#### 问题 8: StatusPanel 中 `activeTaskId` 直接显示 ID 字符串

| 文件 | 行号 | 问题 |
|------|------|------|
| `apps/web/src/features/status/components/status-panel.tsx` | L37 | `value={status.activeTaskId ?? "空闲"}` — 任务 ID 如 `task_20260316_01` 对用户无意义 |

应改为显示"运行中"或类似的用户可读文案。

---

## 二、修复方案详细说明

### Fix 1: 支持局域网/手机端访问

#### 修改 1.1 — Vite dev server 绑定 0.0.0.0

**文件**: `apps/web/vite.config.ts`

在 `server` 配置块中添加 `host: true`：

```typescript
server: {
  host: true,  // 新增：绑定 0.0.0.0，允许局域网设备访问
  port: 5173,
  proxy: {
    "/api": "http://localhost:8787",
  },
},
```

#### 修改 1.2 — Hono server 绑定 0.0.0.0

**文件**: `apps/server/src/lib/config.ts`

新增 `CLAWVIEW_HOST` 配置项：

```typescript
const configSchema = z.object({
  CLAWVIEW_HOST: z.string().default("0.0.0.0"),  // 新增
  CLAWVIEW_PORT: z.coerce.number().int().default(8787),
  // ...其余不变
});
```

**文件**: `apps/server/src/index.ts`

`serve()` 添加 `hostname` 参数：

```typescript
serve(
  {
    fetch: app.fetch,
    hostname: config.CLAWVIEW_HOST,  // 新增
    port: config.CLAWVIEW_PORT,
  },
  (info) => {
    logger.info(`ClawView server listening on http://${config.CLAWVIEW_HOST}:${info.port}`);
  },
);
```

---

### Fix 2: 提升 Token 计费精度

#### 修改 2.1 — Zod schema 去掉 `.int()` 约束

**文件**: `packages/shared/src/validators/task-execution.schema.ts`

```diff
- costCents: z.number().int().min(0),
+ costCents: z.number().min(0),

- totalCostCents: z.number().int().min(0),
+ totalCostCents: z.number().min(0),
```

#### 修改 2.2 — adapter 保留浮点精度

**文件**: `apps/server/src/adapters/openclaw-files.adapter.ts`

`toCostCents()` 函数去掉 `Math.round()`：

```typescript
function toCostCents(event: TranscriptEvent): number {
  if (typeof event.cost_cents === "number") {
    return Math.max(0, event.cost_cents);  // 去掉 Math.round
  }

  if (typeof event.cost === "number") {
    return Math.max(0, event.cost * 100);  // 去掉 Math.round
  }

  if (typeof event.usage?.cost?.total === "number") {
    return Math.max(0, event.usage.cost.total * 100);  // 去掉 Math.round
  }

  return 0;
}
```

#### 修改 2.3 — 格式化函数支持更高精度

**文件**: `packages/shared/src/utils/format-cost.ts`

```typescript
export function formatCostFromCents(costCents: number): string {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,  // 新增：支持显示到 0.0001 元
  }).format(costCents / 100);
}
```

#### 修改 2.4 — 类型注释更新

**文件**: `packages/shared/src/types/cost.ts`

`costCents` 字段注释更新，说明允许浮点数：

```typescript
/** Cost in cents (may be fractional for high-precision tracking). */
costCents: number;
```

**文件**: `packages/shared/src/types/task-execution.ts`

同理更新 `TaskStep.costCents` 和 `TaskExecutionLog.totalCostCents` 的注释。

---

### Fix 3: 记忆板块 — 添加编辑入口并汉化按钮

#### 修改 3.1 — 记忆详情 Sheet 添加编辑功能并汉化

**文件**: `apps/web/src/features/memory/components/memory-detail-sheet.tsx`

核心改动：
1. 新增 `isEditing` 状态和 `editedSummary` 状态
2. 新增"编辑"按钮，点击进入编辑模式（textarea）
3. 编辑模式下显示"保存"和"取消"按钮
4. 所有按钮改为中文：
   - "Mute" → "静默"
   - "恢复" 保持
   - "Archive" → "归档"
   - "Delete" → "删除"
5. 状态文案中文化：
   - "active" → "生效中"
   - "muted" → "已静默"

新增 editMutation：

```typescript
const editMutation = useMutation({
  mutationFn: (options: { memoryId: string; summary: string }) =>
    updateMemory(options.memoryId, { summary: options.summary }),
  onSuccess: (entries) => {
    syncEntries(entries);
    pushToast("记忆内容已更新。");
    setIsEditing(false);
  },
});
```

#### 修改 3.2 — 记忆卡片状态 badge 汉化

**文件**: `apps/web/src/features/memory/components/memory-panel.tsx`

```diff
- {entry.active ? "active" : "expired"}
+ {entry.active ? "生效中" : "已过期"}
```

#### 修改 3.3 — 前端 API 扩展 summary 参数

**文件**: `apps/web/src/services/endpoints/memory.api.ts`

`updateMemory` 函数的 options 类型扩展：

```typescript
export function updateMemory(
  memoryId: string,
  options: { active?: boolean; expiresAt?: number | null; summary?: string },
): Promise<MemoryEntry[]> {
  return apiPatch<MemoryEntry[]>(`/api/v1/memory-entries/${memoryId}`, options);
}
```

#### 修改 3.4 — 后端支持 summary 更新

**文件**: `apps/server/src/routes/memory.route.ts`

PATCH 路由的请求体校验增加 `summary` 可选字段。

**文件**: `apps/server/src/services/memory-governance.service.ts`

`updateMemoryEntry` 函数支持 `summary` 字段更新：

```typescript
export function updateMemoryEntry(
  memoryId: string,
  updates: { active?: boolean; expiresAt?: number | null; summary?: string },
): MemoryEntry[] {
  // ... 在 mock 模式下更新 entry.summary
  // ... 在 openclaw 模式下需要写回 MEMORY.md（或提示不支持）
}
```

---

### Fix 4: "告警" → "警告"

**文件与具体修改**:

| 文件 | 行号 | 修改前 | 修改后 |
|------|------|--------|--------|
| `apps/web/src/components/ui/tab-bar.tsx` | L25 | `label: "告警"` | `label: "警告"` |
| `apps/web/src/features/alerts/components/alerts-panel.tsx` | L34 | `"告警已标记已读。"` | `"警告已标记已读。"` |
| `apps/web/src/features/alerts/components/alerts-panel.tsx` | L39 | `title="异常告警"` | `title="异常警告"` |

---

### Fix 5: 任务描述清理 — 提取简洁任务名称

**文件**: `apps/server/src/adapters/openclaw-files.adapter.ts`

新增 `sanitizePromptSummary` 函数：

```typescript
function sanitizePromptSummary(content: string): string {
  let cleaned = content
    // 去除 markdown 代码块
    .replace(/```[\s\S]*?```/g, "")
    // 去除行内代码
    .replace(/`[^`]+`/g, "")
    // 去除 JSON 块（花括号包裹内容）
    .replace(/\{[\s\S]*?\}/g, "")
    // 去除方括号包裹的数组
    .replace(/\[[\s\S]*?\]/g, "")
    // 去除连续特殊字符（代码残留）
    .replace(/[<>=/\\|{}[\]()]{3,}/g, "")
    // 去除文件路径
    .replace(/(?:\/[\w.-]+){2,}/g, "")
    // 合并空白
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length > 60) {
    cleaned = cleaned.slice(0, 57) + "...";
  }

  return cleaned || "OpenClaw 任务";
}
```

应用到 `userPromptSummary` 生成处（约 L426-427）：

```diff
- const userPromptSummary = getTranscriptContent(promptEvent ?? {}) || "OpenClaw 任务";
+ const userPromptSummary = sanitizePromptSummary(getTranscriptContent(promptEvent ?? {}));
```

---

### Fix 6: 新增中文映射工具函数

**文件**: 新增 `apps/web/src/lib/i18n-maps.ts`

```typescript
import type { AgentStatusCode, RiskLevel } from "@clawview/shared";

export const STATUS_LABELS: Record<AgentStatusCode, string> = {
  online: "在线",
  thinking: "思考中",
  tool_calling: "调用工具中",
  awaiting_approval: "等待审批",
  degraded: "性能降级",
  offline: "离线",
  error: "出错",
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: "低",
  medium: "中",
  high: "高",
  critical: "紧急",
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  running: "进行中",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

export const COST_GRANULARITY_LABELS: Record<string, string> = {
  task: "本任务",
  daily: "今日",
  monthly: "本月",
};
```

---

### Fix 7: 全面汉化剩余英文 UI

以下为各文件需要修改的具体位置：

#### 7.1 — status-badge.tsx

```diff
- return <Pill tone={tone}>{status.replaceAll("_", " ")}</Pill>;
+ return <Pill tone={tone}>{STATUS_LABELS[status] ?? status}</Pill>;
```

#### 7.2 — cost-panel.tsx

```diff
  <SegmentedControl
    options={[
-     { value: "task", label: "Task" },
-     { value: "daily", label: "Today" },
-     { value: "monthly", label: "Month" },
+     { value: "task", label: "本任务" },
+     { value: "daily", label: "今日" },
+     { value: "monthly", label: "本月" },
    ]}
```

budget label 也改中文：

```diff
  <BudgetBar
    budget={selectedCost.budget}
-   label={`${selectedGranularity} budget`}
+   label={`${COST_GRANULARITY_LABELS[selectedGranularity] ?? selectedGranularity}预算`}
  />
```

#### 7.3 — task-flow-panel.tsx

```diff
- action={<Pill>{task.status}</Pill>}
+ action={<Pill>{TASK_STATUS_LABELS[task.status] ?? task.status}</Pill>}

- <p className="timeline-meta">streaming...</p>
+ <p className="timeline-meta">生成中...</p>

- Jump to latest
+ 跳到最新
```

#### 7.4 — task-detail-sheet.tsx

```diff
- <p>状态：{task.status}</p>
+ <p>状态：{TASK_STATUS_LABELS[task.status] ?? task.status}</p>
```

#### 7.5 — alert-card.tsx

```diff
- {alert.riskLevel}
+ {RISK_LABELS[alert.riskLevel] ?? alert.riskLevel}
```

#### 7.6 — alerts-panel.tsx

```diff
- <div className="empty-state-inline">All clear - no alerts</div>
+ <div className="empty-state-inline">暂无警告</div>
```

#### 7.7 — approval-banner.tsx

```diff
- <p className="approval-banner-kicker">APPROVAL REQUIRED</p>
+ <p className="approval-banner-kicker">需要审批</p>

- Risk: {approval.riskLevel.toUpperCase()} ·{" "}
+ 风险等级：{RISK_LABELS[approval.riskLevel] ?? approval.riskLevel} ·{" "}
```

#### 7.8 — status-panel.tsx

```diff
- value={status.activeTaskId ?? "空闲"}
+ value={status.activeTaskId ? "运行中" : "空闲"}
```

---

## 三、修改文件清单汇总

### 需要新增的文件（1 个）

| 文件路径 | 用途 |
|----------|------|
| `apps/web/src/lib/i18n-maps.ts` | 中英文映射工具函数 |

### 需要修改的文件（16 个）

| # | 文件路径 | 相关 Fix |
|---|----------|----------|
| 1 | `apps/web/vite.config.ts` | Fix 1 |
| 2 | `apps/server/src/index.ts` | Fix 1 |
| 3 | `apps/server/src/lib/config.ts` | Fix 1 |
| 4 | `packages/shared/src/types/cost.ts` | Fix 2 |
| 5 | `packages/shared/src/types/task-execution.ts` | Fix 2 |
| 6 | `packages/shared/src/validators/task-execution.schema.ts` | Fix 2 |
| 7 | `packages/shared/src/utils/format-cost.ts` | Fix 2 |
| 8 | `apps/server/src/adapters/openclaw-files.adapter.ts` | Fix 2, Fix 5 |
| 9 | `apps/web/src/features/memory/components/memory-detail-sheet.tsx` | Fix 3 |
| 10 | `apps/web/src/features/memory/components/memory-panel.tsx` | Fix 3 |
| 11 | `apps/web/src/services/endpoints/memory.api.ts` | Fix 3 |
| 12 | `apps/server/src/routes/memory.route.ts` | Fix 3 |
| 13 | `apps/server/src/services/memory-governance.service.ts` | Fix 3 |
| 14 | `apps/web/src/components/ui/tab-bar.tsx` | Fix 4 |
| 15 | `apps/web/src/features/alerts/components/alerts-panel.tsx` | Fix 4, Fix 7 |
| 16 | `apps/web/src/components/composed/status-badge.tsx` | Fix 7 |
| 17 | `apps/web/src/features/cost/components/cost-panel.tsx` | Fix 7 |
| 18 | `apps/web/src/features/task-flow/components/task-flow-panel.tsx` | Fix 7 |
| 19 | `apps/web/src/features/task-flow/components/task-detail-sheet.tsx` | Fix 7 |
| 20 | `apps/web/src/features/alerts/components/alert-card.tsx` | Fix 7 |
| 21 | `apps/web/src/features/approval/components/approval-banner.tsx` | Fix 7 |
| 22 | `apps/web/src/features/status/components/status-panel.tsx` | Fix 7 |

---

## 四、修复优先级与建议执行顺序

```
Fix 1 (局域网访问)         ← 最高优先级，解除手机端访问阻塞
  ↓
Fix 6 (中文映射工具函数)    ← Fix 7 的前置依赖
  ↓
Fix 4 (告警→警告)          ← 简单文案替换
  ↓
Fix 7 (全面汉化 UI)        ← 依赖 Fix 6 的映射函数
  ↓
Fix 2 (计费精度)           ← 跨前后端改动
  ↓
Fix 5 (任务描述清理)        ← 后端单文件改动
  ↓
Fix 3 (记忆编辑)           ← 改动最多，前后端均需改
```

Fix 之间除 Fix 6 → Fix 7 有依赖外，其余均可并行执行。
