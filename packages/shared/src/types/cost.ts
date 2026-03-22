export interface ModelUsageBreakdown {
  /** Stable model identifier returned by the runtime or billing layer. */
  modelId: string;
  /** Human-readable model label rendered in the cost panel. */
  modelDisplayName: string;
  /** Input tokens consumed by this model. */
  inputTokens: number;
  /** Output tokens produced by this model. */
  outputTokens: number;
  /** Cost in cents attributed to this model, allowing fractional precision. */
  costCents: number;
  /** Number of model invocations within the snapshot window. */
  callCount: number;
}

export interface BudgetStatus {
  /** Budget ceiling in cents for the relevant period. */
  limitCents: number;
  /** Current spend in cents for the same period. */
  spentCents: number;
  /** Threshold progress from `0` to `1`, used for warnings. */
  usageRatio: number;
  /** Whether the budget threshold has been exceeded. */
  exceeded: boolean;
}

export interface CostSnapshot {
  /** Snapshot identifier for cache and event reconciliation. */
  id: string;
  /** Agent identifier that owns this snapshot. */
  agentId: string;
  /** Granularity represented by the snapshot window. */
  granularity: "task" | "daily" | "monthly";
  /** Associated task identifier for task-scoped snapshots. */
  taskId: string | null;
  /** Start timestamp of the aggregation window. */
  windowStartedAt: number;
  /** End timestamp of the aggregation window. */
  windowEndedAt: number;
  /** Total input tokens across all models. */
  inputTokens: number;
  /** Total output tokens across all models. */
  outputTokens: number;
  /** Total spend in cents across the window, allowing fractional precision. */
  totalCostCents: number;
  /** Whether the displayed cost is authoritative, partial, or unavailable. */
  costStatus: "available" | "partial" | "missing";
  /** Human-readable note used when cost data is incomplete. */
  note: string | null;
  /** Cost breakdown by model. */
  models: ModelUsageBreakdown[];
  /** Budget state rendered in warning and approval UI. */
  budget: BudgetStatus;
}
