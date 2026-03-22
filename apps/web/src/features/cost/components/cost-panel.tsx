import type { CostSnapshot } from "@clawview/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { BudgetBar } from "@/components/composed/budget-bar";
import { MetricCard } from "@/components/composed/metric-card";
import { Panel } from "@/components/ui/panel";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { DASHBOARD_QUERY_KEY } from "@/lib/constants";
import { formatPercentage } from "@/lib/format";
import { COST_GRANULARITY_LABELS } from "@/lib/i18n-maps";
import { updateBudget } from "@/services/endpoints/cost.api";
import { useToastStore } from "@/stores/toast.store";
import type { DashboardPayload } from "@/types/api";
import {
  formatCostFromCents,
  formatCostFromCentsCompact,
  formatTokens,
} from "@clawview/shared";

import { CostSettingsSheet } from "./cost-settings-sheet";

interface CostPanelProps {
  costs: CostSnapshot[];
}

export function CostPanel({ costs }: CostPanelProps) {
  const queryClient = useQueryClient();
  const pushToast = useToastStore((state) => state.push);
  const [selectedGranularity, setSelectedGranularity] =
    useState<CostSnapshot["granularity"]>("task");
  const [expandedModelId, setExpandedModelId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const toggleExpandedModel = (modelId: string) => {
    setExpandedModelId((current) => (current === modelId ? null : modelId));
  };

  const taskCost = costs.find((snapshot) => snapshot.granularity === "task");
  const dailyCost = costs.find((snapshot) => snapshot.granularity === "daily");
  const monthlyCost = costs.find(
    (snapshot) => snapshot.granularity === "monthly",
  );
  const selectedCost = costs.find(
    (snapshot) => snapshot.granularity === selectedGranularity,
  );

  const budgetMutation = useMutation({
    mutationFn: updateBudget,
    onSuccess: (nextCosts) => {
      queryClient.setQueryData<DashboardPayload | undefined>(
        DASHBOARD_QUERY_KEY,
        (current) =>
          current
            ? {
                ...current,
                costs: nextCosts,
              }
            : current,
      );
      pushToast("预算设置已保存。");
      setShowSettings(false);
    },
    onError: () => {
      pushToast("预算设置保存失败，请稍后重试。");
    },
  });

  if (!taskCost || !dailyCost || !monthlyCost || !selectedCost) {
    return null;
  }

  return (
    <Panel title="成本追踪" eyebrow="Token / 金额">
      <SegmentedControl
        options={[
          { value: "task", label: "本任务" },
          { value: "daily", label: "今日" },
          { value: "monthly", label: "本月" },
        ]}
        selected={selectedGranularity}
        onChange={setSelectedGranularity}
      />
      <div className="cost-hero">
        {selectedCost.costStatus === "missing"
          ? "待同步"
          : formatCostFromCentsCompact(selectedCost.totalCostCents)}
      </div>
      {selectedCost.note ? (
        <p className="muted-text cost-note">{selectedCost.note}</p>
      ) : null}
      <BudgetBar
        budget={selectedCost.budget}
        label={`${COST_GRANULARITY_LABELS[selectedGranularity]}预算`}
        onTap={() => setShowSettings(true)}
      />
      <div className="metric-grid">
        <MetricCard
          label="本任务"
          value={
            taskCost.costStatus === "missing"
              ? "待同步"
              : formatCostFromCentsCompact(taskCost.totalCostCents)
          }
          helper={`${formatTokens(taskCost.inputTokens + taskCost.outputTokens)} tokens`}
        />
        <MetricCard
          label="今日累计"
          value={
            dailyCost.costStatus === "missing"
              ? "待同步"
              : formatCostFromCentsCompact(dailyCost.totalCostCents)
          }
          helper={`预算 ${formatPercentage(dailyCost.budget.usageRatio)}`}
        />
        <MetricCard
          label="本月累计"
          value={
            monthlyCost.costStatus === "missing"
              ? "待同步"
              : formatCostFromCentsCompact(monthlyCost.totalCostCents)
          }
          helper={`预算 ${formatPercentage(monthlyCost.budget.usageRatio)}`}
        />
      </div>
      <div className="cost-breakdown">
        {(selectedCost.models.length > 0
          ? selectedCost.models
          : [
              {
                modelId: "billing_pending",
                modelDisplayName: "账单同步中",
                inputTokens: selectedCost.inputTokens,
                outputTokens: selectedCost.outputTokens,
                costCents: selectedCost.totalCostCents,
                callCount: 0,
              },
            ]
        ).map((model) => (
          <button
            key={model.modelId}
            type="button"
            className={`cost-row model-row ${expandedModelId === model.modelId ? "model-row-expanded" : ""}`}
            onClick={() => toggleExpandedModel(model.modelId)}
          >
            <div>
              <strong>{model.modelDisplayName}</strong>
              <p>{model.callCount} 次调用</p>
            </div>
            <div className="cost-row-right">
              <strong>
                {selectedCost.costStatus === "missing"
                  ? "待同步"
                  : formatCostFromCents(model.costCents)}
              </strong>
              <span>
                {formatTokens(model.inputTokens + model.outputTokens)} tokens
              </span>
            </div>
            {expandedModelId === model.modelId ? (
              <div className="model-row-detail">
                <p>输入: {formatTokens(model.inputTokens)}</p>
                <p>输出: {formatTokens(model.outputTokens)}</p>
                <p>
                  单次均价:{" "}
                  {formatCostFromCents(
                    Math.round(model.costCents / Math.max(1, model.callCount)),
                  )}
                </p>
              </div>
            ) : null}
          </button>
        ))}
      </div>
      <CostSettingsSheet
        open={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={(budgets) => budgetMutation.mutate(budgets)}
        isSaving={budgetMutation.isPending}
        currentBudgets={{
          dailyLimitCents: dailyCost.budget.limitCents,
          monthlyLimitCents: monthlyCost.budget.limitCents,
        }}
      />
    </Panel>
  );
}
