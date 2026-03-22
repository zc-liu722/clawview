import type { ApprovalRequest } from "@clawview/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { DASHBOARD_QUERY_KEY } from "@/lib/constants";
import { submitApprovalDecision } from "@/services/endpoints/approval.api";
import { useToastStore } from "@/stores/toast.store";
import type { DashboardPayload } from "@/types/api";

import { useApprovalCountdown } from "../hooks/use-approval-countdown";

interface ApprovalPanelProps {
  approvals: ApprovalRequest[];
}

export function ApprovalPanel({ approvals }: ApprovalPanelProps) {
  const queryClient = useQueryClient();
  const pushToast = useToastStore((state) => state.push);
  const mutation = useMutation({
    mutationFn: submitApprovalDecision,
    onSuccess: (updatedApprovals) => {
      queryClient.setQueryData<DashboardPayload | undefined>(
        DASHBOARD_QUERY_KEY,
        (current) =>
          current
            ? {
                ...current,
                approvals: updatedApprovals,
              }
            : current,
      );
      pushToast("审批结果已提交。");
    },
    onError: () => {
      pushToast("审批提交失败，请稍后重试。");
    },
  });

  return (
    <Panel title="高危审批" eyebrow="Human in the loop">
      <div className="stack-list">
        {approvals.map((approval) => (
          <ApprovalCard
            key={approval.id}
            approval={approval}
            pending={mutation.isPending}
            onApprove={() => {
              mutation.mutate({
                approvalId: approval.id,
                decision: "approved",
              });
            }}
            onDeny={() => {
              mutation.mutate({
                approvalId: approval.id,
                decision: "denied",
              });
            }}
          />
        ))}
      </div>
    </Panel>
  );
}

interface ApprovalCardProps {
  approval: ApprovalRequest;
  pending: boolean;
  onApprove: () => void;
  onDeny: () => void;
}

function ApprovalCard({
  approval,
  pending,
  onApprove,
  onDeny,
}: ApprovalCardProps) {
  const countdown = useApprovalCountdown(approval.expiresAt);

  return (
    <article
      className={`list-card approval-card ${approval.status === "pending" ? "is-pending" : "is-resolved"}`}
    >
      <div>
        <strong>{approval.actionLabel}</strong>
        <p>{approval.reason}</p>
        <p className="muted-text">
          状态：{approval.status}
          {approval.status === "pending" ? ` · ${countdown.remainingText} 后过期` : ""}
        </p>
      </div>
      <div className="button-row">
        <Button
          tone="secondary"
          disabled={approval.status !== "pending" || pending}
          onClick={onDeny}
        >
          拒绝
        </Button>
        <Button disabled={approval.status !== "pending" || pending} onClick={onApprove}>
          通过
        </Button>
      </div>
    </article>
  );
}
