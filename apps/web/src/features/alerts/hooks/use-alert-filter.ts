import type { AlertEvent, RiskLevel } from "@clawview/shared";
import { useMemo, useState } from "react";

type AlertFilter = "all" | RiskLevel;

export function useAlertFilter(alerts: AlertEvent[]) {
  const [activeFilter, setFilter] = useState<AlertFilter>("all");

  const filteredAlerts = useMemo(() => {
    if (activeFilter === "all") {
      return alerts;
    }

    return alerts.filter((alert) => alert.riskLevel === activeFilter);
  }, [activeFilter, alerts]);

  return { filteredAlerts, activeFilter, setFilter };
}
