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
const revenueAmountSchema = z.object({
  currency: z.string().min(1),
  amount_minor: z.number().int(),
  amount: z.string()
}).strict();
const revenueDashboardSchema = z.object({
  as_of: z.string(),
  period_start: z.string(),
  active_subscribers_total: z.number().int().nonnegative(),
  active_subscribers_by_plan: z.record(z.string(), z.number().int().nonnegative()),
  cancellations_30d: z.number().int().nonnegative(),
  cancellation_rate_percent_30d: z.string().nullable(),
  failed_payment_attempts_30d: z.number().int().nonnegative(),
  weekly_recurring_revenue: z.array(revenueAmountSchema),
  monthly_recurring_revenue: z.array(revenueAmountSchema),
  gross_subscription_payments_7d: z.array(revenueAmountSchema),
  accrued_commission: z.array(revenueAmountSchema),
  ai_cost_usd_30d: z.string(),
  ai_cost_complete_30d: z.boolean(),
  ai_cost_is_estimate_30d: z.boolean(),
  users: z.array(z.object({
    user_id: z.string(),
    email: z.string(),
    ai_cost_usd: z.string(),
    ai_cost_complete: z.boolean(),
    ai_cost_is_estimate: z.boolean(),
    subscription_revenue_30d: z.array(revenueAmountSchema)
  }).strict())
}).strict();

