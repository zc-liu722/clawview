import type { CostSnapshot } from "@clawview/shared";

import { apiPost } from "../api-client";

export function updateBudget(options: {
  dailyLimitCents: number;
  monthlyLimitCents: number;
  alertThresholdPercent: number;
}): Promise<CostSnapshot[]> {
  return apiPost<CostSnapshot[]>("/api/v1/costs/budget", options);
}
