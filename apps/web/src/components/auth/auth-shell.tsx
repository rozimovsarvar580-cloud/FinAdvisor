import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Card } from "@/components/ui/card";

export function AuthShell({ children }: { children: ReactNode }) {
  const t = useTranslations("auth");

  return (
    <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-10 px-page py-10 lg:grid-cols-2 lg:py-16">
      <section className="mx-auto w-full max-w-md">
        {children}
      </section>
      <aside
        aria-label={t("artTitle")}
        className="relative hidden min-h-[36rem] overflow-hidden rounded-[2rem] bg-primary p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between"
      >
        <div className="absolute -right-20 -top-24 h-80 w-80 rounded-full bg-white/10" />
        <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-black/10" />
        <div className="relative">
          <p className="text-sm font-semibold uppercase tracking-[0.2em]">
            FinAdvisor
          </p>
          <h2 className="mt-6 max-w-sm text-4xl font-semibold leading-tight">
            {t("artTitle")}
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-6 text-primary-foreground/80">
            {t("artDescription")}
          </p>
        </div>
        <Card className="relative border-white/20 bg-white/95 p-6 text-foreground shadow-2xl dark:bg-card dark:text-card-foreground">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t("revenue")}</p>
              <p className="mt-2 text-2xl font-semibold">—</p>
            </div>
            <span
              aria-hidden="true"
              className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-semibold text-primary"
            >
              FinAdvisor
            </span>
          </div>
          <svg
            aria-hidden="true"
            className="mt-5 h-28 w-full text-primary"
            fill="none"
            preserveAspectRatio="none"
            viewBox="0 0 360 100"
          >
            <path
              d="M2 83C37 72 43 61 75 68s44-39 75-29 38 15 65-1 45-16 67-9 37-9 76-25"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="4"
            />
            <path
              d="M2 83C37 72 43 61 75 68s44-39 75-29 38 15 65-1 45-16 67-9 37-9 76-25V100H2Z"
              fill="currentColor"
              fillOpacity=".1"
            />
          </svg>
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">{t("profit")}</p>
            <span className="text-sm font-semibold text-primary">—</span>
          </div>
        </Card>
      </aside>
    </main>
  );
}