async function fetchAdminRevenue(apiUrl: string, accessToken: string) {
  try {
    const response = await fetch(`${apiUrl}/admin/revenue`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store"
    });
    if (!response.ok) return null;
    const parsed = revenueDashboardSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch (error) {
    if (error instanceof TypeError || error instanceof SyntaxError) return null;
    throw error;
  }
}

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  const t = await getTranslations({ locale, namespace: "routeCopy" });
  const session = await getServerSession(authOptions);
  const formatMoney = (amount: z.infer<typeof revenueAmountSchema>) =>
    t("admin.moneyAmount", {
      amount: amount.amount,
      currency: amount.currency
    });
  let aiStatus: z.infer<typeof aiStatusSchema> | null = null;
  let revenue: z.infer<typeof revenueDashboardSchema> | null = null;

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
    } catch (error) {
      if (!(error instanceof TypeError || error instanceof SyntaxError)) throw error;
    }
  }
  if (session?.user.role === "admin" && session.accessToken) {
    const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
    revenue = await fetchAdminRevenue(apiUrl, session.accessToken);
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
      <section aria-labelledby="revenue-title">
        <h2 id="revenue-title">{t("admin.revenueTitle")}</h2>
        {revenue ? (
          <>
            <p>{t("admin.revenueDescription")}</p>
            <p>
              {t("admin.reportingPeriod", {
                start: new Intl.DateTimeFormat(locale, {
                  dateStyle: "medium",
                  timeZone: "UTC"
                }).format(new Date(revenue.period_start)),
                end: new Intl.DateTimeFormat(locale, {
                  dateStyle: "medium",
                  timeZone: "UTC"
                }).format(new Date(revenue.as_of))
              })}
            </p>
            <a
              className="inline-flex rounded-lg text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              href="/api/admin/revenue/export"
            >
              {t("admin.exportRevenueCsv")}
            </a>
            <dl>
              <dt>{t("admin.activeSubscribers")}</dt>
              <dd>{revenue.active_subscribers_total}</dd>
              <dt>{t("admin.proSubscribers")}</dt>
              <dd>{revenue.active_subscribers_by_plan.pro ?? 0}</dd>
              <dt>{t("admin.businessSubscribers")}</dt>
              <dd>{revenue.active_subscribers_by_plan.business ?? 0}</dd>
              <dt>{t("admin.cancellations30d")}</dt>
              <dd>{revenue.cancellations_30d}</dd>
              <dt>{t("admin.cancellationRate30d")}</dt>
              <dd>
                {revenue.cancellation_rate_percent_30d === null
                  ? t("admin.notAvailable")
                  : t("admin.percentAmount", {
                      amount: revenue.cancellation_rate_percent_30d
                    })}
              </dd>
              <dt>{t("admin.failedPayments30d")}</dt>
              <dd>{revenue.failed_payment_attempts_30d}</dd>
            </dl>
            <RevenueAmounts
              amounts={revenue.weekly_recurring_revenue}
              formatAmount={formatMoney}
              label={t("admin.weeklyRecurringRevenue")}
              emptyLabel={t("admin.notAvailable")}
            />
            <RevenueAmounts
              amounts={revenue.monthly_recurring_revenue}
              formatAmount={formatMoney}
              label={t("admin.monthlyRecurringRevenue")}
              emptyLabel={t("admin.notAvailable")}
            />
            <RevenueAmounts
              amounts={revenue.gross_subscription_payments_7d}
              formatAmount={formatMoney}
              label={t("admin.grossPayments7d")}
              emptyLabel={t("admin.notAvailable")}
            />
            <RevenueAmounts
              amounts={revenue.accrued_commission}
              formatAmount={formatMoney}
              label={t("admin.accruedCommission")}
              emptyLabel={t("admin.notAvailable")}
            />
            <section aria-labelledby="ai-cost-title">
              <h3 id="ai-cost-title">{t("admin.aiCostTitle")}</h3>
              <p>
                {t("admin.aiCostAndStatus", {
                  amount: revenue.ai_cost_usd_30d,
                  complete: t(
                    revenue.ai_cost_complete_30d
                      ? "admin.complete"
                      : "admin.incomplete"
                  ),
                  estimate: t(
                    revenue.ai_cost_is_estimate_30d
                      ? "admin.estimated"
                      : "admin.notEstimated"
                  )
                })}
              </p>
              <p>{t("admin.currencyComparisonNote")}</p>
            </section>
            <section aria-labelledby="user-revenue-title">
              <h3 id="user-revenue-title">{t("admin.userComparisonTitle")}</h3>
              {revenue.users.length > 0 ? (
                <table>
                  <thead>
                    <tr>
                      <th scope="col">{t("admin.userEmail")}</th>
                      <th scope="col">{t("admin.aiCostUsd")}</th>
                      <th scope="col">{t("admin.subscriptionRevenue30d")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenue.users.map((item) => (
                      <tr key={item.user_id}>
                        <td>{item.email}</td>
                        <td>
                          {t("admin.aiCostAndStatus", {
                            amount: item.ai_cost_usd,
                            complete: t(
                              item.ai_cost_complete
                                ? "admin.complete"
                                : "admin.incomplete"
                            ),
                            estimate: t(
                              item.ai_cost_is_estimate
                                ? "admin.estimated"
                                : "admin.notEstimated"
                            )
                          })}
                        </td>
                        <td>
                          {item.subscription_revenue_30d.length > 0 ? (
                            <ul>
                              {item.subscription_revenue_30d.map((amount) => (
                                <li key={amount.currency}>
                                  {t("admin.moneyAmount", {
                                    amount: amount.amount,
                                    currency: amount.currency
                                  })}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            t("admin.notAvailable")
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>{t("admin.noUserRevenue")}</p>
              )}
            </section>
          </>
        ) : (
          <p role="status">{t("admin.revenueUnavailable")}</p>
        )}
      </section>
      <Link href={`/${locale}/dashboard`}>{t("common.backToDashboard")}</Link>
    </main>
  );
}

function RevenueAmounts({
  amounts,
  formatAmount,
  label,
  emptyLabel
}: {
  amounts: z.infer<typeof revenueAmountSchema>[];
  formatAmount: (amount: z.infer<typeof revenueAmountSchema>) => string;
  label: string;
  emptyLabel: string;
}) {
  return (
    <section>
      <h3>{label}</h3>
      {amounts.length > 0 ? (
        <ul>
          {amounts.map((amount) => (
            <li key={amount.currency}>
              {formatAmount(amount)}
            </li>
          ))}
        </ul>
      ) : (
        <p>{emptyLabel}</p>
      )}
    </section>
  );
}
