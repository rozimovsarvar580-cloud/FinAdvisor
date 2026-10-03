"use client";

import { motion, useReducedMotion } from "framer-motion";
import * as Accordion from "@radix-ui/react-accordion";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Link } from "@/i18n/navigation";

const problemIcons = ["◈", "◷", "▤", "◎"];
const featureIcons = ["▦", "◉", "⌁", "▣", "◫", "↗", "◷", "✓"];
const stepIcons = ["01", "02", "03", "04"];
const faqKeys = ["q1", "q2", "q3", "q4", "q5"] as const;

function Reveal({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 22 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      viewport={{ once: true, amount: 0.12 }}
      whileInView={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
    >
      {children}
    </motion.div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function LandingPage() {
  const t = useTranslations("landing");

  return (
    <main>
      <section className="relative isolate overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/.12),transparent_55%)]"
        />
        <div className="mx-auto grid min-h-[640px] max-w-7xl items-center gap-14 px-page py-20 lg:grid-cols-[1.05fr_.95fr] lg:py-28">
          <Reveal className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary" />
              {t("hero.badge")}
            </p>
            <h1 className="mt-7 text-5xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
              {t("hero.title")}
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
              {t("hero.description")}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/signup">
                  {t("hero.primaryCta")}
                  <span aria-hidden="true">→</span>
                </Link>
              </Button>
              <Modal
                description={t("hero.samplePlan.description")}
                title={t("hero.samplePlan.title")}
                trigger={
                  <Button size="lg" variant="outline">
                    {t("hero.secondaryCta")}
                  </Button>
                }
              >
                <div className="space-y-3">
                  {(["overview", "market", "operations", "finance"] as const).map(
                    (section, index) => (
                      <div
                        className="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
                        key={section}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
                          0{index + 1}
                        </span>
                        <span className="text-sm font-medium">
                          {t(`hero.samplePlan.sections.${section}`)}
                        </span>
                      </div>
                    )
                  )}
                  <p className="pt-2 text-xs leading-5 text-muted-foreground">
                    {t("hero.samplePlan.note")}
                  </p>
                </div>
              </Modal>
            </div>
            <p className="mt-5 text-xs text-muted-foreground">
              {t("hero.footnote")}
            </p>
          </Reveal>

          <Reveal className="relative mx-auto w-full max-w-lg">
            <div
              aria-hidden="true"
              className="absolute -inset-5 rounded-[2rem] bg-primary/10 blur-2xl"
            />
            <Card className="relative overflow-hidden rounded-3xl p-6 shadow-xl sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {t("hero.calculator.eyebrow")}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold">
                    {t("hero.calculator.title")}
                  </h2>
                </div>
                <span
                  aria-hidden="true"
                  className="rounded-xl bg-primary/10 p-3 text-xl text-primary"
                >
                  ↗
                </span>
              </div>
              <div className="mt-7 space-y-5">
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t("hero.calculator.seats")}
                    </span>
                    <span className="font-semibold">
                      {t("hero.calculator.seatsValue")}
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-muted">
                    <div className="h-2 w-3/5 rounded-full bg-primary" />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t("hero.calculator.dailyOrders")}
                    </span>
                    <span className="font-semibold">
                      {t("hero.calculator.dailyOrdersValue")}
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-muted">
                    <div className="h-2 w-4/5 rounded-full bg-primary/60" />
                  </div>
                </div>
              </div>
              <div className="mt-7 rounded-2xl bg-muted p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {t("hero.calculator.estimate")}
                    </p>
                    <p className="mt-1 text-2xl font-semibold">—</p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {t("hero.calculator.preview")}
                  </span>
                </div>
              </div>
              <div className="mt-5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                  ✓
                </span>
                {t("hero.calculator.note")}
              </div>
            </Card>
          </Reveal>
        </div>
      </section>

      <section className="bg-muted/45 py-section">
        <div className="mx-auto max-w-7xl px-page">
          <Reveal>
            <SectionHeading
              description={t("problem.description")}
              eyebrow={t("problem.eyebrow")}
              title={t("problem.title")}
            />
          </Reveal>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {problemIcons.map((icon, index) => (
              <Reveal key={index}>
                <Card className="h-full p-6 transition-transform duration-200 hover:-translate-y-1">
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-xl text-primary"
                  >
                    {icon}
                  </span>
                  <h3 className="mt-5 font-semibold">
                    {t(`problem.cards.${index}.title`)}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {t(`problem.cards.${index}.description`)}
                  </p>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-section" id="how-it-works">
        <div className="mx-auto max-w-7xl px-page">
          <Reveal>
            <SectionHeading
              description={t("steps.description")}
              eyebrow={t("steps.eyebrow")}
              title={t("steps.title")}
            />
          </Reveal>
          <div className="relative mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div
              aria-hidden="true"
              className="absolute left-[12%] right-[12%] top-7 hidden border-t border-dashed border-primary/40 lg:block"
            />
            {stepIcons.map((number, index) => (
              <Reveal className="relative" key={number}>
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-background text-sm font-semibold text-primary shadow-sm">
                  {number}
                </span>
                <h3 className="mt-5 font-semibold">
                  {t(`steps.items.${index}.title`)}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t(`steps.items.${index}.description`)}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-muted/45 py-section" id="features">
        <div className="mx-auto max-w-7xl px-page">
          <Reveal>
            <SectionHeading
              description={t("features.description")}
              eyebrow={t("features.eyebrow")}
              title={t("features.title")}
            />
          </Reveal>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featureIcons.map((icon, index) => (
              <Reveal key={index}>
                <Card className="h-full p-6 transition-colors hover:border-primary/40">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-lg text-primary"
                  >
                    {icon}
                  </span>
                  <h3 className="mt-4 font-semibold">
                    {t(`features.items.${index}.title`)}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {t(`features.items.${index}.description`)}
                  </p>
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-section" id="pricing">
        <div className="mx-auto max-w-7xl px-page">
          <Reveal>
            <SectionHeading
              description={t("pricing.description")}
              eyebrow={t("pricing.eyebrow")}
              title={t("pricing.title")}
            />
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {(["free", "pro", "business"] as const).map((plan, index) => (
              <Reveal key={plan}>
                <Card
                  className={`h-full p-7 ${
                    index === 1 ? "border-primary shadow-lg shadow-primary/10" : ""
                  }`}
                >
                  <p className="text-sm font-medium text-muted-foreground">
                    {t(`pricing.plans.${plan}.name`)}
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold">
                    {t(`pricing.plans.${plan}.description`)}
                  </h3>
                  <ul className="mt-6 space-y-3">
                    {[0, 1, 2].map((item) => (
                      <li
                        className="flex gap-2 text-sm text-muted-foreground"
                        key={item}
                      >
                        <span aria-hidden="true" className="text-primary">
                          ✓
                        </span>
                        {t(`pricing.plans.${plan}.benefits.${item}`)}
                      </li>
                    ))}
                  </ul>
                </Card>
              </Reveal>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Button asChild variant="outline">
              <Link href="/pricing">
                {t("pricing.cta")}
                <span aria-hidden="true">→</span>
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="bg-primary py-16 text-primary-foreground sm:py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-page lg:grid-cols-[1fr_auto]">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary-foreground/70">
              {t("investors.eyebrow")}
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("investors.title")}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-primary-foreground/80">
              {t("investors.description")}
            </p>
          </Reveal>
          <Button asChild className="bg-white text-primary hover:bg-white/90">
            <Link href="/signup">{t("investors.cta")}</Link>
          </Button>
        </div>
      </section>

      <section className="py-section">
        <div className="mx-auto max-w-3xl px-page">
          <Reveal>
            <SectionHeading
              description={t("faq.description")}
              eyebrow={t("faq.eyebrow")}
              title={t("faq.title")}
            />
          </Reveal>
          <Accordion.Root
            className="mt-10 divide-y divide-border rounded-2xl border border-border bg-card px-6"
            collapsible
            type="single"
          >
            {faqKeys.map((key) => (
              <Accordion.Item className="py-1" key={key} value={key}>
                <Accordion.Header>
                  <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 py-5 text-left text-sm font-semibold [&[data-state=open]>span]:rotate-45">
                    {t(`faq.items.${key}.question`)}
                    <span
                      aria-hidden="true"
                      className="text-lg text-primary transition-transform"
                    >
                      +
                    </span>
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="max-w-2xl pb-5 text-sm leading-6 text-muted-foreground data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                  {t(`faq.items.${key}.answer`)}
                </Accordion.Content>
              </Accordion.Item>
            ))}
          </Accordion.Root>
        </div>
      </section>

      <section className="px-page pb-section">
        <Reveal className="mx-auto max-w-7xl rounded-3xl bg-muted px-6 py-14 text-center sm:px-12 sm:py-20">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            {t("cta.eyebrow")}
          </p>
          <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("cta.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted-foreground">
            {t("cta.description")}
          </p>
          <Button asChild className="mt-8" size="lg">
            <Link href="/signup">
              {t("cta.button")}
              <span aria-hidden="true">→</span>
            </Link>
          </Button>
        </Reveal>
      </section>
    </main>
  );
}
