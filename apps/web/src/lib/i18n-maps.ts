import type {
  AgentStatusCode,
  RiskLevel,
  TaskExecutionLog,
  TaskStep,
} from "@clawview/shared";

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

export const TASK_STATUS_LABELS: Record<TaskExecutionLog["status"], string> = {
  running: "进行中",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

export const STEP_STATUS_LABELS: Record<TaskStep["status"], string> = {
  pending: "待开始",
  running: "进行中",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
  awaiting_approval: "等待审批",
};

export const COST_GRANULARITY_LABELS: Record<
  "task" | "daily" | "monthly",
  string
> = {
  task: "本任务",
  daily: "今日",
  monthly: "本月",
};
