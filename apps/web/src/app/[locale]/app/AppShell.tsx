"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

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
    <div className="app-shell">
      <button className="app-menu" type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        {t("common.menu")}
      </button>
      <aside className={`app-sidebar${open ? " app-sidebar-open" : ""}`}>
        <strong>FinAdvisor</strong>
        <nav aria-label={t("common.applicationNavigation")}>
          <Link href={`/${locale}/app`} onClick={() => setOpen(false)}>{t("common.overview")}</Link>
          <Link href={`/${locale}/plans`} onClick={() => setOpen(false)}>{t("common.plans")}</Link>
          <Link href={`/${locale}/calculators`} onClick={() => setOpen(false)}>{t("common.calculators")}</Link>
          <Link href={`/${locale}/app/reports`} onClick={() => setOpen(false)}>{t("common.reports")}</Link>
          <Link href={`/${locale}/app/billing`} onClick={() => setOpen(false)}>{t("common.billing")}</Link>
          <Link href={`/${locale}/app/settings`} onClick={() => setOpen(false)}>{t("common.settings")}</Link>
        </nav>
        <button type="button" onClick={logout}>{t("common.signOut")}</button>
      </aside>
      <section className="app-content">{children}</section>
    </div>
  );
}
