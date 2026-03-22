import type {
  AgentStatus,
  AlertEvent,
  ApprovalRequest,
  CostSnapshot,
  MemoryEntry,
  TaskExecutionLog,
} from "@clawview/shared";

import { readOpenClawSnapshot } from "../adapters/openclaw-files.adapter";
import { config } from "../lib/config";
import { getDashboardSnapshot } from "./mock-data.service";

export interface DashboardSnapshot {
  status: AgentStatus;
  tasks: TaskExecutionLog[];
  costs: CostSnapshot[];
  memory: MemoryEntry[];
  alerts: AlertEvent[];
  approvals: ApprovalRequest[];
}

/**
 * Returns the full dashboard snapshot used by the mobile console.
 * Throws only domain-specific errors when upstream adapters fail.
 */
export function getDashboardData(): DashboardSnapshot {
  if (config.CLAWVIEW_DATA_SOURCE === "openclaw") {
    return readOpenClawSnapshot();
  }

  return getDashboardSnapshot();
}
