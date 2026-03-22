import type { TaskExecutionLog } from "@clawview/shared";
import { useMemo, useState } from "react";

type TaskFilter = "all" | TaskExecutionLog["status"];

export function useTaskFilter(tasks: TaskExecutionLog[]) {
  const [activeFilter, setFilter] = useState<TaskFilter>("all");

  const filteredTasks = useMemo(() => {
    const nextTasks =
      activeFilter === "all"
        ? tasks
        : tasks.filter((task) => task.status === activeFilter);

    return [...nextTasks].sort((left, right) => right.startedAt - left.startedAt);
  }, [activeFilter, tasks]);

  return { filteredTasks, activeFilter, setFilter };
}
