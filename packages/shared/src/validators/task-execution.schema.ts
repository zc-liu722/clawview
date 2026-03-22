import { z } from "zod";

const modelUsageBreakdownSchema = z.object({
  modelId: z.string().min(1),
  modelDisplayName: z.string().min(1),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  costCents: z.number().min(0),
  callCount: z.number().int().min(0),
});

export const taskStepSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().min(1),
  status: z.enum([
    "pending",
    "running",
    "completed",
    "failed",
    "cancelled",
    "awaiting_approval",
  ]),
  narrative: z.string().min(1),
  rawEventType: z.string().min(1),
  toolName: z.string().nullable(),
  modelName: z.string().nullable(),
  tokensUsed: z.number().int().min(0),
  costCents: z.number().min(0),
  costSource: z.enum(["authoritative", "estimated", "missing"]).optional(),
  startedAt: z.number().int(),
  completedAt: z.number().int().nullable(),
  durationMs: z.number().int().nullable(),
  errorMessage: z.string().nullable(),
});

export const taskExecutionSchema = z.object({
  taskId: z.string().min(1),
  sessionId: z.string().min(1),
  agentId: z.string().min(1),
  userPromptSummary: z.string().min(1),
  status: z.enum(["running", "completed", "failed", "cancelled"]),
  steps: z.array(taskStepSchema),
  totalTokens: z.number().int().min(0),
  totalCostCents: z.number().min(0),
  costSource: z.enum(["authoritative", "estimated", "missing"]).optional(),
  costModels: z.array(modelUsageBreakdownSchema).optional(),
  primaryModel: z.string().min(1),
  startedAt: z.number().int(),
  completedAt: z.number().int().nullable(),
  sourceChannel: z.enum([
    "telegram",
    "whatsapp",
    "slack",
    "discord",
    "feishu",
    "wechat",
    "other",
  ]),
});
