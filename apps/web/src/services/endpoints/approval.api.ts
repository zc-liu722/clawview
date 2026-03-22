import type { ApprovalRequest } from "@clawview/shared";

import { apiPost } from "../api-client";

export function submitApprovalDecision(options: {
  approvalId: string;
  decision: "approved" | "denied";
}): Promise<ApprovalRequest[]> {
  return apiPost<ApprovalRequest[]>(
    `/api/v1/approvals/${options.approvalId}/decision`,
    { decision: options.decision },
  );
}
