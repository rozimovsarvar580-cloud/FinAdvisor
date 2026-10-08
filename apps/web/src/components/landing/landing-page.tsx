"use client";

import { motion, useReducedMotion } from "framer-motion";
import * as Accordion from "@radix-ui/react-accordion";
import { useLocale, useTranslations } from "next-intl";

import { CountUp } from "@/components/motion/count-up";
import { LandingDashboardPreview } from "@/components/landing/landing-dashboard-preview";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Link } from "@/i18n/navigation";

const problemIcons = ["◈", "◉", "▤", "◎", "◇"];
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
  const nav = useTranslations("nav");
  const locale = useLocale();

  return (
    <>
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
            <LandingDashboardPreview
              ariaLabel={t("hero.dashboard.ariaLabel")}
              cashFlowLabel={t("hero.dashboard.cashFlow")}
              costsLabel={t("hero.dashboard.costs")}
              revenueLabel={t("hero.dashboard.revenue")}
              subtitle={t("hero.dashboard.subtitle")}
              title={t("hero.dashboard.title")}
              visualNote={t("hero.dashboard.visualNote")}
            />
          </Reveal>
        </div>
      </section>

      <section
        aria-label={t("stats.ariaLabel")}
        className="border-y border-border bg-muted/30 py-8 sm:py-10"
      >
        <div className="mx-auto max-w-7xl px-page">
          <p className="mb-6 text-center text-xs font-medium text-muted-foreground">
            {t("stats.note")}
          </p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-8">
            {[
              { key: "questions", value: 5 },
              { key: "steps", value: 4 },
              { key: "languages", value: 3 }
            ].map(({ key, value }) => (
              <Reveal key={key}>
                <div className="flex items-center justify-center gap-3 text-center">
                  <span className="text-3xl font-semibold tracking-tight text-primary">
                    <CountUp duration={1} locale={locale} value={value} />
                  </span>
                  <span className="max-w-36 text-left text-sm leading-5 text-muted-foreground">
                    {t(`stats.items.${key}`)}
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
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
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {problemIcons.map((icon, index) => (
              <Reveal key={index}>
                <Card className="h-full p-6 motion-safe:transition-transform motion-safe:duration-200 motion-safe:hover:-translate-y-1 motion-reduce:transition-none">
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

      <section className="bg-muted/45 py-section" id="desktop-agent">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-page lg:grid-cols-[1fr_1fr]">
          <Reveal>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              {t("desktop.eyebrow")}
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("desktop.title")}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
              {t("desktop.description")}
            </p>
            <Button asChild className="mt-7" variant="outline">
              <Link href="/desktop-agent">
                {t("desktop.cta")}
                <span aria-hidden="true">→</span>
              </Link>
            </Button>
          </Reveal>
          <Reveal>
            <Card className="p-6 sm:p-8">
              <ul className="space-y-5">
                {(["windowsMacos", "deviceHistory", "statementSync"] as const).map(
                  (key) => (
                    <li className="flex items-start gap-3" key={key}>
                      <span
                        aria-hidden="true"
                        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm text-primary"
                      >
                        ✓
                      </span>
                      <span className="text-sm leading-6">{t(`desktop.benefits.${key}`)}</span>
                    </li>
                  )
                )}
              </ul>
              <p className="mt-6 border-t border-border pt-5 text-xs leading-5 text-muted-foreground">
                {t("desktop.note")}
              </p>
            </Card>
          </Reveal>
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
                  <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 py-5 text-left text-sm font-semibold transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none [&[data-state=open]>span]:rotate-45">
                    {t(`faq.items.${key}.question`)}
                    <span
                      aria-hidden="true"
                      className="text-lg text-primary transition-transform motion-reduce:transition-none"
                    >
                      +
                    </span>
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="max-w-2xl pb-5 text-sm leading-6 text-muted-foreground data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down motion-reduce:animate-none">
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

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-page py-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              className="inline-flex rounded-sm text-lg font-bold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              href="/"
            >
              FinAdvisor
            </Link>
            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              {t("footer.tagline")}
            </p>
          </div>
          <nav
            aria-label={t("footer.ariaLabel")}
            className="flex flex-wrap gap-x-6 gap-y-3"
          >
            {[
              { href: "/#how-it-works", label: t("footer.howItWorks") },
              { href: "/#features", label: nav("features") },
              { href: "/pricing", label: nav("pricing") },
              { href: "/about", label: nav("about") }
            ].map((link) => (
              <Link
                className="rounded-sm text-sm text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </>
  );
}
