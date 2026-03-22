import type { AgentStatusCode } from "@clawview/shared";

import { cn } from "@/lib/cn";

interface StatusLightProps {
  status: AgentStatusCode;
  className?: string;
}

export function StatusLight({ status, className }: StatusLightProps) {
  return (
    <span
      className={cn("status-light", `status-light-${status}`, className)}
      aria-hidden="true"
    />
  );
}
