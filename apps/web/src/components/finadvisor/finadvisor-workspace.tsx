"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { type PlanResult } from "@/components/finadvisor/plan-wizard";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const PlanWizard = dynamic(
  () => import("./plan-wizard").then((module) => module.PlanWizard),
  { loading: () => <PanelSkeleton /> }
);
const CalculatorsPanel = dynamic(
  () => import("./calculators-panel").then((module) => module.CalculatorsPanel),
  { loading: () => <PanelSkeleton /> }
);
const WhatIfPanel = dynamic(
  () => import("./what-if-panel").then((module) => module.WhatIfPanel),
  { loading: () => <PanelSkeleton /> }
);
const PlanAnalyzer = dynamic(
  () => import("./plan-analyzer").then((module) => module.PlanAnalyzer),
  { loading: () => <PanelSkeleton /> }
);
const AIChatPanel = dynamic(
  () => import("./ai-chat-panel").then((module) => module.AIChatPanel),
  { loading: () => <PanelSkeleton /> }
);
const ReportsPanel = dynamic(
  () => import("./reports-panel").then((module) => module.ReportsPanel),
  { loading: () => <PanelSkeleton /> }
);
const InvestorMarketplaceSection = dynamic(
  () =>
    import("@/components/investor-marketplace-section").then(
      (module) => module.InvestorMarketplaceSection
    ),
  { loading: () => <PanelSkeleton /> }
);
const DesktopAgentPanel = dynamic(
  () =>
    import("@/components/desktop-agent-panel").then(
      (module) => module.DesktopAgentPanel
    ),
  { loading: () => <PanelSkeleton /> }
);

const tabKeys = [
  "businessPlan",
  "calculators",
  "whatIf",
  "analyzer",
  "chat",
  "reports",
  "investorMarketplace",
  "desktopAgent"
] as const;

type TabKey = (typeof tabKeys)[number];

function PanelSkeleton() {
  const t = useTranslations("finadvisor");
  return (
    <div aria-label={t("loading")} className="space-y-5 p-6">
      <Skeleton className="h-9 w-2/5" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export function FinAdvisorWorkspace() {
  const t = useTranslations("finadvisor");
  const billing = useTranslations("billing");
  const [activeTab, setActiveTab] = useState<TabKey>("businessPlan");
  const [planResult, setPlanResult] = useState<PlanResult>();

  return (
    <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-7xl px-page py-8">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            FinAdvisor
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {t("title")}
          </h1>
        </div>
        <Link
          className="rounded-xl border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
          href="/app/billing"
        >
          {billing("openPage")}
        </Link>
      </div>
      <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
        <Card className="h-fit p-3">
          <nav
            aria-label={t("navigationLabel")}
            className="space-y-1"
            role="tablist"
            aria-orientation="vertical"
          >
            {tabKeys.map((tab) => (
              <button
                aria-selected={activeTab === tab}
                className={cn(
                  "flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                  activeTab === tab
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                key={tab}
                onClick={() => setActiveTab(tab)}
                role="tab"
                type="button"
              >
                {t(`tabs.${tab}`)}
              </button>
            ))}
          </nav>
        </Card>
        <section aria-live="polite" className="min-w-0">
          {activeTab === "businessPlan" ? (
            <PlanWizard onGenerated={setPlanResult} />
          ) : null}
          {activeTab === "calculators" ? <CalculatorsPanel /> : null}
          {activeTab === "whatIf" ? <WhatIfPanel /> : null}
          {activeTab === "analyzer" ? <PlanAnalyzer /> : null}
          {activeTab === "chat" ? (
            <AIChatPanel calculations={planResult?.calculations} />
          ) : null}
          {activeTab === "reports" ? (
            <ReportsPanel planResult={planResult} />
          ) : null}
          {activeTab === "investorMarketplace" ? (
            <InvestorMarketplaceSection />
          ) : null}
          {activeTab === "desktopAgent" ? <DesktopAgentPanel /> : null}
        </section>
      </div>
    </main>
  );
}
