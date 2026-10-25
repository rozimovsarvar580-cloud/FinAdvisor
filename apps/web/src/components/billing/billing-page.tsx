"use client";

import { useLocale, useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  placeholderPricingPeriods,
  pricingPlans,
  type BillingPeriod
} from "@/config/pricing";

type PaidPlanId = "pro" | "business";
type CheckoutError = "placeholderPrice" | "unavailable" | "failed";
type BillingActionError = "unavailable" | "failed" | "paymentMethodUnavailable";
type BillingActionNotice = "canceled" | "planScheduled";

interface BillingInvoice {
  invoice_number: string;
  amount: string;
  currency: string;
  status: string;
  created_at: string;
  paid_at: string | null;
  due_at: string | null;
}

interface BillingSummary {
  current_plan: string;
  status: string;
  billing_period: string | null;
  price: string | null;
  currency: string | null;
  next_charge_at: string | null;
  access_until: string | null;
  cancel_at_period_end: boolean;
  pending_plan: string | null;
  pending_plan_effective_at: string | null;
  payment_method_available: boolean;
  invoices: BillingInvoice[];
}

function isBillingSummary(value: unknown): value is BillingSummary {
  if (
    value === null ||
    typeof value !== "object" ||
    !("current_plan" in value) ||
    typeof value.current_plan !== "string" ||
    !("status" in value) ||
    typeof value.status !== "string" ||
    !("billing_period" in value) ||
    !(value.billing_period === null || typeof value.billing_period === "string") ||
    !("price" in value) ||
    !(value.price === null || typeof value.price === "string") ||
    !("currency" in value) ||
    !(value.currency === null || typeof value.currency === "string") ||
    !("next_charge_at" in value) ||
    !(value.next_charge_at === null || typeof value.next_charge_at === "string") ||
    !("access_until" in value) ||
    !(value.access_until === null || typeof value.access_until === "string") ||
    !("cancel_at_period_end" in value) ||
    typeof value.cancel_at_period_end !== "boolean" ||
    !("pending_plan" in value) ||
    !(value.pending_plan === null || typeof value.pending_plan === "string") ||
    !("pending_plan_effective_at" in value) ||
    !(
      value.pending_plan_effective_at === null ||
      typeof value.pending_plan_effective_at === "string"
    ) ||
    !("payment_method_available" in value) ||
    typeof value.payment_method_available !== "boolean" ||
    !("invoices" in value) ||
    !Array.isArray(value.invoices)
  ) {
    return false;
  }
  return value.invoices.every(
    (invoice: unknown) =>
      invoice !== null &&
      typeof invoice === "object" &&
      "invoice_number" in invoice &&
      typeof invoice.invoice_number === "string" &&
      "amount" in invoice &&
      typeof invoice.amount === "string" &&
      "currency" in invoice &&
      typeof invoice.currency === "string" &&
      "status" in invoice &&
      typeof invoice.status === "string" &&
      "created_at" in invoice &&
      typeof invoice.created_at === "string" &&
      "paid_at" in invoice &&
      (invoice.paid_at === null || typeof invoice.paid_at === "string") &&
      "due_at" in invoice &&
      (invoice.due_at === null || typeof invoice.due_at === "string")
  );
}

function isPaidPlan(value: string | undefined): value is PaidPlanId {
  return value === "pro" || value === "business";
}

function isBillingPeriod(value: string | undefined): value is BillingPeriod {
  return value === "weekly" || value === "monthly" || value === "yearly";
}

async function requestBillingSummary(accessToken: string): Promise<BillingSummary> {
  const response = await fetch("/api/billing/summary", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error("Billing summary could not be loaded");
  }
  const body: unknown = await response.json();
  if (!isBillingSummary(body)) {
    throw new SyntaxError("Billing summary response is invalid");
  }
  return body;
}

