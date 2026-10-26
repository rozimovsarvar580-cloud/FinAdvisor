import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { authOptions } from "../../../lib/auth";

const locales = ["uz", "ru", "en"] as const;
export function generateStaticParams() { return locales.map((locale) => ({ locale })); }

const aiStatusSchema = z.object({
  connected: z.boolean(),
  provider: z.string().min(1),
  model: z.string().min(1)
}).strict();

const revenueSchema = z.object({
  period_start: z.string(),
  period_end: z.string(),
  mrr: z.array(
    z.object({
      currency: z.string(),
      amount_minor: z.number().int(),
      amount_decimal: z.string()
    }).strict()
  ),
  weekly_revenue: z.array(
    z.object({
      currency: z.string(),
      amount_minor: z.number().int(),
      amount_decimal: z.string()
    }).strict()
  ),
  active_subscribers_by_plan: z.record(z.string(), z.number().int().nonnegative()),
  current_active_subscribers: z.number().int().nonnegative(),
  churned_subscribers: z.number().int().nonnegative(),
  churn_rate_percent: z.string().nullable(),
  failed_payment_count: z.number().int().nonnegative(),
  accrued_commission: z.array(
    z.object({
      currency: z.string(),
      amount_minor: z.number().int(),
      amount_decimal: z.string()
    }).strict()
  ),
  ai_financials_by_user: z.array(
    z.object({
      user_id: z.string(),
      email: z.string(),
      plan: z.string(),
      subscription_revenue_minor_usd: z.number().int(),
      subscription_revenue_usd: z.string(),
      estimated_ai_cost_usd: z.string().nullable(),
      token_usage_complete: z.boolean(),
      cost_pricing_complete: z.boolean()
    }).strict()
  )
}).strict();

