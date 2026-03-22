import type { ClawEventType } from "../constants/event-types";
import type { AgentStatus } from "./agent-status";
import type { AlertEvent } from "./alert";
import type { ApprovalRequest } from "./approval";
import type { CostSnapshot } from "./cost";
import type { MemoryEntry } from "./memory";
import type { TaskExecutionLog } from "./task-execution";

export interface ClawEventPayloadMap {
  status_change: AgentStatus;
  step_update: TaskExecutionLog;
  cost_update: CostSnapshot[];
  memory_change: MemoryEntry[];
  alert: AlertEvent[];
  approval_request: ApprovalRequest[];
}

export interface ClawEvent<TType extends ClawEventType = ClawEventType> {
  /** Stable realtime event identifier. */
  id: string;
  /** Event type used for discriminated union handling. */
  type: TType;
  /** Timestamp of the event in Unix milliseconds. */
  timestamp: number;
  /** Agent identifier used for filtering subscriptions. */
  agentId: string;
  /** Source adapter that produced the event. */
  source: "file_watcher" | "cli_bridge" | "webhook";
  /** Structured payload corresponding to the event type. */
  payload: ClawEventPayloadMap[TType];
}

export type ClawEventUnion = {
  [TType in ClawEventType]: ClawEvent<TType>;
}[ClawEventType];
