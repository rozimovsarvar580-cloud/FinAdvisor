"use client";

import * as Accordion from "@radix-ui/react-accordion";
import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { CommissionCalculator } from "@/components/pricing/commission-calculator";
import { PlanSelectButton } from "@/components/pricing/plan-select-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import {
  billingPeriods,
  comparisonFeatures,
  placeholderPricingPeriods,
  pricingPlaceholderMarker,
  pricingPlans,
  type BillingPeriod
} from "@/config/pricing";

const pricingFaqKeys = ["q1", "q2", "q3"] as const;

export function PricingPage() {
  const t = useTranslations("pricing");
  const reduceMotion = useReducedMotion();
  const [period, setPeriod] = useState<BillingPeriod>("weekly");

  return (
    <main>
      <section className="bg-muted/40">
        <div className="mx-auto max-w-7xl px-page py-20 text-center sm:py-28">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            {t("hero.eyebrow")}
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
            {t("hero.title")}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
            {t("hero.description")}
          </p>
          <div
            aria-label={t("periodSelectorLabel")}
            className="mt-8 inline-flex rounded-xl bg-background p-1 shadow-sm"
            role="group"
          >
            {billingPeriods.map((billingPeriod) => (
              <Button
                aria-pressed={period === billingPeriod}
                className={`relative z-10 min-w-24 ${
                  period === billingPeriod
                    ? "text-primary-foreground hover:bg-transparent"
                    : "text-muted-foreground"
                }`}
                key={billingPeriod}
                onClick={() => setPeriod(billingPeriod)}
                variant="ghost"
              >
                {period === billingPeriod ? (
                  <motion.span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 -z-10 rounded-lg bg-primary"
                    layoutId="pricing-period-indicator"
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 400, damping: 35 }
                    }
                  />
                ) : null}
                {t(`periods.${billingPeriod}`)}
              </Button>
            ))}
          </div>
          {placeholderPricingPeriods.includes(period) ? (
            <p aria-live="polite" className="mt-3 text-sm text-muted-foreground" role="status">
              {t("derivedPricePlaceholder", { marker: pricingPlaceholderMarker })}
            </p>
          ) : null}
        </div>
      </section>

      <section className="py-section">
        <div className="mx-auto max-w-7xl px-page">
          <p className="mb-6 rounded-xl border border-border bg-muted/50 p-4 text-sm leading-6 text-muted-foreground">
            {t("paymentNotice")}
          </p>
          <div className="grid items-stretch gap-5 lg:grid-cols-3">
            {pricingPlans.map((plan) => (
              <Card
                className={`flex h-full flex-col p-6 sm:p-8 ${
                  plan.highlighted
                    ? "border-primary shadow-xl shadow-primary/10"
                    : ""
                }`}
                key={plan.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">
                      {t(`plans.${plan.id}.name`)}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t(`plans.${plan.id}.description`)}
                    </p>
                  </div>
                  {plan.highlighted ? (
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      {t("popular")}
                    </span>
                  ) : null}
                </div>
                <p className="mt-7">
                  <span className="text-4xl font-semibold tracking-tight">
                    {plan.priceByPeriod[period]}
                  </span>
                  <span className="ml-2 text-sm text-muted-foreground">
                    {t(`periodSuffix.${period}`)}
                  </span>
                </p>
                <ul className="my-7 flex-1 space-y-4 border-t border-border pt-6">
                  {plan.featureKeys.map((featureKey) => (
                    <li
                      className="flex gap-3 text-sm"
                      key={featureKey}
                    >
                      <span aria-hidden="true" className="text-primary">
                        ✓
                      </span>
                      <span>{t(`plans.${plan.id}.features.${featureKey}`)}</span>
                    </li>
                  ))}
                </ul>
                <PlanSelectButton plan={plan.id} />
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-muted/40 py-section">
        <div className="mx-auto max-w-7xl px-page">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              {t("comparison.eyebrow")}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("comparison.title")}
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              {t("comparison.description")}
            </p>
          </div>
          <Table containerClassName="mt-10 max-h-[min(70vh,38rem)] rounded-xl border border-border bg-card shadow-sm">
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead>{t("comparison.criteria")}</TableHead>
                {pricingPlans.map((plan) => (
                  <TableHead key={plan.id}>
                    {t(`plans.${plan.id}.name`)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparisonFeatures.map((feature) => (
                <TableRow key={feature}>
                  <TableCell className="font-medium">
                    {t(`comparison.features.${feature}.name`)}
                  </TableCell>
                  {pricingPlans.map((plan) => (
                    <TableCell className="text-sm" key={plan.id}>
                      {t(
                        `comparison.features.${feature}.plans.${plan.id}`
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="bg-muted/40 py-section">
        <div className="mx-auto max-w-7xl px-page">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              {t("faq.eyebrow")}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("faq.title")}
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              {t("faq.description")}
            </p>
          </div>
          <Accordion.Root
            className="mx-auto mt-10 max-w-3xl space-y-3"
            collapsible
            type="single"
          >
            {pricingFaqKeys.map((key) => (
              <Accordion.Item
                className="rounded-xl border border-border bg-card px-5"
                key={key}
                value={key}
              >
                <Accordion.Header>
                  <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 py-5 text-left text-sm font-semibold transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none">
                    {t(`faq.items.${key}.question`)}
                    <span
                      aria-hidden="true"
                      className="text-lg text-primary transition-transform motion-reduce:transition-none group-data-[state=open]:rotate-45"
                    >
                      +
                    </span>
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="pb-5 text-sm leading-6 text-muted-foreground data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down motion-reduce:animate-none">
                  {t(`faq.items.${key}.answer`)}
                </Accordion.Content>
              </Accordion.Item>
            ))}
          </Accordion.Root>
          <p className="mx-auto mt-8 max-w-3xl rounded-xl border border-border bg-background p-4 text-sm leading-6 text-muted-foreground">
            {t("refundDraftNotice")}
          </p>
        </div>
      </section>

      <section className="py-section">
        <div className="mx-auto max-w-7xl px-page">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              {t("commission.sectionEyebrow")}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("commission.sectionTitle")}
            </h2>
          </div>
          <CommissionCalculator />
        </div>
      </section>

      <section className="px-page pb-section">
        <Card className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 bg-primary p-8 text-primary-foreground sm:flex-row sm:items-center sm:p-12">
          <div>
            <h2 className="text-2xl font-semibold">{t("cta.title")}</h2>
            <p className="mt-2 text-sm text-primary-foreground/80">
              {t("cta.description")}
            </p>
          </div>
          <Button asChild className="bg-white text-primary hover:bg-white/90">
            <Link href="/signup">{t("cta.button")}</Link>
          </Button>
        </Card>
      </section>
    </main>
  );
}
