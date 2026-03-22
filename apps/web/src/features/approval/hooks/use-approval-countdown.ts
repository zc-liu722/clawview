import { useEffect, useState } from "react";

import { APPROVAL_COUNTDOWN_INTERVAL_MS } from "@/lib/constants";
import { formatCountdown } from "@/lib/format";

export function useApprovalCountdown(expiresAt: number | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (expiresAt === null) {
      return;
    }

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, APPROVAL_COUNTDOWN_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [expiresAt]);

  const remainingMs = expiresAt === null ? 0 : Math.max(0, expiresAt - now);

  return {
    remainingMs,
    remainingText: formatCountdown(remainingMs),
    isExpired: remainingMs === 0,
  };
}
