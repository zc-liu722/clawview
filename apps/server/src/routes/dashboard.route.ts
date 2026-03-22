import { Hono } from "hono";

import { getDashboardData } from "../services/dashboard.service";

export const dashboardRoute = new Hono();

dashboardRoute.get("/", (c) => {
  return c.json({
    data: getDashboardData(),
    meta: {
      timing: Date.now(),
    },
  });
});
