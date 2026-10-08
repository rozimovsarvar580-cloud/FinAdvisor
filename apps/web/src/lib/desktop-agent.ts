export type SyncTask = {
  id: string;
  title: string;
  priority: "High" | "Medium" | "Low";
  status: "Queued" | "Running" | "Blocked";
  estimatedMinutes: number;
};

export type DesktopPlatform = "windows" | "macos" | "linux" | "unknown";

export type DesktopDownload = {
  platform: DesktopPlatform;
  label: string;
  fileName: string;
  url: string;
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

export function detectDesktopPlatform(userAgent?: string): DesktopPlatform {
  const agent = userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  const base = agent.toLowerCase();

  if (/(windows|win32|win64)/.test(base)) {
    return "windows";
  }

  if (/(macintosh|mac os x|darwin)/.test(base)) {
    return "macos";
  }

  if (/(linux|x11)/.test(base)) {
    return "linux";
  }

  return "unknown";
}

export function getDesktopDownloadLinks(platform?: DesktopPlatform): DesktopDownload[] {
  const resolved = platform ?? detectDesktopPlatform();
  const baseUrl = "https://github.com/rozimovsarvar580-cloud/FinAdvisor/releases/latest/download";

  const downloads: Record<DesktopPlatform, DesktopDownload[]> = {
    windows: [
      {
        platform: "windows",
        label: "Windows (.msi)",
        fileName: "FinAdvisor-Agent_0.1.0_x64_en-US.msi",
        url: `${baseUrl}/FinAdvisor-Agent_0.1.0_x64_en-US.msi`
      },
      {
        platform: "windows",
        label: "Windows (.exe)",
        fileName: "FinAdvisor-Agent_0.1.0_x64-setup.exe",
        url: `${baseUrl}/FinAdvisor-Agent_0.1.0_x64-setup.exe`
      }
    ],
    macos: [
      {
        platform: "macos",
        label: "macOS (.dmg)",
        fileName: "FinAdvisor-Agent_0.1.0_x64.dmg",
        url: `${baseUrl}/FinAdvisor-Agent_0.1.0_x64.dmg`
      }
    ],
    linux: [
      {
        platform: "linux",
        label: "Linux (.AppImage)",
        fileName: "FinAdvisor-Agent_0.1.0_x64.AppImage",
        url: `${baseUrl}/FinAdvisor-Agent_0.1.0_x64.AppImage`
      }
    ],
    unknown: [
      {
        platform: "windows",
        label: "Windows (.msi)",
        fileName: "FinAdvisor-Agent_0.1.0_x64_en-US.msi",
        url: `${baseUrl}/FinAdvisor-Agent_0.1.0_x64_en-US.msi`
      },
      {
        platform: "macos",
        label: "macOS (.dmg)",
        fileName: "FinAdvisor-Agent_0.1.0_x64.dmg",
        url: `${baseUrl}/FinAdvisor-Agent_0.1.0_x64.dmg`
      }
    ]
  };

  return downloads[resolved] ?? downloads.unknown;
}
