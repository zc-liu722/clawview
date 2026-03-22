# ClawView — 核心领域模型与接口契约

> **文档版本**: v1.0.0
> **约定**: 所有类型定义使用 TypeScript 语法，存放于 `packages/shared/src/types/`。
> **原则**: 这是前后端之间的**数据契约**。任何字段的增删改必须双方同步。

---

## 1. 基础类型 (Primitives)

```typescript
/** ULID 格式的唯一标识符，天然按时间排序 */
type EntityId = string;

/** Unix 毫秒时间戳 */
type UnixTimestampMs = number;

/** ISO 8601 格式日期字符串 (仅用于 API 响应中的人类可读字段) */
type ISODateString = string;

/** 以"分"为单位的金额 (避免浮点精度问题，¥1.23 = 123) */
type AmountInCents = number;

/** Token 数量 */
type TokenCount = number;
```

---

## 2. 核心领域模型

### 2.1 AgentStatus — Agent 状态指示灯

这是 ClawView 最核心的数据模型，对应 MVP 功能 #1「状态灯」。

```typescript
/**
 * Agent 运行状态码
 * 按严重程度递增排列，UI 层可据此决定颜色映射
 */
enum AgentStatusCode {
  /** 设备在线，Gateway 连接正常，空闲中 */
  ONLINE = 'online',
  /** 正在处理用户请求（LLM 推理中） */
  THINKING = 'thinking',
  /** 正在调用外部工具（搜索、文件读写、API 调用等） */
  TOOL_CALLING = 'tool_calling',
  /** 等待用户授权（Human-in-the-loop 审批） */
  AWAITING_APPROVAL = 'awaiting_approval',
  /** 设备在线但遇到可恢复错误（如 rate limit、临时网络问题） */
  DEGRADED = 'degraded',
  /** 设备离线或 Gateway 连接断开 */
  OFFLINE = 'offline',
  /** 不可恢复的错误状态 */
  ERROR = 'error',
}

/**
 * Agent 实时状态快照
 * 推送频率：状态变更时即时推送 + 每 30 秒心跳同步
 */
interface AgentStatus {
  /** Agent 实例唯一标识 */
  agentId: EntityId;

  /** 用户为 Agent 设定的昵称 */
  agentName: string;

  /** 当前状态码 */
  status: AgentStatusCode;

  /** 状态的人类可读描述（由 Narrative Engine 生成） */
  statusText: string;

  /** 当前状态持续时间起点 */
  statusSince: UnixTimestampMs;

  /** 设备最近一次心跳时间 */
  lastHeartbeat: UnixTimestampMs;

  /** Gateway 连接状态 */
  gatewayConnected: boolean;

  /** 当前正在执行的任务 ID（空闲时为 null） */
  activeTaskId: EntityId | null;

  /** 已连接的聊天渠道列表 */
  connectedChannels: ChannelInfo[];
}

interface ChannelInfo {
  /** 渠道类型 */
  type: 'telegram' | 'whatsapp' | 'slack' | 'discord' | 'feishu' | 'wechat' | 'other';
  /** 渠道显示名称 */
  name: string;
  /** 渠道连接状态 */
  connected: boolean;
}
```

### 2.2 TaskExecutionLog — 任务步骤流

对应 MVP 功能 #2「任务步骤流」。这是将 OpenClaw 的 transcript/session 数据翻译为用户可读步骤的核心模型。

