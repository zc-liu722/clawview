export const CLAW_EVENT_TYPES = [
  "status_change",
  "step_update",
  "cost_update",
  "memory_change",
  "alert",
  "approval_request",
] as const;

export type ClawEventType = (typeof CLAW_EVENT_TYPES)[number];
