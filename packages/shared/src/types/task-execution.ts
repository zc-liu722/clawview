import type { ModelUsageBreakdown } from "./cost";

export type StepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "awaiting_approval";

export interface TaskStep {
  /** Stable step identifier within a task flow. */
  id: string;
  /** User-facing order number, starting at 1. */
  order: number;
  /** Execution status used for visual progress treatment. */
  status: StepStatus;
  /** Narrative sentence shown to explain the current work in plain language. */
  narrative: string;
  /** Raw event category retained for debug views. */
  rawEventType: string;
  /** Tool invoked for this step, when applicable. */
  toolName: string | null;
  /** Model chosen for the step, when applicable. */
  modelName: string | null;
  /** Tokens consumed by this step. */
  tokensUsed: number;
  /** Monetary cost in cents for this step, allowing fractional precision. */
  costCents: number;
  /** Whether the cost came from upstream billing or local estimation. */
  costSource?: "authoritative" | "estimated" | "missing";
  /** Start timestamp of the step. */
  startedAt: number;
  /** Completion timestamp of the step, or `null` while running. */
  completedAt: number | null;
  /** Step duration in milliseconds, or `null` while it is still running. */
  durationMs: number | null;
  /** Sanitized failure message when the step does not succeed. */
  errorMessage: string | null;
}

export interface TaskExecutionLog {
  /** Stable task identifier used for routing and grouping events. */
  taskId: string;
  /** Upstream OpenClaw session identifier associated with the task. */
  sessionId: string;
  /** Owning agent identifier. */
  agentId: string;
  /** Sanitized summary of the user's original request. */
  userPromptSummary: string;
  /** High-level task lifecycle status for the dashboard. */
  status: "running" | "completed" | "failed" | "cancelled";
  /** Ordered list of translated task steps. */
  steps: TaskStep[];
  /** Total token usage aggregated from all steps. */
  totalTokens: number;
  /** Total monetary cost in cents, allowing fractional precision. */
  totalCostCents: number;
  /** Whether the total cost came from upstream billing or local estimation. */
  costSource?: "authoritative" | "estimated" | "missing";
  /** Full model aggregation used for cost summaries beyond the visible steps. */
  costModels?: ModelUsageBreakdown[];
  /** Model responsible for the largest share of cost or usage. */
  primaryModel: string;
  /** Task creation timestamp. */
  startedAt: number;
  /** Task completion timestamp, or `null` for active tasks. */
  completedAt: number | null;
  /** Source channel where the task was initiated. */
  sourceChannel:
    | "telegram"
    | "whatsapp"
    | "slack"
    | "discord"
    | "feishu"
    | "wechat"
    | "other";
}
