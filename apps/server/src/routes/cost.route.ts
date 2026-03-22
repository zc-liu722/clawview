import { Hono } from "hono";
import { z } from "zod";

import {
  getCostSnapshots,
  updateBudget,
} from "../services/cost-tracker.service";

export const costRoute = new Hono();

const budgetSchema = z.object({
  dailyLimitCents: z.number().nonnegative(),
  monthlyLimitCents: z.number().nonnegative(),
  alertThresholdPercent: z.number().min(1).max(100),
});

costRoute.get("/", (c) => {
  return c.json({
    data: getCostSnapshots(),
  });
});

costRoute.post("/budget", async (c) => {
  const body = budgetSchema.parse(await c.req.json());

  return c.json({
    data: updateBudget(body),
  });
});
