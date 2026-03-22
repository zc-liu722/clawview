import type {
  AgentStatus,
  AlertEvent,
  ApprovalRequest,
  CostSnapshot,
  MemoryEntry,
  TaskExecutionLog,
} from "@clawview/shared";

export interface DashboardPayload {
  status: AgentStatus;
  tasks: TaskExecutionLog[];
  costs: CostSnapshot[];
  memory: MemoryEntry[];
  alerts: AlertEvent[];
  approvals: ApprovalRequest[];
}

export interface ApiEnvelope<TData> {
  data: TData;
  meta?: {
    timing?: number;
  };
}
