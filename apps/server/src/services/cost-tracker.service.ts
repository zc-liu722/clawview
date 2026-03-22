import type { CostSnapshot } from "@clawview/shared";

import { readOpenClawSnapshot } from "../adapters/openclaw-files.adapter";
import { config } from "../lib/config";
import { getDashboardSnapshot, mockCosts } from "./mock-data.service";

/**
 * Returns task, daily, and monthly cost views for the current agent.
 * This service is the single source of truth for spend-related responses.
 */
export function getCostSnapshots(): CostSnapshot[] {
  if (config.CLAWVIEW_DATA_SOURCE === "openclaw") {
    return readOpenClawSnapshot().costs;
  }

  return getDashboardSnapshot().costs;
}

export function updateBudget(options: {
  dailyLimitCents: number;
  monthlyLimitCents: number;
  alertThresholdPercent: number;
}): CostSnapshot[] {
  if (config.CLAWVIEW_DATA_SOURCE === "openclaw") {
    return readOpenClawSnapshot().costs;
  }

  for (const snapshot of mockCosts) {
    if (snapshot.granularity === "daily") {
      snapshot.budget.limitCents = options.dailyLimitCents;
      snapshot.budget.usageRatio =
        snapshot.totalCostCents / options.dailyLimitCents;
      snapshot.budget.exceeded =
        snapshot.budget.usageRatio >= options.alertThresholdPercent / 100;
    }

    if (snapshot.granularity === "monthly") {
      snapshot.budget.limitCents = options.monthlyLimitCents;
      snapshot.budget.usageRatio =
        snapshot.totalCostCents / options.monthlyLimitCents;
      snapshot.budget.exceeded =
        snapshot.budget.usageRatio >= options.alertThresholdPercent / 100;
    }
  }

  return mockCosts;
}
