import { describe, expect, it } from "vitest";

import {
  buildSyncQueue,
  detectDesktopPlatform,
  getDesktopDownloadLinks,
  getQueueSummary,
  type SyncTask
} from "./desktop-agent";

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

describe("detectDesktopPlatform", () => {
  it("recognizes the current OS from the user agent", () => {
    expect(detectDesktopPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("windows");
    expect(detectDesktopPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("macos");
    expect(detectDesktopPlatform("Mozilla/5.0 (X11; Linux x86_64)")).toBe("linux");
    expect(detectDesktopPlatform("unknown-agent")).toBe("unknown");
  });
});

describe("getDesktopDownloadLinks", () => {
  it("returns the native package list for the detected platform", () => {
    expect(getDesktopDownloadLinks("windows")[0].label).toContain("Windows");
    expect(getDesktopDownloadLinks("macos")[0].label).toContain("macOS");
    expect(getDesktopDownloadLinks("unknown")).toHaveLength(2);
  });
});
