import type { AlertEvent, ApprovalRequest } from "@clawview/shared";

import { AlertsPanel } from "@/features/alerts/components/alerts-panel";
import { ApprovalPanel } from "@/features/approval/components/approval-panel";

interface AlertsTabProps {
  alerts: AlertEvent[];
  approvals: ApprovalRequest[];
}

export function AlertsTab({ alerts, approvals }: AlertsTabProps) {
  return (
    <div className="content-stack alerts-tab">
      <ApprovalPanel approvals={approvals} />
      <AlertsPanel alerts={alerts} />
    </div>
  );
}
