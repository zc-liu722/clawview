import { z } from "zod";

import { RISK_LEVELS } from "../constants/risk-levels";

export const approvalRequestSchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  taskId: z.string().min(1),
  actionLabel: z.string().min(1),
  riskLevel: z.enum(RISK_LEVELS),
  reason: z.string().min(1),
  expiresAt: z.number().int(),
  status: z.enum(["pending", "approved", "denied"]),
});
