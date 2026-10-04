"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import {
  filterDeals,
  summarizeDeals,
  type MarketplaceDeal
} from "@/lib/investor-marketplace";

const sectors = ["all", "Food & Hospitality", "Retail", "Logistics"] as const;
const stages = ["all", "Idea", "Pilot", "Scale"] as const;
const risks = ["all", "Low", "Medium", "High"] as const;

export function InvestorMarketplaceSection() {
  const t = useTranslations("marketplace");
  const deals: MarketplaceDeal[] = [
    {
      id: "aziz-cafe",
      title: t("deals.azizCafe.title"),
      sector: "Food & Hospitality",
      stage: "Pilot",
      risk: "Medium",
      raised: 250000,
      target: 500000,
      targetReturn: 18,
      summary: t("deals.azizCafe.summary")
    },
    {
      id: "samarkand-market",
      title: t("deals.samarkandMarket.title"),
      sector: "Retail",
      stage: "Scale",
      risk: "Low",
      raised: 420000,
      target: 650000,
      targetReturn: 12,
      summary: t("deals.samarkandMarket.summary")
    },
    {
      id: "qoshqadsay-logs",
      title: t("deals.qoshqadsayLogs.title"),
      sector: "Logistics",
      stage: "Idea",
      risk: "High",
      raised: 90000,
      target: 300000,
      targetReturn: 26,
      summary: t("deals.qoshqadsayLogs.summary")
    },
    {
      id: "tashkent-kitchen",
      title: t("deals.tashkentKitchen.title"),
      sector: "Food & Hospitality",
      stage: "Scale",
      risk: "Low",
      raised: 520000,
      target: 900000,
      targetReturn: 15,
      summary: t("deals.tashkentKitchen.summary")
    }
  ];

  const [sector, setSector] = useState<(typeof sectors)[number]>("all");
  const [stage, setStage] = useState<(typeof stages)[number]>("all");
  const [risk, setRisk] = useState<(typeof risks)[number]>("all");

  const visibleDeals = useMemo(
    () => filterDeals(deals, { sector, stage, risk }),
    [deals, sector, stage, risk]
  );

  const summary = useMemo(() => summarizeDeals(visibleDeals), [visibleDeals]);

  return (
    <section className="py-section" id="investors">
      <div className="mx-auto max-w-7xl px-page">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            {t("hero.eyebrow")}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("hero.title")}
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            {t("hero.description")}
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-4">
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">{t("stats.deals")}</p>
            <p className="mt-3 text-3xl font-semibold">{summary.totalDeals}</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">{t("stats.raised")}</p>
            <p className="mt-3 text-3xl font-semibold">
              ${summary.totalRaised.toLocaleString("en-US")}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">{t("stats.target")}</p>
            <p className="mt-3 text-3xl font-semibold">
              ${summary.totalTarget.toLocaleString("en-US")}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted-foreground">{t("stats.return")}</p>
            <p className="mt-3 text-3xl font-semibold">{summary.averageReturn}%</p>
          </Card>
        </div>

        <Card className="mt-8 p-6">
          <div className="flex flex-col gap-4">
            <h3 className="text-xl font-semibold">{t("filters.title")}</h3>
            <div className="flex flex-wrap gap-2">
              {sectors.map((option) => (
                <Button
                  key={option}
                  onClick={() => setSector(option)}
                  size="sm"
                  variant={sector === option ? "default" : "outline"}
                >
                  {option === "all" ? t("filters.sectorAll") : option}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {stages.map((option) => (
                <Button
                  key={option}
                  onClick={() => setStage(option)}
                  size="sm"
                  variant={stage === option ? "default" : "outline"}
                >
                  {option === "all" ? t("filters.stageAll") : option}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {risks.map((option) => (
                <Button
                  key={option}
                  onClick={() => setRisk(option)}
                  size="sm"
                  variant={risk === option ? "default" : "outline"}
                >
                  {option === "all" ? t("filters.riskAll") : option}
                </Button>
              ))}
            </div>
          </div>
        </Card>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          {visibleDeals.length > 0 ? (
            visibleDeals.map((deal) => (
              <Card className="p-6" key={deal.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-primary">
                      {deal.sector}
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold">{deal.title}</h3>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {deal.stage}
                  </span>
                </div>

                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  {deal.summary}
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t("deal.raised")}
                    </p>
                    <p className="mt-1 font-semibold">
                      ${deal.raised.toLocaleString("en-US")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t("deal.target")}
                    </p>
                    <p className="mt-1 font-semibold">
                      ${deal.target.toLocaleString("en-US")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t("deal.return")}
                    </p>
                    <p className="mt-1 font-semibold">{deal.targetReturn}%</p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
                  <span className="text-sm text-muted-foreground">
                    {t("deal.risk")}: {deal.risk}
                  </span>
                  <Button asChild>
                    <Link href="/signup">{t("deal.cta")}</Link>
                  </Button>
                </div>
              </Card>
            ))
          ) : (
            <Card className="col-span-full p-10 text-center">
              <h3 className="text-xl font-semibold">{t("empty.title")}</h3>
              <p className="mt-3 text-muted-foreground">{t("empty.description")}</p>
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}
