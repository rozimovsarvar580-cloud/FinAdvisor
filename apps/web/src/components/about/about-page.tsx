"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";

const pathSteps = ["01", "02", "03", "04"];
const audiences = ["owner", "accountant", "investor"] as const;
const comparisons = ["calculations", "localRules", "explanations", "documents"] as const;
const values = ["accuracy", "transparency", "empowerment"] as const;

function AboutReveal({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 20 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      viewport={{ once: true, amount: 0.12 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
    >
      {children}
    </motion.div>
  );
}

export function AboutPage() {
  const t = useTranslations("landing.about");

  return (
    <main>
      <section className="relative isolate overflow-hidden bg-muted/40">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/.12),transparent_55%)]"
        />
        <div className="mx-auto max-w-7xl px-page py-24 text-center sm:py-32">
          <AboutReveal className="mx-auto max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              {t("hero.eyebrow")}
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">
              {t("hero.title")}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              {t("hero.description")}
            </p>
            <Button asChild className="mt-8" size="lg">
              <Link href="/signup">
                {t("hero.cta")}
                <span aria-hidden="true">→</span>
              </Link>
            </Button>
          </AboutReveal>
        </div>
      </section>

      <section className="py-section">
        <AboutReveal className="mx-auto max-w-4xl px-page text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            {t("mission.eyebrow")}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("mission.title")}
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-7 text-muted-foreground">
            {t("mission.description")}
          </p>
        </AboutReveal>
      </section>

      <section className="py-section">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-page lg:grid-cols-2">
          <AboutReveal>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              {t("story.eyebrow")}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("story.title")}
            </h2>
            <div className="mt-6 space-y-4 text-base leading-7 text-muted-foreground">
              <p>{t("story.paragraph1")}</p>
              <p>{t("story.paragraph2")}</p>
              <p>{t("story.paragraph3")}</p>
            </div>
          </AboutReveal>
          <AboutReveal>
            <Card className="overflow-hidden rounded-3xl p-7 sm:p-9">
              <div className="flex items-center justify-between border-b border-border pb-5">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("story.exampleLabel")}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold">
                    {t("story.exampleTitle")}
                  </h3>
                </div>
                <span
                  aria-hidden="true"
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-2xl text-primary"
                >
                  ◈
                </span>
              </div>
              <ul className="mt-5 space-y-4">
                {(["costs", "team", "demand"] as const).map((item) => (
                  <li className="flex gap-3" key={item}>
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs text-primary"
                    >
                      ✓
                    </span>
                    <div>
                      <p className="text-sm font-semibold">
                        {t(`story.example.${item}.title`)}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {t(`story.example.${item}.description`)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </AboutReveal>
        </div>
      </section>

      <section className="bg-muted/40 py-section">
        <div className="mx-auto max-w-7xl px-page">
          <AboutReveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              {t("approach.eyebrow")}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("approach.title")}
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              {t("approach.description")}
            </p>
          </AboutReveal>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {pathSteps.map((step, index) => (
              <AboutReveal key={step}>
                <Card className="h-full p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                    {step}
                  </span>
                  <h3 className="mt-5 font-semibold">
                    {t(`approach.steps.${index}.title`)}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {t(`approach.steps.${index}.description`)}
                  </p>
                </Card>
              </AboutReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-muted/40 py-section">
        <div className="mx-auto max-w-7xl px-page">
          <AboutReveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              {t("values.eyebrow")}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("values.title")}
            </h2>
          </AboutReveal>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {values.map((value) => (
              <AboutReveal key={value}>
                <Card className="h-full p-6">
                  <h3 className="text-lg font-semibold">
                    {t(`values.items.${value}.title`)}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    {t(`values.items.${value}.description`)}
                  </p>
                </Card>
              </AboutReveal>
            ))}
          </div>
        </div>
      </section>

      <section className="py-section">
        <div className="mx-auto max-w-5xl px-page">
          <AboutReveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              {t("audience.eyebrow")}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("audience.title")}
            </h2>
          </AboutReveal>
          <Tabs className="mt-10" defaultValue="owner">
            <TabsList
              aria-label={t("audience.tabsLabel")}
              className="mx-auto grid h-auto max-w-2xl grid-cols-3 rounded-xl bg-muted p-1"
            >
              {audiences.map((audience) => (
                <TabsTrigger
                  className="rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground transition-colors data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                  key={audience}
                  value={audience}
                >
                  {t(`audience.roles.${audience}.label`)}
                </TabsTrigger>
              ))}
            </TabsList>
            {audiences.map((audience) => (
              <TabsContent
                className="mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                key={audience}
                value={audience}
              >
                <Card className="p-7 sm:p-9">
                  <h3 className="text-xl font-semibold">
                    {t(`audience.roles.${audience}.title`)}
                  </h3>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
                    {t(`audience.roles.${audience}.description`)}
                  </p>
                </Card>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </section>

      <section className="bg-muted/40 py-section">
        <div className="mx-auto max-w-7xl px-page">
          <AboutReveal className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              {t("comparison.eyebrow")}
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("comparison.title")}
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              {t("comparison.description")}
            </p>
          </AboutReveal>
          <AboutReveal className="mt-10 overflow-hidden rounded-2xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("comparison.headers.criteria")}</TableHead>
                  <TableHead>{t("comparison.headers.finadvisor")}</TableHead>
                  <TableHead>{t("comparison.headers.generalAi")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparisons.map((criterion) => (
                  <TableRow key={criterion}>
                    <TableCell className="font-medium">
                      {t(`comparison.rows.${criterion}.label`)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t(`comparison.rows.${criterion}.finadvisor`)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {t(`comparison.rows.${criterion}.generalAi`)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </AboutReveal>
        </div>
      </section>

      <section className="py-section">
        <div className="mx-auto max-w-4xl px-page">
          <AboutReveal>
            <Card className="border-primary/25 bg-primary/5 p-7 sm:p-10">
              <div className="flex items-start gap-4">
                <span
                  aria-hidden="true"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-xl text-primary"
                >
                  !
                </span>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                    {t("trust.eyebrow")}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                    {t("trust.title")}
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-muted-foreground">
                    {t("trust.description")}
                  </p>
                  <p className="mt-4 text-sm font-semibold leading-6">
                    {t("trust.warning")}
                  </p>
                </div>
              </div>
            </Card>
          </AboutReveal>
        </div>
      </section>

      <section className="px-page pb-section">
        <AboutReveal className="mx-auto max-w-7xl rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground sm:px-12 sm:py-20">
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("cta.title")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-primary-foreground/80">
            {t("cta.description")}
          </p>
          <Button
            asChild
            className="mt-8 bg-white text-primary hover:bg-white/90"
            size="lg"
          >
            <Link href="/signup">{t("cta.button")}</Link>
          </Button>
        </AboutReveal>
      </section>
    </main>
  );
}