```typescript
/**
 * 步骤状态
 */
enum StepStatus {
  /** 排队中，尚未开始 */
  PENDING = 'pending',
  /** 正在执行 */
  RUNNING = 'running',
  /** 执行成功 */
  COMPLETED = 'completed',
  /** 执行失败 */
  FAILED = 'failed',
  /** 被用户取消 */
  CANCELLED = 'cancelled',
  /** 等待用户审批 */
  AWAITING_APPROVAL = 'awaiting_approval',
}

/**
 * 任务步骤流中的单个步骤
 */
interface TaskStep {
  /** 步骤唯一标识 */
  id: EntityId;

  /** 步骤序号（从 1 开始） */
  order: number;

  /** 步骤状态 */
  status: StepStatus;

  /**
   * 人类可读的步骤描述（由 Narrative Engine 翻译）
   * 示例："正在搜索'公司融资新闻'相关网页"
   */
  narrative: string;

  /**
   * 原始技术事件类型（用于 debug 和高级用户展开查看）
   * 示例："tool_call:web_search"
   */
  rawEventType: string;

  /** 使用的工具名称（如果是工具调用步骤） */
  toolName: string | null;

  /** 使用的模型名称 */
  modelName: string | null;

  /** 本步骤消耗的 token 数 */
  tokensUsed: TokenCount;

  /** 本步骤花费（分） */
  costCents: AmountInCents;

  /** 步骤开始时间 */
  startedAt: UnixTimestampMs;

  /** 步骤结束时间（进行中为 null） */
  completedAt: UnixTimestampMs | null;

  /** 步骤时长（毫秒，进行中为实时计算） */
  durationMs: number | null;

  /** 如果失败，错误信息（已脱敏） */
  errorMessage: string | null;
}

/**
 * 任务执行日志（一次完整的任务记录）
 */
interface TaskExecutionLog {
  /** 任务唯一标识 */
  taskId: EntityId;

  /** 关联的 OpenClaw session ID */
  sessionId: string;

  /** 关联的 Agent ID */
  agentId: EntityId;

  /** 用户发起任务的原始指令（脱敏后） */
  userPromptSummary: string;

  /** 任务状态 */
  status: 'running' | 'completed' | 'failed' | 'cancelled';

  /** 任务包含的步骤列表 */
  steps: TaskStep[];

  /** 任务总消耗 token */
  totalTokens: TokenCount;

  /** 任务总花费（分） */
  totalCostCents: AmountInCents;

  /** 主要消耗的模型 */
  primaryModel: string;

  /** 任务发起时间 */
  startedAt: UnixTimestampMs;

  /** 任务完成时间 */
  completedAt: UnixTimestampMs | null;

  /** 任务来源渠道 */
  sourceChannel: ChannelInfo['type'];
}
```

### 2.3 CostSnapshot — 成本追踪快照

对应 MVP 功能 #3「实时 Token / 金额」。

```typescript
/**
 * 单个模型的使用明细
 */
interface ModelUsageBreakdown {
  /** 模型标识 (如 "gpt-4o", "gpt-4o-mini", "claude-sonnet-4-20250514") */
  modelId: string;

  /** 模型显示名称 */
  modelDisplayName: string;

  /** 输入 token 数 */
  inputTokens: TokenCount;

  /** 输出 token 数 */
  outputTokens: TokenCount;

  /** 该模型花费（分） */
  costCents: AmountInCents;

  /** 调用次数 */
  callCount: number;
}

/**
 * 成本快照（多粒度复用）
 */
interface CostSnapshot {
  /** 快照唯一标识 */
  id: EntityId;

  /** 关联的 Agent ID */
  agentId: EntityId;

  /** 快照粒度 */
  granularity: 'task' | 'daily' | 'monthly';

  /** 关联的任务 ID（粒度为 task 时有值） */
  taskId: EntityId | null;

  /** 快照时间窗口起点 */
  periodStart: UnixTimestampMs;

  /** 快照时间窗口终点 */
  periodEnd: UnixTimestampMs;

  /** 总 token 数 */
  totalTokens: TokenCount;

  /** 总花费（分） */
  totalCostCents: AmountInCents;

  /** 按模型拆分的使用明细 */
  breakdown: ModelUsageBreakdown[];

  /** 用户设定的预算上限（分，null 表示未设置） */
  budgetLimitCents: AmountInCents | null;

  /** 预算使用百分比 (0-100+，可超 100 表示超预算) */
  budgetUsagePercent: number | null;

  /** 相比上一同等周期的变化百分比 (+/-) */
  periodOverPeriodChangePercent: number | null;

  /** 快照生成时间 */
  updatedAt: UnixTimestampMs;
}
```

### 2.4 MemoryEntry — 记忆条目

对应 MVP 功能 #4「记忆中心」。