export function BillingPage({
  initialPlan,
  initialPeriod,
  onCheckoutRedirect = (url) => window.location.assign(url)
}: {
  initialPlan?: string;
  initialPeriod?: string;
  onCheckoutRedirect?: (url: string) => void;
}) {
  const t = useTranslations("billing");
  const locale = useLocale();
  const { data: session, status } = useSession();
  const [plan, setPlan] = useState<PaidPlanId>(
    isPaidPlan(initialPlan) ? initialPlan : "pro"
  );
  const [period, setPeriod] = useState<BillingPeriod>(
    isBillingPeriod(initialPeriod) ? initialPeriod : "weekly"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<CheckoutError>();
  const [summary, setSummary] = useState<BillingSummary>();
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<BillingActionError>();
  const [actionError, setActionError] = useState<BillingActionError>();
  const [actionNotice, setActionNotice] = useState<BillingActionNotice>();
  const [activeAction, setActiveAction] = useState<
    "cancel" | "plan-change" | "payment-method"
  >();
  const selectedPlan = pricingPlans.find((item) => item.id === plan);
  const hasPlaceholderPrice = placeholderPricingPeriods.includes(period);
  const isBusinessOwner = session?.user.role === "tadbirkor";
  const accessToken = session?.accessToken;
  const isActiveSubscription = summary?.status === "active";
  const isActionBusy = activeAction !== undefined;
  const canSubmit =
    status === "authenticated" &&
    Boolean(accessToken) &&
    isBusinessOwner &&
    summary !== undefined &&
    !hasPlaceholderPrice &&
    !summaryLoading &&
    !summaryError &&
    !isActionBusy &&
    (summary.status === "active"
      ? summary.current_plan !== plan &&
        !summary.cancel_at_period_end &&
        !summary.pending_plan
      : !["past_due", "incomplete"].includes(summary.status));

  const applyBillingSummary = useCallback(
    (value: BillingSummary) => {
      setSummary(value);
      if (!isPaidPlan(initialPlan) && isPaidPlan(value.current_plan)) {
        setPlan(value.current_plan);
      }
    },
    [initialPlan]
  );

  async function refreshSummary() {
    if (!accessToken || !isBusinessOwner) return;
    setSummaryLoading(true);
    setSummaryError(undefined);
    try {
      applyBillingSummary(await requestBillingSummary(accessToken));
    } catch (error) {
      setSummaryError(error instanceof TypeError ? "unavailable" : "failed");
    } finally {
      setSummaryLoading(false);
    }
  }

  useEffect(() => {
    if (status !== "authenticated" || !accessToken || !isBusinessOwner) {
      setSummary(undefined);
      setSummaryLoading(false);
      return;
    }

    let isCurrent = true;
    setSummaryLoading(true);
    setSummaryError(undefined);
    void requestBillingSummary(accessToken)
      .then((value) => {
        if (isCurrent) applyBillingSummary(value);
      })
      .catch((error: unknown) => {
        if (isCurrent) {
          setSummaryError(error instanceof TypeError ? "unavailable" : "failed");
        }
      })
      .finally(() => {
        if (isCurrent) setSummaryLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [accessToken, applyBillingSummary, isBusinessOwner, status]);

  async function startCheckout() {
    if (!session?.accessToken || hasPlaceholderPrice || isSubmitting) return;
    setCheckoutError(undefined);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          plan,
          billing_period: period,
          locale
        })
      });
      if (!response.ok) {
        const body: unknown = await response.json();
        const detail =
          body !== null && typeof body === "object" && "detail" in body
            ? body.detail
            : undefined;
        const code =
          detail !== null && typeof detail === "object" && "code" in detail
            ? detail.code
            : undefined;
        if (code === "billing.placeholder_price") {
          setCheckoutError("placeholderPrice");
        } else if (response.status === 503) {
          setCheckoutError("unavailable");
        } else {
          setCheckoutError("failed");
        }
        setIsSubmitting(false);
        return;
      }

      const body: unknown = await response.json();
      if (
        body === null ||
        typeof body !== "object" ||
        !("checkout_url" in body) ||
        typeof body.checkout_url !== "string"
      ) {
        setCheckoutError("failed");
        setIsSubmitting(false);
        return;
      }
      onCheckoutRedirect(body.checkout_url);
    } catch (error) {
      if (error instanceof TypeError) {
        setCheckoutError("unavailable");
        setIsSubmitting(false);
        return;
      }
      throw error;
    }
  }

  async function schedulePlanChange() {
    if (!accessToken || !summary || !canSubmit || !isActiveSubscription) return;
    setActionError(undefined);
    setActionNotice(undefined);
    setActiveAction("plan-change");
    try {
      const response = await fetch("/api/billing/plan-change", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ plan })
      });
      if (!response.ok) {
        setActionError(response.status === 503 ? "unavailable" : "failed");
        return;
      }
      setActionNotice("planScheduled");
      await refreshSummary();
    } catch (error) {
      if (error instanceof TypeError) {
        setActionError("unavailable");
        return;
      }
      if (error instanceof SyntaxError) {
        setActionError("failed");
        return;
      }
      throw error;
    } finally {
      setActiveAction(undefined);
    }
  }

  async function cancelSubscription() {
    if (!accessToken || !summary || isActionBusy) return;
    if (!window.confirm(t("manage.cancelConfirm"))) return;
    setActionError(undefined);
    setActionNotice(undefined);
    setActiveAction("cancel");
    try {
      const response = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!response.ok) {
        setActionError(response.status === 503 ? "unavailable" : "failed");
        return;
      }
      setActionNotice("canceled");
      await refreshSummary();
    } catch (error) {
      if (error instanceof TypeError) {
        setActionError("unavailable");
        return;
      }
      throw error;
    } finally {
      setActiveAction(undefined);
    }
  }

  async function updatePaymentMethod() {
    if (!accessToken || !summary?.payment_method_available || isActionBusy) return;
    setActionError(undefined);
    setActionNotice(undefined);
    setActiveAction("payment-method");
    try {
      const response = await fetch("/api/billing/payment-method", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ locale })
      });
      if (!response.ok) {
        setActionError(
          response.status === 503 ? "unavailable" : "paymentMethodUnavailable"
        );
        return;
      }
      const body: unknown = await response.json();
      if (
        body === null ||
        typeof body !== "object" ||
        !("update_url" in body) ||
        typeof body.update_url !== "string"
      ) {
        setActionError("failed");
        return;
      }
      onCheckoutRedirect(body.update_url);
    } catch (error) {
      if (error instanceof TypeError) {
        setActionError("unavailable");
        return;
      }
      if (error instanceof SyntaxError) {
        setActionError("failed");
        return;
      }
      throw error;
    } finally {
      setActiveAction(undefined);
    }
  }

  return (
    <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-4xl px-page py-10">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
        {t("eyebrow")}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">{t("title")}</h1>
      {isBusinessOwner ? (
        <Card className="mt-7 p-6 sm:p-8" aria-busy={summaryLoading}>
          <h2 className="text-xl font-semibold">{t("manage.title")}</h2>
          {summaryLoading ? (
            <p className="mt-4 text-sm text-muted-foreground" role="status">
              {t("manage.loading")}
            </p>
          ) : null}
          {summaryError ? (
            <div className="mt-4" role="alert">
              <p className="text-sm text-destructive">
                {t(`manage.errors.${summaryError}`)}
              </p>
              <Button
                className="mt-3"
                disabled={summaryLoading}
                onClick={() => void refreshSummary()}
                variant="secondary"
              >
                {t("manage.retry")}
              </Button>
            </div>
          ) : null}
          {summary && !summaryLoading && !summaryError ? (
            <>
              <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-muted-foreground">
                    {t("currentPlan")}
                  </dt>
                  <dd className="mt-1 font-medium">
                    {t(`plans.${summary.current_plan}`)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">
                    {t("manage.subscriptionStatus")}
                  </dt>
                  <dd className="mt-1 font-medium">
                    {t(`manage.status.${summary.status}`)}
                  </dd>
                </div>
                {summary.price && summary.currency ? (
                  <div>
                    <dt className="text-sm text-muted-foreground">{t("price")}</dt>
                    <dd className="mt-1 font-medium">
                      {summary.price} {summary.currency}
                    </dd>
                  </div>
                ) : null}
                {summary.billing_period ? (
                  <div>
                    <dt className="text-sm text-muted-foreground">
                      {t("billingPeriod")}
                    </dt>
                    <dd className="mt-1 font-medium">
                      {t(`periods.${summary.billing_period}`)}
                    </dd>
                  </div>
                ) : null}
                {summary.next_charge_at ? (
                  <div>
                    <dt className="text-sm text-muted-foreground">
                      {t("manage.nextCharge")}
                    </dt>
                    <dd className="mt-1 font-medium">
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium"
                      }).format(new Date(summary.next_charge_at))}
                    </dd>
                  </div>
                ) : null}
                {summary.access_until ? (
                  <div>
                    <dt className="text-sm text-muted-foreground">
                      {t("manage.accessUntil")}
                    </dt>
                    <dd className="mt-1 font-medium">
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium"
                      }).format(new Date(summary.access_until))}
                    </dd>
                  </div>
                ) : null}
                {summary.pending_plan ? (
                  <div className="sm:col-span-2">
                    <dt className="text-sm text-muted-foreground">
                      {t("manage.pendingPlan")}
                    </dt>
                    <dd className="mt-1 font-medium">
                      {t(`plans.${summary.pending_plan}`)}
                      {summary.pending_plan_effective_at
                        ? ` · ${new Intl.DateTimeFormat(locale, {
                            dateStyle: "medium"
                          }).format(new Date(summary.pending_plan_effective_at))}`
                        : ""}
                    </dd>
                  </div>
                ) : null}
              </dl>
              {actionNotice ? (
                <p className="mt-4 text-sm text-primary" role="status">
                  {t(`manage.notices.${actionNotice}`)}
                </p>
              ) : null}
              {actionError ? (
                <p className="mt-4 text-sm text-destructive" role="alert">
                  {t(`manage.errors.${actionError}`)}
                </p>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-3">
                {summary.status === "active" && !summary.cancel_at_period_end ? (
                  <Button
                    disabled={isActionBusy}
                    loading={activeAction === "cancel"}
                    onClick={() => void cancelSubscription()}
                    variant="secondary"
                  >
                    {activeAction === "cancel"
                      ? t("manage.canceling")
                      : t("manage.cancel")}
                  </Button>
                ) : null}
                {summary.status === "active" ? (
                  <>
                    <Button
                      disabled={
                        isActionBusy || !summary.payment_method_available
                      }
                      loading={activeAction === "payment-method"}
                      onClick={() => void updatePaymentMethod()}
                      variant="secondary"
                    >
                      {activeAction === "payment-method"
                        ? t("manage.updatingPaymentMethod")
                        : t("manage.updatePaymentMethod")}
                    </Button>
                    {!summary.payment_method_available ? (
                      <p className="basis-full text-sm text-muted-foreground">
                        {t("manage.paymentMethodUnavailable")}
                      </p>
                    ) : null}
                  </>
                ) : null}
              </div>
              <div className="mt-8 border-t border-border pt-5">
                <h3 className="text-lg font-semibold">
                  {t("manage.invoices.title")}
                </h3>
                {summary.invoices.length ? (
                  <ul className="mt-3 divide-y divide-border">
                    {summary.invoices.map((invoice) => (
                      <li
                        className="grid gap-1 py-3 text-sm sm:grid-cols-[1fr_auto_auto]"
                        key={invoice.invoice_number}
                      >
                        <span className="font-medium">
                          {invoice.invoice_number}
                        </span>
                        <span>
                          {invoice.amount} {invoice.currency}
                        </span>
                        <span className="text-muted-foreground">
                          {t(`manage.invoiceStatus.${invoice.status}`)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {t("manage.invoices.empty")}
                  </p>
                )}
              </div>
            </>
          ) : null}
        </Card>
      ) : null}
      <Card className="mt-7 p-6 sm:p-8">
        <h2 className="text-xl font-semibold">{t("checkout.title")}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t("checkout.description")}
        </p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium" htmlFor="billing-plan">
            {t("checkout.planLabel")}
            <Select
              id="billing-plan"
              onChange={(event) => {
                if (isPaidPlan(event.currentTarget.value)) {
                  setPlan(event.currentTarget.value);
                  setActionError(undefined);
                  setActionNotice(undefined);
                }
              }}
              value={plan}
            >
              <option value="pro">{t("plans.pro")}</option>
              <option value="business">{t("plans.business")}</option>
            </Select>
          </label>
          <label className="grid gap-2 text-sm font-medium" htmlFor="billing-period">
            {t("checkout.periodLabel")}
            <Select
              id="billing-period"
              onChange={(event) => {
                if (isBillingPeriod(event.currentTarget.value)) {
                  setPeriod(event.currentTarget.value);
                  setCheckoutError(undefined);
                  setActionError(undefined);
                  setActionNotice(undefined);
                }
              }}
              value={period}
            >
              <option value="weekly">{t("periods.weekly")}</option>
              <option value="monthly">{t("periods.monthly")}</option>
              <option value="yearly">{t("periods.yearly")}</option>
            </Select>
          </label>
        </div>
        {selectedPlan ? (
          <p className="mt-6 border-t border-border pt-5 text-sm text-muted-foreground">
            {t("price")}:{" "}
            <span className="font-semibold text-foreground">
              {selectedPlan.priceByPeriod[period]}
            </span>{" "}
            {t(`checkout.periodSuffix.${period}`)}
          </p>
        ) : null}
        {hasPlaceholderPrice ? (
          <p
            aria-live="polite"
            className="mt-5 rounded-lg border border-border bg-muted p-4 text-sm leading-6 text-muted-foreground"
            role="status"
          >
            {t("checkout.placeholderPrice")}
          </p>
        ) : null}
        {status !== "authenticated" || !session?.accessToken ? (
          <p className="mt-4 text-sm text-muted-foreground">{t("checkout.signInRequired")}</p>
        ) : !isBusinessOwner ? (
          <p className="mt-4 text-sm text-muted-foreground">{t("checkout.ownerRequired")}</p>
        ) : null}
        {checkoutError ? (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {t(`checkout.errors.${checkoutError}`)}
          </p>
        ) : null}
        <Button
          className="mt-6 w-full sm:w-auto"
          disabled={!canSubmit}
          loading={isSubmitting || activeAction === "plan-change"}
          onClick={isActiveSubscription ? schedulePlanChange : startCheckout}
        >
          {isSubmitting
            ? t("checkout.starting")
            : activeAction === "plan-change"
              ? t("manage.schedulingPlan")
              : isActiveSubscription
                ? t("manage.schedulePlanChange")
                : t("checkout.start")}
        </Button>
        <p className="mt-5 text-xs leading-5 text-muted-foreground">
          {t("checkout.activationNotice")}
        </p>
      </Card>
    </main>
  );
}
