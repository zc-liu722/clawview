import type { TaskExecutionLog } from "@clawview/shared";
import { useMemo, useState } from "react";

type TaskFilter = "all" | TaskExecutionLog["status"];

export function useTaskFilter(tasks: TaskExecutionLog[]) {
  const [activeFilter, setFilter] = useState<TaskFilter>("all");

  const filteredTasks = useMemo(() => {
    if (activeFilter === "all") {
      return tasks;
    }

    return tasks.filter((task) => task.status === activeFilter);
  }, [activeFilter, tasks]);

  return { filteredTasks, activeFilter, setFilter };
}