```typescript
/**
 * 记忆来源类型
 */
enum MemorySourceType {
  /** 来自对话中的显式记忆 */
  CONVERSATION = 'conversation',
  /** 来自文件读取 */
  FILE_READ = 'file_read',
  /** 来自用户手动添加 */
  MANUAL = 'manual',
  /** 来自工具调用结果 */
  TOOL_RESULT = 'tool_result',
  /** 来源不明 */
  UNKNOWN = 'unknown',
}

/**
 * 记忆状态
 */
enum MemoryStatus {
  /** 正常活跃，参与上下文召回 */
  ACTIVE = 'active',
  /** 已被用户标记为不再引用 */
  MUTED = 'muted',
  /** 已设置过期，过期后自动归档 */
  EXPIRING = 'expiring',
  /** 已归档（不参与召回，但未删除） */
  ARCHIVED = 'archived',
  /** 已被用户永久删除 */
  DELETED = 'deleted',
}

/**
 * Agent 记忆条目
 */
interface MemoryEntry {
  /** 记忆条目唯一标识 */
  id: EntityId;

  /** 关联的 Agent ID */
  agentId: EntityId;

  /**
   * 记忆内容摘要（人类可读）
   * 示例："用户偏好早上 9 点开会"
   */
  summary: string;

  /**
   * 记忆原文（可能较长，懒加载）
   * 已脱敏处理
   */
  rawContent: string;

  /** 记忆来源类型 */
  sourceType: MemorySourceType;

  /** 来源关联（对话 ID、文件路径等，已脱敏） */
  sourceReference: string;

  /** 记忆所属的 OpenClaw 文件 */
  memoryFile: string;

  /** 当前状态 */
  status: MemoryStatus;

  /** 记忆被 Agent 引用/使用的次数 */
  hitCount: number;

  /** 最后一次被引用的时间 */
  lastHitAt: UnixTimestampMs | null;

  /** 创建时间 */
  createdAt: UnixTimestampMs;

  /** 最后修改时间 */
  updatedAt: UnixTimestampMs;

  /** 用户设定的过期时间（null 表示永不过期） */
  expiresAt: UnixTimestampMs | null;

  /** 关联的标签（用户可自定义） */
  tags: string[];
}
```

### 2.5 ApprovalRequest — 高危审批请求

对应投资人建议中的核心功能「移动端零信任安全阀 / Human-in-the-loop」。

```typescript
/**
 * 风险等级
 */
enum RiskLevel {
  /** 低风险：通知即可，无需审批 */
  LOW = 'low',
  /** 中风险：推送通知 + 可选审批 */
  MEDIUM = 'medium',
  /** 高风险：必须审批才能继续 */
  HIGH = 'high',
  /** 极高风险：必须审批 + 二次验证（PIN/Biometric） */
  CRITICAL = 'critical',
}

/**
 * 审批决策
 */
enum ApprovalDecision {
  /** 等待用户决策 */
  PENDING = 'pending',
  /** 用户批准 */
  APPROVED = 'approved',
  /** 用户拒绝 */
  DENIED = 'denied',
  /** 超时自动拒绝 */
  TIMED_OUT = 'timed_out',
  /** 系统自动阻断（如检测到 prompt injection） */
  AUTO_BLOCKED = 'auto_blocked',
}

/**
 * 触发审批的动作类型
 */
enum ApprovalTriggerType {
  /** 费用超过单次阈值 */
  COST_THRESHOLD = 'cost_threshold',
  /** 文件删除操作 */
  FILE_DELETION = 'file_deletion',
  /** 发送外部消息（邮件、IM） */
  EXTERNAL_MESSAGE = 'external_message',
  /** 访问敏感目录 */
  SENSITIVE_PATH_ACCESS = 'sensitive_path_access',
  /** 执行系统/Shell 命令 */
  SYSTEM_COMMAND = 'system_command',
  /** 批量操作（超过 N 条） */
  BULK_OPERATION = 'bulk_operation',
  /** 安全异常检测（prompt injection 等） */
  SECURITY_ANOMALY = 'security_anomaly',
  /** 自定义规则触发 */
  CUSTOM_RULE = 'custom_rule',
}

/**
 * 高危审批请求
 */
interface ApprovalRequest {
  /** 审批请求唯一标识 */
  id: EntityId;

  /** 关联的 Agent ID */
  agentId: EntityId;

  /** 关联的任务 ID */
  taskId: EntityId;

  /** 关联的步骤 ID */
  stepId: EntityId;

  /** 触发类型 */
  triggerType: ApprovalTriggerType;

  /** 风险等级 */
  riskLevel: RiskLevel;

  /**
   * 人类可读的操作描述（由 Narrative Engine 生成）
   * 示例："Agent 即将删除 /data/reports/ 目录下的 23 个文件"
   */
  narrative: string;

  /**
   * 技术细节（高级用户可展开查看）
   * 示例：{ tool: "file_delete", paths: ["..."], count: 23 }
   */
  technicalDetail: Record<string, unknown>;

  /** 预估风险/影响（如费用预估） */
  estimatedImpact: string;

  /** 当前审批决策状态 */
  decision: ApprovalDecision;

  /** 做出决策的用户 ID（系统自动决策时为 'system'） */
  decidedBy: EntityId | 'system' | null;

  /** 审批超时时间（超时后自动 DENIED） */
  expiresAt: UnixTimestampMs;

  /** 创建时间 */
  createdAt: UnixTimestampMs;

  /** 决策时间 */
  decidedAt: UnixTimestampMs | null;
}
```

