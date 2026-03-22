import type { ClawEventUnion } from "@clawview/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { DASHBOARD_QUERY_KEY } from "@/lib/constants";
import { API_BASE_URL } from "@/lib/constants";
import { SSE_RECONNECT_DELAY_MS } from "@/lib/constants";
import { useConnectionStore } from "@/stores/connection.store";
import { useToastStore } from "@/stores/toast.store";
import type { DashboardPayload } from "@/types/api";

function mergeRealtimePayload(
  current: DashboardPayload | undefined,
  event: ClawEventUnion,
): DashboardPayload | undefined {
  if (!current) {
    return current;
  }

  switch (event.type) {
    case "status_change":
      return {
        ...current,
        status: event.payload,
      };
    case "step_update":
      if (!current.tasks.some((task) => task.taskId === event.payload.taskId)) {
        return {
          ...current,
          tasks: [event.payload, ...current.tasks],
        };
      }

      return {
        ...current,
        tasks: current.tasks.map((task) =>
          task.taskId === event.payload.taskId ? event.payload : task,
        ),
      };
    case "cost_update":
      return {
        ...current,
        costs: event.payload,
      };
    case "memory_change":
      return {
        ...current,
        memory: event.payload,
      };
    case "alert":
      return {
        ...current,
        alerts: event.payload,
      };
    case "approval_request":
      return {
        ...current,
        approvals: event.payload,
      };
    default:
      return current;
  }
}

export function useRealtime(): void {
  const queryClient = useQueryClient();
  const setConnectionStatus = useConnectionStore((state) => state.setStatus);
  const pushToast = useToastStore((state) => state.push);

  useEffect(() => {
    let reconnectTimer: number | undefined;
    let eventSource: EventSource | null = null;

    const connect = (): void => {
      setConnectionStatus("connecting");
      eventSource = new EventSource(`${API_BASE_URL}/api/v1/realtime/events`);

      eventSource.onopen = () => {
        setConnectionStatus("connected");
      };

      eventSource.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data) as ClawEventUnion;
          queryClient.setQueryData<DashboardPayload | undefined>(
            DASHBOARD_QUERY_KEY,
            (current) => mergeRealtimePayload(current, event),
          );
        } catch {
          pushToast("收到一条无法解析的实时事件。");
        }
      };

      eventSource.onerror = () => {
        setConnectionStatus("disconnected");
        eventSource?.close();
        reconnectTimer = window.setTimeout(connect, SSE_RECONNECT_DELAY_MS);
      };
    };

    connect();

    return () => {
      if (reconnectTimer) {
        window.clearTimeout(reconnectTimer);
      }
      eventSource?.close();
    };
  }, [pushToast, queryClient, setConnectionStatus]);
}
