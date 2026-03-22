import type { AlertEvent } from "@clawview/shared";

import { apiPost } from "../api-client";

export function acknowledgeAlert(alertId: string): Promise<AlertEvent[]> {
  return apiPost<AlertEvent[]>(`/api/v1/alerts/${alertId}/acknowledge`, {});
}