### 2.6 AlertEvent — 异常告警事件

对应 MVP 功能 #5「异常告警」。

```typescript
/**
 * 告警严重级别
 */
enum AlertSeverity {
  /** 信息级：正常运行信息，仅记录 */
  INFO = 'info',
  /** 警告级：需要关注但不紧急 */
  WARNING = 'warning',
  /** 错误级：功能受损，需要处理 */
  ERROR = 'error',
  /** 严重级：系统级问题，需要立即处理 */
  CRITICAL = 'critical',
}

/**
 * 告警类别
 */
enum AlertCategory {
  /** 循环调用检测 */
  LOOP_DETECTION = 'loop_detection',
  /** 成本异常（突增、超预算） */
  COST_ANOMALY = 'cost_anomaly',
  /** 工具调用失败 */
  TOOL_FAILURE = 'tool_failure',
  /** 设备/Gateway 离线 */
  CONNECTIVITY_LOSS = 'connectivity_loss',
  /** 权限失效（API Key 过期等） */
  AUTH_FAILURE = 'auth_failure',
  /** 安全威胁（Prompt Injection 等） */
  SECURITY_THREAT = 'security_threat',
  /** 模型服务异常（rate limit、超时） */
  MODEL_SERVICE_ISSUE = 'model_service_issue',
  /** 记忆异常（记忆膨胀、敏感内容写入） */
  MEMORY_ANOMALY = 'memory_anomaly',
}

/**
 * 异常告警事件
 */
interface AlertEvent {
  /** 告警唯一标识 */
  id: EntityId;

  /** 关联的 Agent ID */
  agentId: EntityId;

  /** 关联的任务 ID（如果与特定任务相关） */
  taskId: EntityId | null;

  /** 告警严重级别 */
  severity: AlertSeverity;

  /** 告警类别 */
  category: AlertCategory;

  /**
   * 人类可读的告警标题
   * 示例："成本异常：过去 10 分钟花费 ¥15.80，超出日常均值 300%"
   */
  title: string;

  /**
   * 详细描述（支持简单 Markdown）
   */
  description: string;

  /** 建议的用户操作 */
  suggestedAction: string | null;

  /** 是否已读 */
  acknowledged: boolean;

  /** 确认已读的用户 ID */
  acknowledgedBy: EntityId | null;

  /** 确认时间 */
  acknowledgedAt: UnixTimestampMs | null;

  /** 是否已触发推送通知 */
  notificationSent: boolean;

  /** 告警触发时间 */
  createdAt: UnixTimestampMs;

  /** 告警自动过期时间（过期后归档） */
  expiresAt: UnixTimestampMs;
}
```

---

## 3. 基础事件模型 (ClawEvent)

所有从 OpenClaw 采集的原始数据，经过 Adapter 层标准化后，统一为以下事件格式：

```typescript
/**
 * ClawView 标准化事件类型枚举
 */
enum ClawEventType {
  STATUS_CHANGE = 'status_change',
  TASK_STARTED = 'task_started',
  TASK_COMPLETED = 'task_completed',
  STEP_UPDATE = 'step_update',
  COST_UPDATE = 'cost_update',
  MEMORY_CHANGE = 'memory_change',
  ALERT_TRIGGERED = 'alert_triggered',
  APPROVAL_REQUESTED = 'approval_requested',
  APPROVAL_RESOLVED = 'approval_resolved',
  HEARTBEAT = 'heartbeat',
}

/**
 * 事件来源标识
 */
type EventSource = 'file_watcher' | 'cli_bridge' | 'webhook' | 'gateway_probe' | 'system';

/**
 * ClawView 内部标准化事件
 * 这是系统内部流转的基本单元，所有 Adapter 的输出都必须符合此结构
 */
interface ClawEvent {
  /** 事件唯一标识 (ULID) */
  id: EntityId;

  /** 关联的任务 ID */
  taskId: EntityId | null;

  /** OpenClaw session ID */
  sessionId: string | null;

  /** 关联的 Agent ID */
  agentId: EntityId;

  /** 事件类型 */
  type: ClawEventType;

  /** 事件产生的时间戳 */
  timestamp: UnixTimestampMs;

  /**
   * 事件载荷（具体结构由 type 决定）
   * 使用 Zod discriminated union 在运行时校验
   */
  payload: Record<string, unknown>;

  /** 事件来源 */
  source: EventSource;

  /** 事件版本（便于未来协议升级） */
  version: 1;
}
```

