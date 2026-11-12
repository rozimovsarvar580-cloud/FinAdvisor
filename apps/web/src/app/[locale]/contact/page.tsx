"use client";

import { useTranslations } from "next-intl";

import { SupportContactForm } from "@/components/support/support-contact-form";

export default function ContactPage() {
  const t = useTranslations("support");

  return (
    <main className="mx-auto max-w-3xl px-page py-section">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">{t("contactTitle")}</h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          {t("contactDescription")}
        </p>
      </header>
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-8">
        <SupportContactForm />
      </div>
    </main>
  );
}
