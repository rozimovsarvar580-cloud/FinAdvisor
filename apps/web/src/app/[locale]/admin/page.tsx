import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { authOptions } from "../../../lib/auth";
import InvestorVerificationQueue from "./InvestorVerificationQueue";
import AdminUserControls from "./AdminUserControls";

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

export default async function AdminPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams?: Promise<{ q?: string }> }) {
  const { locale } = await params;
  const query = (await searchParams)?.q?.slice(0, 100) ?? "";
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  const t = await getTranslations({ locale, namespace: "routeCopy" });
  const session = await getServerSession(authOptions);
  let aiStatus: z.infer<typeof aiStatusSchema> | null = null;
  let revenue: z.infer<typeof revenueSchema> | null = null;
  let funnel: z.infer<typeof funnelSchema> | null = null;
  let investorVerifications: Array<{ id: string; user_id: string; email: string; full_name: string; organization: string | null; country: string; investment_thesis: string; source_of_funds: string; status: "submitted" | "approved" | "rejected"; review_note: string | null }> = [];
  let adminUsers: Array<{ id: string; email: string; role: string; is_suspended: boolean; subscription_plan: string }> = [];
  let subscriptions: Array<{ id: string; email: string; plan: string; status: string; billing_period: string; currency: string; amount_minor: number }> = [];
  let moderationItems: Array<{ id: string; reason: string; target_type: string; target_id: string }> = [];
  let systemHealth = false;

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
      const verificationResponse = await fetch(`${apiUrl}/admin/investor-verifications`, {
        headers: { Authorization: `Bearer ${session.accessToken}` }, cache: "no-store"
      });
      if (verificationResponse.ok) {
        const result = z.object({ items: z.array(z.object({ id: z.string(), user_id: z.string(), email: z.string(), full_name: z.string(), organization: z.string().nullable(), country: z.string(), investment_thesis: z.string(), source_of_funds: z.string(), status: z.enum(["submitted", "approved", "rejected"]), review_note: z.string().nullable() })) }).safeParse(await verificationResponse.json());
        if (result.success) investorVerifications = result.data.items;
      }
      const [usersResponse, subsResponse, moderationResponse, healthResponse] = await Promise.all([
        fetch(`${apiUrl}/admin/users?q=${encodeURIComponent(query)}`, { headers: { Authorization: `Bearer ${session.accessToken}` }, cache: "no-store" }),
        fetch(`${apiUrl}/admin/subscriptions`, { headers: { Authorization: `Bearer ${session.accessToken}` }, cache: "no-store" }),
        fetch(`${apiUrl}/admin/moderation`, { headers: { Authorization: `Bearer ${session.accessToken}` }, cache: "no-store" }),
        fetch(`${apiUrl}/health`, { cache: "no-store" })
      ]);
      if (usersResponse.ok) { const parsed = z.object({ items: z.array(z.object({ id: z.string(), email: z.string(), role: z.string(), is_suspended: z.boolean(), subscription_plan: z.string() })) }).safeParse(await usersResponse.json()); if (parsed.success) adminUsers = parsed.data.items; }
      if (subsResponse.ok) { const parsed = z.object({ items: z.array(z.object({ id: z.string(), email: z.string(), plan: z.string(), status: z.string(), billing_period: z.string(), currency: z.string(), amount_minor: z.number() })) }).safeParse(await subsResponse.json()); if (parsed.success) subscriptions = parsed.data.items; }
      if (moderationResponse.ok) { const parsed = z.object({ items: z.array(z.object({ id: z.string(), reason: z.string(), target_type: z.string(), target_id: z.string() })) }).safeParse(await moderationResponse.json()); if (parsed.success) moderationItems = parsed.data.items; }
      if (healthResponse.ok) { const parsed = z.object({ status: z.string() }).safeParse(await healthResponse.json()); systemHealth = parsed.success && parsed.data.status === "ok"; }
    } catch (error) {
      if (!(error instanceof TypeError || error instanceof SyntaxError)) throw error;
    }
  }

  return (
    <main>
      <h1>{t("admin.title")}</h1>
      {session?.user.role === "admin" && <>
        <section aria-labelledby="users-title"><h2 id="users-title">{t("admin.users")}</h2><form method="get"><label>{t("admin.searchUsers")} <input name="q" type="search" defaultValue={query} className="rounded border border-border bg-background px-2 py-1" /></label><button className="ml-2 rounded border border-border px-3 py-1 focus-visible:ring-2" type="submit">{t("admin.search")}</button></form>{session.accessToken && <AdminUserControls rows={adminUsers} token={session.accessToken} apiUrl={process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000"} labels={{ role: t("admin.role"), suspend: t("admin.suspend"), unsuspend: t("admin.unsuspend"), saved: t("admin.saving"), roles: { tadbirkor: t("roles.tadbirkor"), buxgalter: t("roles.buxgalter"), investor: t("roles.investor") } }} />}</section>
        <section aria-labelledby="subscriptions-title"><h2 id="subscriptions-title">{t("admin.subscriptions")}</h2><ul>{subscriptions.map((row) => <li key={row.id}>{row.email} · {row.plan} · {row.status} · {row.billing_period}</li>)}</ul></section>
        <section aria-labelledby="moderation-title"><h2 id="moderation-title">{t("admin.listingModeration")}</h2><ul>{moderationItems.map((row) => <li key={row.id}>{row.target_type}: {row.target_id} · {row.reason}</li>)}</ul></section>
        <section aria-labelledby="health-title"><h2 id="health-title">{t("admin.systemHealth")}</h2><p role="status">{t(systemHealth ? "admin.healthy" : "admin.healthUnavailable")}</p></section>
      </>}
      {session?.user.role === "admin" && session.accessToken && <InvestorVerificationQueue initialItems={investorVerifications} accessToken={session.accessToken} labels={{ title: t("admin.kyc_adminTitle"), empty: t("admin.kyc_noRequests"), status: t("investors.status"), approve: t("admin.kyc_approve"), reject: t("admin.kyc_reject"), submitted: t("investors.kyc_submitted"), approved: t("investors.kyc_approved"), rejected: t("investors.kyc_rejected") }} />}
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
