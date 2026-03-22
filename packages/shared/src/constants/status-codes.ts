export const AGENT_STATUS_CODES = [
  "online",
  "thinking",
  "tool_calling",
  "awaiting_approval",
  "degraded",
  "offline",
  "error",
] as const;

export type AgentStatusCode = (typeof AGENT_STATUS_CODES)[number];