---

## 4. API 端点契约 (REST)

### 4.1 统一响应信封

```typescript
/** 成功响应 */
interface ApiSuccessResponse<T> {
  data: T;
  meta?: {
    /** 分页信息 */
    pagination?: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
    /** 服务端处理耗时（毫秒） */
    timingMs?: number;
  };
}

/** 错误响应 */
interface ApiErrorResponse {
  error: {
    /** 机器可读的错误码 (SCREAMING_SNAKE_CASE) */
    code: string;
    /** 人类可读的错误描述 */
    message: string;
    /** 额外错误细节（如字段校验错误列表） */
    details?: unknown;
  };
}
```

### 4.2 核心端点列表

| Method | Path | 描述 | Request | Response |
|--------|------|------|---------|----------|
| GET | `/api/v1/agents/:agentId/status` | 获取 Agent 实时状态 | — | `AgentStatus` |
| GET | `/api/v1/agents/:agentId/tasks` | 获取任务列表 | `?page&pageSize&status` | `TaskExecutionLog[]` |
| GET | `/api/v1/tasks/:taskId` | 获取单个任务详情（含步骤流） | — | `TaskExecutionLog` |
| GET | `/api/v1/agents/:agentId/cost` | 获取成本快照 | `?granularity&periodStart&periodEnd` | `CostSnapshot` |
| GET | `/api/v1/agents/:agentId/memories` | 获取记忆列表 | `?page&pageSize&status&search` | `MemoryEntry[]` |
| PATCH | `/api/v1/memories/:memoryId` | 更新记忆状态（mute/expire/archive） | `{ status, expiresAt? }` | `MemoryEntry` |
| DELETE | `/api/v1/memories/:memoryId` | 删除记忆 | — | `{ success: true }` |
| GET | `/api/v1/agents/:agentId/alerts` | 获取告警列表 | `?severity&acknowledged&page` | `AlertEvent[]` |
| PATCH | `/api/v1/alerts/:alertId/acknowledge` | 确认告警 | — | `AlertEvent` |
| GET | `/api/v1/agents/:agentId/approvals` | 获取待审批列表 | `?decision` | `ApprovalRequest[]` |
| POST | `/api/v1/approvals/:approvalId/decide` | 提交审批决策 | `{ decision: 'approved' \| 'denied' }` | `ApprovalRequest` |

### 4.3 SSE 端点

| Path | 描述 | 推送事件类型 |
|------|------|-------------|
| `/api/v1/agents/:agentId/events` | 该 Agent 的所有实时事件流 | `status_change`, `step_update`, `cost_update`, `alert_triggered`, `approval_requested` |

SSE 消息格式：

```
event: step_update
data: {"taskId":"01J...","step":{"id":"01J...","order":3,"status":"running","narrative":"正在搜索相关网页资料",...}}

event: cost_update
data: {"taskId":"01J...","totalTokens":4521,"totalCostCents":89}

:heartbeat
```

---

## 5. Zod Schema 示例

以下示例展示 `packages/shared/src/validators/` 中 schema 的编写模式：

```typescript
import { z } from 'zod';

export const agentStatusCodeSchema = z.enum([
  'online',
  'thinking',
  'tool_calling',
  'awaiting_approval',
  'degraded',
  'offline',
  'error',
]);

export const channelInfoSchema = z.object({
  type: z.enum(['telegram', 'whatsapp', 'slack', 'discord', 'feishu', 'wechat', 'other']),
  name: z.string().min(1).max(100),
  connected: z.boolean(),
});

export const agentStatusSchema = z.object({
  agentId: z.string().ulid(),
  agentName: z.string().min(1).max(50),
  status: agentStatusCodeSchema,
  statusText: z.string(),
  statusSince: z.number().int().positive(),
  lastHeartbeat: z.number().int().positive(),
  gatewayConnected: z.boolean(),
  activeTaskId: z.string().ulid().nullable(),
  connectedChannels: z.array(channelInfoSchema),
});

/** 从 Zod schema 推导 TypeScript 类型——确保运行时校验与编译时类型完全一致 */
export type AgentStatus = z.infer<typeof agentStatusSchema>;
```

> **最佳实践**: 在 `packages/shared` 中，优先定义 Zod schema，然后通过 `z.infer<>` 推导出 TypeScript 类型。这保证了运行时校验规则与编译时类型的**单一事实来源 (Single Source of Truth)**。上方第 2 节的 `interface` 定义仅作为领域模型的文档化描述，实际代码应以 Zod schema 为准。
