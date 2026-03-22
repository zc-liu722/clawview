import type { RiskLevel } from "../constants/risk-levels";

export interface ApprovalRequest {
  /** Stable approval request identifier. */
  id: string;
  /** Agent identifier that raised the request. */
  agentId: string;
  /** Task identifier tied to the risky action. */
  taskId: string;
  /** Human-readable action description requiring approval. */
  actionLabel: string;
  /** Severity classification for the action. */
  riskLevel: RiskLevel;
  /** Why the system decided a human must confirm the action. */
  reason: string;
  /** Timestamp after which the approval becomes invalid. */
  expiresAt: number;
  /** Whether the approval has been resolved. */
  status: "pending" | "approved" | "denied";
}
