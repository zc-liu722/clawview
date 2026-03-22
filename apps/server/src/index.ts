import { serve } from "@hono/node-server";

import { readOpenClawSnapshot } from "./adapters/openclaw-files.adapter";
import { app } from "./app";
import { config } from "./lib/config";
import { logger } from "./lib/logger";
import { publishEvent } from "./realtime/event-bus";
import { createMockTickEvent } from "./services/mock-data.service";
import { flushStatusCommandNotifications } from "./services/status-command.service";

serve(
  {
    fetch: app.fetch,
    hostname: config.CLAWVIEW_HOST,
    port: config.CLAWVIEW_PORT,
  },
  (info) => {
    logger.info(
      `ClawView server listening on http://${config.CLAWVIEW_HOST}:${info.port}`,
    );
  },
);

setInterval(async () => {
  if (config.CLAWVIEW_DATA_SOURCE === "openclaw") {
    const snapshot = readOpenClawSnapshot();
    publishEvent({
      id: `status_${Date.now()}`,
      type: "status_change",
      timestamp: Date.now(),
      agentId: snapshot.status.agentId,
      source: "file_watcher",
      payload: snapshot.status,
    });

    if (snapshot.tasks[0]) {
      publishEvent({
        id: `task_${Date.now()}`,
        type: "step_update",
        timestamp: Date.now(),
        agentId: snapshot.status.agentId,
        source: "file_watcher",
        payload: snapshot.tasks[0],
      });
    }

    publishEvent({
      id: `cost_${Date.now()}`,
      type: "cost_update",
      timestamp: Date.now(),
      agentId: snapshot.status.agentId,
      source: "file_watcher",
      payload: snapshot.costs,
    });

    publishEvent({
      id: `memory_${Date.now()}`,
      type: "memory_change",
      timestamp: Date.now(),
      agentId: snapshot.status.agentId,
      source: "file_watcher",
      payload: snapshot.memory,
    });

    publishEvent({
      id: `alert_${Date.now()}`,
      type: "alert",
      timestamp: Date.now(),
      agentId: snapshot.status.agentId,
      source: "file_watcher",
      payload: snapshot.alerts,
    });

    publishEvent({
      id: `approval_${Date.now()}`,
      type: "approval_request",
      timestamp: Date.now(),
      agentId: snapshot.status.agentId,
      source: "file_watcher",
      payload: snapshot.approvals,
    });

    await flushStatusCommandNotifications();

    return;
  }

  publishEvent(createMockTickEvent());
}, 12_000);
