import { Hono } from "hono";

import {
  acknowledgeAlert,
  getActiveAlerts,
} from "../services/alert-evaluator.service";

export const alertsRoute = new Hono();

alertsRoute.get("/", (c) => {
  return c.json({
    data: getActiveAlerts(),
  });
});

alertsRoute.post("/:alertId/acknowledge", (c) => {
  const alertId = c.req.param("alertId");

  return c.json({
    data: acknowledgeAlert(alertId),
  });
});
