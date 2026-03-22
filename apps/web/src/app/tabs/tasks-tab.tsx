import type { TaskExecutionLog } from "@clawview/shared";
import { useState } from "react";

import { TaskDetailSheet } from "@/features/task-flow/components/task-detail-sheet";
import { TaskList } from "@/features/task-flow/components/task-list";

interface TasksTabProps {
  tasks: TaskExecutionLog[];
}

export function TasksTab({ tasks }: TasksTabProps) {
  const [selectedTask, setSelectedTask] = useState<TaskExecutionLog | null>(null);

  return (
    <>
      <TaskList tasks={tasks} onSelectTask={setSelectedTask} />
      <TaskDetailSheet task={selectedTask} open={selectedTask !== null} onClose={() => setSelectedTask(null)} />
    </>
  );
}
