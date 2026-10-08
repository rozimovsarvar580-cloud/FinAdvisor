"use client";

import { useTranslations } from "next-intl";

import { CommissionCalculator } from "@/components/pricing/commission-calculator";

export function BusinessPage() {
  const t = useTranslations("businessPage");

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
        </div>
      </section>

      <section className="py-section">
        <div className="mx-auto max-w-7xl px-page">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {t("commissionTitle")}
            </h2>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              {t("commissionDescription")}
            </p>
          </div>
          <CommissionCalculator />
        </div>
      </section>
    </main>
  );
}
