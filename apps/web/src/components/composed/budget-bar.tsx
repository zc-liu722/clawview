import type { BudgetStatus } from "@clawview/shared";

import { formatPercentage } from "@/lib/format";
import { formatCostFromCents } from "@clawview/shared";

interface BudgetBarProps {
  budget: BudgetStatus;
  label: string;
  onTap?: () => void;
}

export function BudgetBar({ budget, label, onTap }: BudgetBarProps) {
  const tone =
    budget.usageRatio > 0.8
      ? "danger"
      : budget.usageRatio >= 0.5
        ? "warn"
        : "good";

  return (
    <button
      type="button"
      className={`budget-bar budget-bar-${tone}`}
      onClick={onTap}
      disabled={!onTap}
    >
      <div className="budget-bar-top">
        <strong>{label}</strong>
        <span>{formatPercentage(budget.usageRatio)}</span>
      </div>
      <div className="budget-bar-track">
        <div
          className="budget-bar-fill"
          style={{ width: `${Math.min(100, budget.usageRatio * 100)}%` }}
        />
      </div>
      <p className="budget-bar-copy">
        {formatCostFromCents(budget.spentCents)} /{" "}
        {formatCostFromCents(budget.limitCents)}
      </p>
    </button>
  );
}
