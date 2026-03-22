import type {
  AgentStatus,
  ApprovalRequest,
  CostSnapshot,
  TaskExecutionLog,
} from "@clawview/shared";

import { ApprovalBanner } from "@/features/approval/components/approval-banner";
import { StatusHeader } from "@/features/status/components/status-header";
import { TaskFlowPanel } from "@/features/task-flow/components/task-flow-panel";
import type { NavigationTab } from "@/stores/navigation.store";
import { formatCostFromCentsCompact } from "@clawview/shared";

interface LiveTabProps {
  status: AgentStatus;
  tasks: TaskExecutionLog[];
  costs: CostSnapshot[];
  approvals: ApprovalRequest[];
  onNavigate: (tab: NavigationTab) => void;
}

export function LiveTab({
  status,
  tasks,
  costs,
  approvals,
  onNavigate,
}: LiveTabProps) {
  const activeTask = tasks[0];
  const taskCost = costs.find((snapshot) => snapshot.granularity === "task");
  const dailyCost = costs.find((snapshot) => snapshot.granularity === "daily");
  const pendingApproval =
    approvals.find((approval) => approval.status === "pending") ?? null;

  return (
    <div className="content-stack live-tab">
      <StatusHeader status={status} />
      <ApprovalBanner approval={pendingApproval} />
      <TaskFlowPanel task={activeTask} />
      <button
        type="button"
        className="quick-cost-bar"
        onClick={() => onNavigate("cost")}
      >
        <div>
          <span className="muted-text">本任务</span>
          <strong>
            {taskCost
              ? taskCost.costStatus === "missing"
                ? "待同步"
                : formatCostFromCentsCompact(taskCost.totalCostCents)
              : "--"}
          </strong>
        </div>
        <div>
          <span className="muted-text">今日</span>
          <strong>
            {dailyCost
              ? dailyCost.costStatus === "missing"
                ? "待同步"
                : formatCostFromCentsCompact(dailyCost.totalCostCents)
              : "--"}
          </strong>
        </div>
      </button>
    </div>
  );
}
