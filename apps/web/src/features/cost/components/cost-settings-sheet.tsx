import { useEffect, useState } from "react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";

interface CostSettingsSheetProps {
  open: boolean;
  onClose: () => void;
  onSave: (budgets: {
    dailyLimitCents: number;
    monthlyLimitCents: number;
    alertThresholdPercent: number;
  }) => void;
  isSaving: boolean;
  currentBudgets: {
    dailyLimitCents: number;
    monthlyLimitCents: number;
  };
}

export function CostSettingsSheet({
  open,
  onClose,
  onSave,
  isSaving,
  currentBudgets,
}: CostSettingsSheetProps) {
  const [dailyLimit, setDailyLimit] = useState(currentBudgets.dailyLimitCents / 100);
  const [monthlyLimit, setMonthlyLimit] = useState(currentBudgets.monthlyLimitCents / 100);

  useEffect(() => {
    if (!open) {
      return;
    }

    setDailyLimit(currentBudgets.dailyLimitCents / 100);
    setMonthlyLimit(currentBudgets.monthlyLimitCents / 100);
  }, [currentBudgets.dailyLimitCents, currentBudgets.monthlyLimitCents, open]);

  return (
    <BottomSheet open={open} onClose={onClose} title="预算设置">
      <div className="sheet-stack">
        <label className="field">
          <span>每日预算</span>
          <input
            type="number"
            value={dailyLimit}
            onChange={(event) => setDailyLimit(Number(event.target.value))}
          />
        </label>
        <label className="field">
          <span>每月预算</span>
          <input
            type="number"
            value={monthlyLimit}
            onChange={(event) => setMonthlyLimit(Number(event.target.value))}
          />
        </label>
        <Button tone="secondary" onClick={onClose}>
          取消
        </Button>
        <Button
          disabled={isSaving || dailyLimit <= 0 || monthlyLimit <= 0}
          onClick={() =>
            onSave({
              dailyLimitCents: Math.round(dailyLimit * 100),
              monthlyLimitCents: Math.round(monthlyLimit * 100),
              alertThresholdPercent: 80,
            })
          }
        >
          {isSaving ? "保存中..." : "保存预算"}
        </Button>
      </div>
    </BottomSheet>
  );
}
