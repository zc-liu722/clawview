export const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;

export type RiskLevel = (typeof RISK_LEVELS)[number];
