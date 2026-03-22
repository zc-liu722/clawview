import type { RiskLevel } from "../constants/risk-levels";

export interface AlertEvent {
  /** Stable alert identifier. */
  id: string;
  /** Agent identifier associated with the alert. */
  agentId: string;
  /** Severity used for ranking and color treatment. */
  riskLevel: RiskLevel;
  /** Short alert title visible in summary cards. */
  title: string;
  /** Human-readable explanation of the detected issue. */
  description: string;
  /** Recommended operator action shown in the UI. */
  recommendedAction: string;
  /** Timestamp of when the alert was raised. */
  triggeredAt: number;
  /** Whether the alert still needs attention. */
  open: boolean;
}
