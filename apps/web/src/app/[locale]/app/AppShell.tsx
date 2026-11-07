"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

const appNavigationLinkClassName =
  "block min-w-0 break-words rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export default function AppShell({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("routeCopy");

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = `/${locale}/login`;
  }

  return (
    <div className="app-shell flex min-h-screen flex-col gap-4 px-4 py-6 sm:px-6 lg:mx-auto lg:max-w-7xl lg:flex-row lg:gap-8">
      <button
        aria-controls="app-sidebar"
        aria-expanded={open}
        className="app-menu flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:hidden"
        data-testid="app-menu-toggle"
        id="app-menu-toggle"
        type="button"
        onClick={() => setOpen((current) => !current)}
      >
        {t("common.menu")}
      </button>
      <aside
        className={`app-sidebar w-full shrink-0 flex-col gap-4 rounded-xl border border-border bg-card p-4 lg:flex lg:w-56 lg:self-start ${
          open ? "flex" : "hidden"
        }`}
        id="app-sidebar"
      >
        <strong className="text-lg font-semibold">FinAdvisor</strong>
        <nav
          aria-label={t("common.applicationNavigation")}
          className="flex min-w-0 flex-col gap-1"
        >
          <Link
            className={appNavigationLinkClassName}
            href={`/${locale}/app`}
            onClick={() => setOpen(false)}
          >
            {t("common.overview")}
          </Link>
          <Link
            className={appNavigationLinkClassName}
            href={`/${locale}/plans`}
            onClick={() => setOpen(false)}
          >
            {t("common.plans")}
          </Link>
          <Link
            className={appNavigationLinkClassName}
            href={`/${locale}/calculators`}
            onClick={() => setOpen(false)}
          >
            {t("common.calculators")}
          </Link>
          <Link
            className={appNavigationLinkClassName}
            href={`/${locale}/app/reports`}
            onClick={() => setOpen(false)}
          >
            {t("common.reports")}
          </Link>
          <Link
            className={appNavigationLinkClassName}
            href={`/${locale}/app/billing`}
            onClick={() => setOpen(false)}
          >
            {t("common.billing")}
          </Link>
          <Link
            className={appNavigationLinkClassName}
            href={`/${locale}/app/settings`}
            onClick={() => setOpen(false)}
          >
            {t("common.settings")}
          </Link>
        </nav>
        <button
          className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          type="button"
          onClick={logout}
        >
          {t("common.signOut")}
        </button>
      </aside>
      <section className="app-content min-w-0 flex-1">{children}</section>
    </div>
  );
}