const funnelSchema = z.object({
  period_days: z.number().int(),
  counts: z.record(z.string(), z.number().int().nonnegative())
}).strict();

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  const t = await getTranslations({ locale, namespace: "routeCopy" });
  const session = await getServerSession(authOptions);
  let aiStatus: z.infer<typeof aiStatusSchema> | null = null;
  let revenue: z.infer<typeof revenueSchema> | null = null;
  let funnel: z.infer<typeof funnelSchema> | null = null;

  if (session?.user.role === "admin" && session.accessToken) {
    const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
    try {
      const response = await fetch(`${apiUrl}/admin/ai-status`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
        cache: "no-store"
      });
      if (response.ok) {
        const result = aiStatusSchema.safeParse(await response.json());
        if (result.success) aiStatus = result.data;
      }
      const revenueResponse = await fetch(`${apiUrl}/admin/revenue`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
        cache: "no-store"
      });
      if (revenueResponse.ok) {
        const result = revenueSchema.safeParse(await revenueResponse.json());
        if (result.success) revenue = result.data;
      }
      const funnelResponse = await fetch(`${apiUrl}/analytics/funnel`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
        cache: "no-store"
      });
      if (funnelResponse.ok) {
        const result = funnelSchema.safeParse(await funnelResponse.json());
        if (result.success) funnel = result.data;
      }
    } catch (error) {
      if (!(error instanceof TypeError || error instanceof SyntaxError)) throw error;
    }
  }

  return (
    <main>
      <h1>{t("admin.title")}</h1>
      <ul><li>{t("admin.users")}</li><li>{t("admin.planModeration")}</li><li>{t("admin.kycReview")}</li><li>{t("admin.auditLog")}</li><li>{t("admin.featureFlags")}</li></ul>
      <section aria-labelledby="ai-status-title">
        <h2 id="ai-status-title">{t("admin.aiStatusTitle")}</h2>
        {aiStatus ? (
          <>
            <p role="status">
              {t(aiStatus.connected ? "admin.aiConnected" : "admin.aiDisconnected")}
            </p>
            <dl>
              <dt>{t("admin.aiProvider")}</dt>
              <dd>{aiStatus.provider}</dd>
              <dt>{t("admin.aiModel")}</dt>
              <dd>{aiStatus.model}</dd>
            </dl>
          </>
        ) : (
          <p role="status">{t("admin.aiStatusUnavailable")}</p>
        )}
      </section>
      {session?.user.role === "admin" ? (
        <section aria-labelledby="funnel-title" className="mt-10 space-y-3">
          <h2 id="funnel-title" className="text-xl font-semibold">{t("admin.funnelTitle")}</h2>
          {funnel ? <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(["visit", "signup", "plan_created", "export", "checkout_started", "paid"] as const).map((event) => (
              <div key={event} className="rounded-lg border border-border bg-card p-4">
                <dt className="text-sm text-muted-foreground">{t(`admin.funnel.${event}`)}</dt>
                <dd className="text-2xl font-semibold">{funnel.counts[event] ?? 0}</dd>
              </div>
            ))}
          </dl> : <p role="status">{t("admin.funnelUnavailable")}</p>}
        </section>
      ) : null}
      {session?.user.role === "admin" ? (
        <section aria-labelledby="revenue-title" className="mt-10 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="revenue-title" className="text-xl font-semibold">
              {t("admin.revenueTitle")}
            </h2>
            <a
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-primary hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              href="/api/admin/revenue/export"
            >
              {t("admin.exportRevenueCsv")}
            </a>
          </div>
          {revenue ? (
            <>
              <p className="text-sm text-muted-foreground">
                {t("admin.revenuePeriod")}: {revenue.period_start} - {revenue.period_end}
              </p>
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Metric label={t("admin.mrr")} value={formatTotals(revenue.mrr)} />
                <Metric
                  label={t("admin.weeklyRevenue")}
                  value={formatTotals(revenue.weekly_revenue)}
                />
                <Metric
                  label={t("admin.activeSubscribers")}
                  value={String(revenue.current_active_subscribers)}
                />
                <Metric
                  label={t("admin.churn")}
                  value={
                    revenue.churn_rate_percent === null
                      ? `${revenue.churned_subscribers} (${t("admin.churnRateUnavailable")})`
                      : `${revenue.churn_rate_percent}% (${revenue.churned_subscribers})`
                  }
                />
                <Metric
                  label={t("admin.failedPayments")}
                  value={String(revenue.failed_payment_count)}
                />
                <Metric
                  label={t("admin.accruedCommission")}
                  value={formatTotals(revenue.accrued_commission)}
                />
              </dl>
              <p className="text-xs text-muted-foreground">
                {t("admin.churnEstimateNote")}
              </p>
              <div>
                <h3 className="mb-3 text-lg font-semibold">
                  {t("admin.activeSubscribersByPlan")}
                </h3>
                <ul className="flex flex-wrap gap-4">
                  {Object.entries(revenue.active_subscribers_by_plan).map(([plan, count]) => (
                    <li className="rounded-lg border border-border bg-card px-4 py-3" key={plan}>
                      <span className="font-medium">{plan}</span>: {count}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-3 text-lg font-semibold">
                  {t("admin.aiCostVsRevenue")}
                </h3>
                {revenue.ai_financials_by_user.length ? (
                  <div className="overflow-x-auto rounded-xl border border-border">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-muted text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3">{t("admin.user")}</th>
                          <th className="px-4 py-3">{t("admin.plan")}</th>
                          <th className="px-4 py-3">{t("admin.subscriptionRevenueUsd")}</th>
                          <th className="px-4 py-3">{t("admin.aiCostUsd")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {revenue.ai_financials_by_user.map((row) => (
                          <tr className="border-t border-border" key={row.user_id}>
                            <td className="px-4 py-3">{row.email}</td>
                            <td className="px-4 py-3">{row.plan}</td>
                            <td className="px-4 py-3">${row.subscription_revenue_usd}</td>
                            <td className="px-4 py-3">
                              {row.estimated_ai_cost_usd === null
                                ? t("admin.costUnavailable")
                                : `$${row.estimated_ai_cost_usd}`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground" role="status">
                    {t("admin.noAIUsage")}
                  </p>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground" role="status">
              {t("admin.revenueUnavailable")}
            </p>
          )}
        </section>
      ) : null}
      <Link href={`/${locale}/dashboard`}>{t("common.backToDashboard")}</Link>
    </main>
  );
}

function formatTotals(totals: Array<{ currency: string; amount_decimal: string }>) {
  return totals.length
    ? totals.map(({ currency, amount_decimal }) => `${currency} ${amount_decimal}`).join(", ")
    : "—";
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-2 text-xl font-semibold text-foreground">{value}</dd>
    </div>
  );
}
