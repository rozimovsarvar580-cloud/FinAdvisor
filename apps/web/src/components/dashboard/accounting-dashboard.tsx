"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { z } from "zod";

import { Card } from "@/components/ui/card";

const periods = ["day", "week", "month", "year"] as const;
const reportSchema = z.object({
  period: z.enum(periods), start_date: z.string(), end_date: z.string(), currency: z.string(),
  revenue: z.string(), expenses: z.string(), profit: z.string(), taxes: z.string(),
  stock: z.object({ in: z.string(), sold: z.string(), remaining: z.string() })
});
type Report = z.infer<typeof reportSchema>;
const cacheKey = "finadvisor.dashboard.reports.v1";

export function AccountingDashboard() {
  const t = useTranslations("routeCopy.dashboard");
  const { data: session } = useSession();
  const [reports, setReports] = useState<Partial<Record<(typeof periods)[number], Report>>>({});
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let active = true;
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) ?? "{}");
      const parsed = z.record(reportSchema).safeParse(cached);
      if (parsed.success && active) setReports(parsed.data);
    } catch { /* Storage can be unavailable in private browsing. */ }
    const token = session?.accessToken;
    if (!token) { setLoading(false); return () => { active = false; }; }
    void Promise.all(periods.map(async (period) => {
      const response = await fetch(`/api/reports/${period}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!response.ok) throw new Error("report unavailable");
      return reportSchema.parse(await response.json());
    })).then((results) => {
      if (!active) return;
      const next = Object.fromEntries(results.map((report) => [report.period, report]));
      setReports(next);
      setOffline(false);
      try { localStorage.setItem(cacheKey, JSON.stringify(next)); } catch { /* Cache is an optional offline aid. */ }
    }).catch(() => { if (active) setOffline(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session?.accessToken]);

  const visibleReports = periods.map((period) => reports[period]).filter((report): report is Report => Boolean(report));
  const maxRevenue = Math.max(1, ...visibleReports.map((report) => Number(report.revenue)));
  return <section aria-labelledby="accounting-dashboard-title" className="mt-8 space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 id="accounting-dashboard-title" className="text-xl font-semibold">{t("analyticsTitle")}</h2><p className="text-sm text-muted-foreground">{t("analyticsDescription")}</p></div>
      {offline ? <p className="text-sm text-muted-foreground" role="status">{visibleReports.length ? t("offlineCached") : t("offlineUnavailable")}</p> : null}
      {loading ? <p className="text-sm text-muted-foreground" role="status">{t("loadingReports")}</p> : null}
    </div>
    {visibleReports.length ? <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{periods.map((period) => {
        const report = reports[period];
        return <Card className="p-4" key={period}><h3 className="font-semibold">{t(`periods.${period}`)}</h3>
          {report ? <dl className="mt-3 space-y-2 text-sm">{(["revenue", "profit", "taxes"] as const).map((metric) => <div className="flex justify-between gap-2" key={metric}><dt className="text-muted-foreground">{t(`metrics.${metric}`)}</dt><dd className="font-medium tabular-nums">{new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Number(report[metric]))} {report.currency}</dd></div>)}</dl> : <p className="mt-3 text-sm text-muted-foreground">{t("reportUnavailable")}</p>}
        </Card>;
      })}</div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5"><h3 className="font-semibold">{t("revenueChartTitle")}</h3><div className="mt-4 flex h-40 items-end gap-3" role="img" aria-label={t("revenueChartTitle")}>{periods.map((period) => { const report = reports[period]; const height = report ? Math.max(4, Number(report.revenue) / maxRevenue * 100) : 0; return <div className="flex h-full flex-1 flex-col justify-end text-center" key={period}><span className="mb-1 text-xs tabular-nums">{report ? new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(Number(report.revenue)) : "—"}</span><div className="rounded-t bg-primary" style={{ height: `${height}%` }} /><span className="mt-2 text-xs text-muted-foreground">{t(`periods.${period}`)}</span></div>; })}</div></Card>
        <Card className="p-5"><h3 className="font-semibold">{t("stockTitle")}</h3><dl className="mt-4 grid grid-cols-3 gap-3">{(["in", "sold", "remaining"] as const).map((metric) => <div className="rounded-lg bg-muted/50 p-3" key={metric}><dt className="text-xs text-muted-foreground">{t(`stock.${metric}`)}</dt><dd className="mt-1 text-lg font-semibold tabular-nums">{reports.month ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Number(reports.month.stock[metric])) : "—"}</dd></div>)}</dl></Card>
      </div>
    </> : !loading ? <Card className="p-5 text-sm text-muted-foreground">{t("reportUnavailable")}</Card> : null}
  </section>;
}
