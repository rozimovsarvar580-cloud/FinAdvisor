export type SyncTask = {
  id: string;
  title: string;
  priority: "High" | "Medium" | "Low";
  status: "Queued" | "Running" | "Blocked";
  estimatedMinutes: number;
};

export function buildSyncQueue(tasks: SyncTask[]) {
  const priorityRank = { High: 3, Medium: 2, Low: 1 };

  return [...tasks]
    .filter((task) => task.status !== "Blocked")
    .sort(
      (left, right) =>
        priorityRank[right.priority] - priorityRank[left.priority] ||
        right.estimatedMinutes - left.estimatedMinutes
    );
}

export function getQueueSummary(tasks: SyncTask[]) {
  const queue = buildSyncQueue(tasks);

  return {
    queued: queue.length,
    highPriority: queue.filter((task) => task.priority === "High").length,
    blocked: tasks.filter((task) => task.status === "Blocked").length
  };
}
