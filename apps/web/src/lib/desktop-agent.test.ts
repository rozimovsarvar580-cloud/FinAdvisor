import { describe, expect, it } from "vitest";

import { buildSyncQueue, getQueueSummary, type SyncTask } from "./desktop-agent";

const tasks: SyncTask[] = [
  {
    id: "sync-plan",
    title: "Sync plan changes",
    priority: "Medium",
    status: "Queued",
    estimatedMinutes: 8
  },
  {
    id: "sync-pricing",
    title: "Refresh pricing assumptions",
    priority: "High",
    status: "Queued",
    estimatedMinutes: 5
  },
  {
    id: "sync-bank-rules",
    title: "Update bank readiness rules",
    priority: "Low",
    status: "Blocked",
    estimatedMinutes: 10
  }
];

describe("buildSyncQueue", () => {
  it("removes blocked tasks and prioritizes urgent work", () => {
    const queue = buildSyncQueue(tasks);

    expect(queue).toHaveLength(2);
    expect(queue[0].id).toBe("sync-pricing");
    expect(queue[1].id).toBe("sync-plan");
  });
});

describe("getQueueSummary", () => {
  it("tracks queue readiness and blocked tasks", () => {
    const summary = getQueueSummary(tasks);

    expect(summary.queued).toBe(2);
    expect(summary.highPriority).toBe(1);
    expect(summary.blocked).toBe(1);
  });
});
