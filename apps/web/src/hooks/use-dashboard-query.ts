import { useQuery } from "@tanstack/react-query";

import { DASHBOARD_QUERY_KEY } from "@/lib/constants";
import { fetchDashboard } from "@/services/endpoints/dashboard.api";

export function useDashboardQuery() {
  return useQuery({
    queryKey: DASHBOARD_QUERY_KEY,
    queryFn: fetchDashboard,
    refetchOnWindowFocus: false,
    refetchInterval: 15_000,
  });
}
