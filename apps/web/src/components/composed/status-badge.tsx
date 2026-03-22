import type { AgentStatus } from "@clawview/shared";

import { Pill } from "@/components/ui/pill";
import { STATUS_LABELS } from "@/lib/i18n-maps";

interface StatusBadgeProps {
  status: AgentStatus["status"];
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const tone =
    status === "online"
      ? "good"
      : status === "degraded" || status === "awaiting_approval"
        ? "warn"
        : status === "offline" || status === "error"
          ? "danger"
          : "neutral";

  return <Pill tone={tone}>{STATUS_LABELS[status] ?? status}</Pill>;
}
