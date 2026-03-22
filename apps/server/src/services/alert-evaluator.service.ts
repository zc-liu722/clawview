import type { AlertEvent } from "@clawview/shared";

import { readOpenClawSnapshot } from "../adapters/openclaw-files.adapter";
import { config } from "../lib/config";
import { getDashboardSnapshot, mockAlerts } from "./mock-data.service";

/**
 * Returns alert cards that should currently be surfaced to operators.
 * Alert generation is mocked for the MVP but still passes through this boundary.
 */
export function getActiveAlerts(): AlertEvent[] {
  if (config.CLAWVIEW_DATA_SOURCE === "openclaw") {
    return readOpenClawSnapshot().alerts;
  }

  return getDashboardSnapshot().alerts;
}

export function acknowledgeAlert(alertId: string): AlertEvent[] {
  if (config.CLAWVIEW_DATA_SOURCE === "openclaw") {
    return readOpenClawSnapshot().alerts.map((alert) =>
      alert.id === alertId ? { ...alert, open: false } : alert,
    );
  }

  const target = mockAlerts.find((alert) => alert.id === alertId);
  if (target) {
    target.open = false;
  }

  return mockAlerts;
}
