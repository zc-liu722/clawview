import { z } from "zod";

import { AGENT_STATUS_CODES } from "../constants/status-codes";

export const channelInfoSchema = z.object({
  type: z.enum([
    "telegram",
    "whatsapp",
    "slack",
    "discord",
    "feishu",
    "wechat",
    "other",
  ]),
  name: z.string().min(1),
  connected: z.boolean(),
});

export const agentStatusSchema = z.object({
  agentId: z.string().min(1),
  agentName: z.string().min(1),
  status: z.enum(AGENT_STATUS_CODES),
  statusText: z.string().min(1),
  statusSince: z.number().int(),
  lastHeartbeat: z.number().int(),
  gatewayConnected: z.boolean(),
  activeTaskId: z.string().nullable(),
  connectedChannels: z.array(channelInfoSchema),
});
