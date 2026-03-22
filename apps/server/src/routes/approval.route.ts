import { Hono } from "hono";
import { z } from "zod";

import { ValidationError } from "../lib/errors";
import { resolveApproval } from "../services/approval-flow.service";

const decisionSchema = z.object({
  decision: z.enum(["approved", "denied"]),
});

export const approvalRoute = new Hono();

approvalRoute.post("/:approvalId/decision", async (c) => {
  const approvalId = c.req.param("approvalId");
  const payload = await c.req.json().catch(() => null);
  const result = decisionSchema.safeParse(payload);

  if (!result.success) {
    throw new ValidationError("Invalid approval decision payload.");
  }

  return c.json({
    data: resolveApproval({
      approvalId,
      decision: result.data.decision,
    }),
  });
});
