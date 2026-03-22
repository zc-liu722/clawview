import type { TaskExecutionLog } from "@clawview/shared";

import { Panel } from "@/components/ui/panel";
import { formatRelativeTime } from "@/lib/format";
import { sanitizeDisplayText } from "@/lib/sanitize-display";
import { formatCostFromCents } from "@clawview/shared";

import { useTaskFilter } from "../hooks/use-task-filter";

interface TaskListProps {
  tasks: TaskExecutionLog[];
  onSelectTask: (task: TaskExecutionLog) => void;
}

const FILTERS = [
  { value: "all", label: "全部" },
  { value: "running", label: "进行中" },
  { value: "completed", label: "已完成" },
  { value: "failed", label: "失败" },
] as const;

export function TaskList({ tasks, onSelectTask }: TaskListProps) {
  const { filteredTasks, activeFilter, setFilter } = useTaskFilter(tasks);

  return (
    <Panel title="任务列表" eyebrow="任务历史与明细">
      <div className="filter-chips">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={`filter-chip ${activeFilter === filter.value ? "is-active" : ""}`}
            onClick={() => setFilter(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>
      {filteredTasks.length === 0 ? (
        <div className="empty-state-inline">还没有匹配的任务记录。</div>
      ) : (
        <div className="stack-list">
          {filteredTasks.map((task) => (
            <button
              key={task.taskId}
              type="button"
              className="task-list-item"
              onClick={() => onSelectTask(task)}
            >
              <span className={`timeline-dot status-${task.status}`} />
              <div className="task-list-copy">
                <strong>
                  {sanitizeDisplayText(task.userPromptSummary, "任务摘要暂不可用", 80)}
                </strong>
                <p>
                  {task.steps.length} 个步骤 · {task.sourceChannel}
                </p>
              </div>
              <div className="task-list-meta">
                <strong>{formatCostFromCents(task.totalCostCents)}</strong>
                <span>{formatRelativeTime(task.startedAt)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}
