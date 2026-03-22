import type { TaskExecutionLog } from "@clawview/shared";
import { useEffect, useRef, useState } from "react";

import { Panel } from "@/components/ui/panel";
import { Pill } from "@/components/ui/pill";
import { formatClock, formatDuration } from "@/lib/format";
import { STEP_STATUS_LABELS, TASK_STATUS_LABELS } from "@/lib/i18n-maps";
import { sanitizeDisplayText } from "@/lib/sanitize-display";
import { formatCostFromCents, formatTokens } from "@clawview/shared";

interface TaskFlowPanelProps {
  task?: TaskExecutionLog;
}

export function TaskFlowPanel({ task }: TaskFlowPanelProps) {
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!task || userHasScrolled) {
      return;
    }

    bottomAnchorRef.current?.scrollIntoView({ block: "end" });
  }, [task, userHasScrolled]);

  if (!task) {
    return (
      <Panel title="任务步骤流" eyebrow="等待 OpenClaw 产出新的任务 transcript">
        <div className="empty-state">
          当前还没有可展示的任务步骤。先在 OpenClaw 中发起一条任务，或者确认
          transcript 路径配置是否正确。
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title="任务步骤流"
      eyebrow={sanitizeDisplayText(task.userPromptSummary, "任务摘要暂不可用", 80)}
      action={<Pill>{TASK_STATUS_LABELS[task.status] ?? task.status}</Pill>}
    >
      <div
        ref={timelineRef}
        className="timeline timeline-scroll"
        onScroll={(event) => {
          const element = event.currentTarget;
          const nearBottom =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            24;
          setUserHasScrolled(!nearBottom);
        }}
      >
        {task.steps.map((step) => (
          <article
            key={step.id}
            className={`timeline-item ${expandedStepId === step.id ? "timeline-item-expanded" : ""} ${step.status === "running" ? "timeline-item-active" : ""}`}
          >
            <button
              type="button"
              className={`timeline-dot-button status-${step.status}`}
              onClick={() =>
                setExpandedStepId((current) =>
                  current === step.id ? null : step.id,
                )
              }
            >
              <div className={`timeline-dot status-${step.status}`} />
            </button>
            <div className="timeline-content">
              <div className="timeline-header">
                <strong>
                  {sanitizeDisplayText(step.narrative, "正在处理任务步骤", 96)}
                </strong>
                <span>{formatClock(step.startedAt)}</span>
              </div>
              <p className="timeline-meta">
                {step.toolName ?? step.modelName ?? "系统步骤"} ·{" "}
                {formatTokens(step.tokensUsed)} tokens ·{" "}
                {formatCostFromCents(step.costCents)}
              </p>
              {step.status === "running" ? (
                <p className="timeline-meta">生成中...</p>
              ) : null}
              <button
                type="button"
                className="inline-toggle-button"
                aria-expanded={expandedStepId === step.id}
                onClick={() =>
                  setExpandedStepId((current) =>
                    current === step.id ? null : step.id,
                  )
                }
              >
                {expandedStepId === step.id ? "收起详情" : "展开详情"}
              </button>
              {expandedStepId === step.id ? (
                <div className="timeline-detail">
                  <p>
                    步骤状态：{STEP_STATUS_LABELS[step.status] ?? step.status}
                  </p>
                  <p>事件类型：{step.rawEventType}</p>
                  <p>工具：{step.toolName ?? "无"}</p>
                  <p>模型：{step.modelName ?? "无"}</p>
                  <p>
                    时长：
                    {step.durationMs
                      ? formatDuration(step.durationMs)
                      : "运行中"}
                  </p>
                  <p>花费：{formatCostFromCents(step.costCents)}</p>
                </div>
              ) : null}
              {step.errorMessage ? (
                <p className="timeline-error">{step.errorMessage}</p>
              ) : null}
            </div>
          </article>
        ))}
        <div ref={bottomAnchorRef} />
      </div>
      {userHasScrolled ? (
        <button
          type="button"
          className="jump-to-latest-fab"
          onClick={() => {
            bottomAnchorRef.current?.scrollIntoView({
              behavior: "smooth",
              block: "end",
            });
            setUserHasScrolled(false);
          }}
        >
          跳到最新
        </button>
      ) : null}
    </Panel>
  );
}
