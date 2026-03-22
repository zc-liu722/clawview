import type { DashboardPayload } from "@/types/api";

import { apiGet } from "../api-client";

export function fetchDashboard(): Promise<DashboardPayload> {
  return apiGet<DashboardPayload>("/api/v1/dashboard");
}
