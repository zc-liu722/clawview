import type { AlertEvent } from "@clawview/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Panel } from "@/components/ui/panel";
import { DASHBOARD_QUERY_KEY } from "@/lib/constants";
import { acknowledgeAlert } from "@/services/endpoints/alerts.api";
import { useToastStore } from "@/stores/toast.store";
import type { DashboardPayload } from "@/types/api";

import { useAlertFilter } from "../hooks/use-alert-filter";
import { AlertCard } from "./alert-card";
import { AlertFilterChips } from "./alert-filter-chips";

interface AlertsPanelProps {
  alerts: AlertEvent[];
}

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  const queryClient = useQueryClient();
  const pushToast = useToastStore((state) => state.push);
  const { filteredAlerts, activeFilter, setFilter } = useAlertFilter(alerts);

  const mutation = useMutation({
    mutationFn: acknowledgeAlert,
    onSuccess: (updatedAlerts) => {
      queryClient.setQueryData<DashboardPayload | undefined>(
        DASHBOARD_QUERY_KEY,
        (current) =>
          current
            ? {
                ...current,
                alerts: updatedAlerts,
              }
            : current,
      );
      pushToast("警告已标记已读。");
    },
  });

  return (
    <Panel title="异常警告" eyebrow="风险监测">
      <AlertFilterChips
        activeFilter={activeFilter}
        onFilterChange={setFilter}
      />
      <div className="stack-list">
        {filteredAlerts.length === 0 ? (
          <div className="empty-state-inline">暂无警告</div>
        ) : (
          filteredAlerts.map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              onAcknowledge={(alertId) => mutation.mutate(alertId)}
            />
          ))
        )}
      </div>
    </Panel>
  );
}
