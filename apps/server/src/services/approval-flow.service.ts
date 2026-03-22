import type { ApprovalRequest } from "@clawview/shared";

import { readOpenClawSnapshot } from "../adapters/openclaw-files.adapter";
import { config } from "../lib/config";
import { mockApprovals } from "./mock-data.service";

/**
 * Resolves a pending approval request and returns the refreshed approval list.
 * In production this would forward the decision back to OpenClaw's control plane.
 */
export function resolveApproval(options: {
  approvalId: string;
  decision: "approved" | "denied";
}): ApprovalRequest[] {
  if (config.CLAWVIEW_DATA_SOURCE === "openclaw") {
    return readOpenClawSnapshot().approvals.map((approval) =>
      approval.id === options.approvalId
        ? { ...approval, status: options.decision }
        : approval,
    );
  }

  const approval = mockApprovals.find((item) => item.id === options.approvalId);
  if (approval) {
    approval.status = options.decision;
  }

  return mockApprovals;
}
