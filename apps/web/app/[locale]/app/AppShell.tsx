"use client";

import Link from "next/link";
import { useState } from "react";

export default function AppShell({
  locale,
  children,
}: {
  locale: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = `/${locale}/login`;
  }

  return (
    <div className="app-shell">
      <button className="app-menu" type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        Menu
      </button>
      <aside className={`app-sidebar${open ? " app-sidebar-open" : ""}`}>
        <strong>FinAdvisor</strong>
        <nav aria-label="Application navigation">
          <Link href={`/${locale}/app`} onClick={() => setOpen(false)}>Overview</Link>
          <Link href={`/${locale}/plans`} onClick={() => setOpen(false)}>Plans</Link>
          <Link href={`/${locale}/calculators`} onClick={() => setOpen(false)}>Calculators</Link>
          <Link href={`/${locale}/app/reports`} onClick={() => setOpen(false)}>Reports</Link>
          <Link href={`/${locale}/app/billing`} onClick={() => setOpen(false)}>Billing</Link>
          <Link href={`/${locale}/app/settings`} onClick={() => setOpen(false)}>Settings</Link>
        </nav>
        <button type="button" onClick={logout}>Sign out</button>
      </aside>
      <section className="app-content">{children}</section>
    </div>
  );
}
