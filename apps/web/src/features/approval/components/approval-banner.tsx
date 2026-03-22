import type { ApprovalRequest } from "@clawview/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { DASHBOARD_QUERY_KEY } from "@/lib/constants";
import { RISK_LABELS } from "@/lib/i18n-maps";
import { submitApprovalDecision } from "@/services/endpoints/approval.api";
import { useToastStore } from "@/stores/toast.store";
import type { DashboardPayload } from "@/types/api";

import { useApprovalCountdown } from "../hooks/use-approval-countdown";

interface ApprovalBannerProps {
  approval: ApprovalRequest | null;
}

export function ApprovalBanner({ approval }: ApprovalBannerProps) {
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

  const countdown = useApprovalCountdown(approval?.expiresAt ?? null);

  if (!approval) {
    return null;
  }

  return (
    <section className={`approval-banner risk-${approval.riskLevel}`}>
      <div className="approval-banner-copy">
        <p className="approval-banner-kicker">需要审批</p>
        <strong>{approval.actionLabel}</strong>
        <p>{approval.reason}</p>
        <p className="muted-text">
          风险等级：{RISK_LABELS[approval.riskLevel] ?? approval.riskLevel} ·{" "}
          {countdown.isExpired ? "已过期" : `${countdown.remainingText} 后过期`}
        </p>
      </div>
      <div className="approval-banner-actions">
        <Button
          className="approval-banner-button"
          disabled={mutation.isPending || countdown.isExpired}
          onClick={() =>
            mutation.mutate({ approvalId: approval.id, decision: "approved" })
          }
        >
          批准
        </Button>
        <Button
          tone="danger"
          className="approval-banner-button"
          disabled={mutation.isPending || countdown.isExpired}
          onClick={() =>
            mutation.mutate({ approvalId: approval.id, decision: "denied" })
          }
        >
          拒绝
        </Button>
      </div>
    </section>
  );
}
