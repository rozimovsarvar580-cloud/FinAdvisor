"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { buildSyncQueue, getQueueSummary, type SyncTask } from "@/lib/desktop-agent";

const taskTranslationKeys: Record<string, string> = {
  "sync-plan": "syncPlan",
  "sync-pricing": "syncPricing",
  "sync-bank-rules": "syncBankRules"
};

const tasks: SyncTask[] = [
  {
    id: "sync-plan",
    title: "syncPlan",
    priority: "Medium",
    status: "Queued",
    estimatedMinutes: 8
  },
  {
    id: "sync-pricing",
    title: "syncPricing",
    priority: "High",
    status: "Queued",
    estimatedMinutes: 5
  },
  {
    id: "sync-bank-rules",
    title: "syncBankRules",
    priority: "Low",
    status: "Blocked",
    estimatedMinutes: 10
  }
];

export function DesktopAgentPanel() {
  const t = useTranslations("desktopAgent");
  const [selected, setSelected] = useState<string>(tasks[0].id);
  const queue = useMemo(() => buildSyncQueue(tasks), []);
  const summary = useMemo(() => getQueueSummary(tasks), []);

  const activeTask = queue.find((task) => task.id === selected) ?? queue[0];

  return (
    <section className="space-y-6">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          {t("eyebrow")}
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("title")}
        </h2>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_2fr]">
        <div className="space-y-3">
          {queue.map((task) => (
            <Button
              className="flex w-full justify-between rounded-xl border bg-background p-4 text-left"
              key={task.id}
              onClick={() => setSelected(task.id)}
              variant={activeTask?.id === task.id ? "default" : "ghost"}
            >
              <span>
                <span className="block font-medium">
                  {t(`tasks.${taskTranslationKeys[task.id]}`)}
                </span>
                <span className="text-xs opacity-75">{task.priority}</span>
              </span>
              <span className="text-xs">{task.estimatedMinutes}m</span>
            </Button>
          ))}
        </div>

        <Card className="p-6">
          <h3 className="text-xl font-semibold">
            {t(
              `tasks.${
                activeTask ? taskTranslationKeys[activeTask.id] : "syncPlan"
              }`
            )}
          </h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-muted p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("stats.queued")}
              </p>
              <p className="mt-2 text-2xl font-semibold">{summary.queued}</p>
            </div>
            <div className="rounded-xl bg-muted p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("stats.highPriority")}
              </p>
              <p className="mt-2 text-2xl font-semibold">{summary.highPriority}</p>
            </div>
            <div className="rounded-xl bg-muted p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("stats.blocked")}
              </p>
              <p className="mt-2 text-2xl font-semibold">{summary.blocked}</p>
            </div>
          </div>

          <p className="mt-6 text-sm leading-7 text-muted-foreground">
            {t("description")}
          </p>
        </Card>
      </div>
    </section>
  );
}
