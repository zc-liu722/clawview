import type { TaskExecutionLog } from "@clawview/shared";
import { useEffect, useState } from "react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { TaskFlowPanel } from "@/features/task-flow/components/task-flow-panel";
import { formatDuration } from "@/lib/format";
import { TASK_STATUS_LABELS } from "@/lib/i18n-maps";
import { sanitizeDisplayText } from "@/lib/sanitize-display";
import { formatCostFromCents } from "@clawview/shared";

interface TaskDetailSheetProps {
  task: TaskExecutionLog | null;
  open: boolean;
  onClose: () => void;
}

export function TaskDetailSheet({ task, open, onClose }: TaskDetailSheetProps) {
  const [showTechnicalMeta, setShowTechnicalMeta] = useState(false);

  useEffect(() => {
    if (!open) {
      setShowTechnicalMeta(false);
    }
  }, [open]);

  return (
    <BottomSheet open={open} onClose={onClose} title="任务详情">
      {task ? (
        <div className="sheet-stack">
          <div className="list-card">
            <strong>
              {sanitizeDisplayText(task.userPromptSummary, "任务摘要暂不可用", 80)}
            </strong>
            <p>状态：{TASK_STATUS_LABELS[task.status] ?? task.status}</p>
            <p>总成本：{formatCostFromCents(task.totalCostCents)}</p>
            <p>
              总时长：
              {task.completedAt
                ? formatDuration(task.completedAt - task.startedAt)
                : formatDuration(Date.now() - task.startedAt)}
            </p>
            <button
              type="button"
              className="inline-toggle-button"
              aria-expanded={showTechnicalMeta}
              onClick={() => setShowTechnicalMeta((current) => !current)}
            >
              {showTechnicalMeta ? "隐藏技术信息" : "查看技术信息"}
            </button>
            {showTechnicalMeta ? (
              <div className="detail-block">
                <p>会话 ID：{task.sessionId}</p>
                <p>来源通道：{task.sourceChannel}</p>
                <p>主模型：{task.primaryModel}</p>
                <p>步骤数：{task.steps.length}</p>
              </div>
            ) : null}
          </div>
          <TaskFlowPanel task={task} />
          {task.status === "failed" ? (
            <div className="list-card">
              <strong>错误摘要</strong>
              <p>
                {task.steps.find((step) => step.errorMessage)?.errorMessage ??
                  "未提供错误详情"}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </BottomSheet>
  );
}
