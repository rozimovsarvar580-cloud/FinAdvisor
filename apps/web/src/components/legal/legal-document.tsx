"use client";

import { useTranslations } from "next-intl";

const sectionIds = {
  terms: ["service", "accounts", "acceptableUse", "availability", "changes"],
  privacy: ["data", "use", "sharing", "retention", "security", "rights"],
  refund: ["subscription", "request", "commission", "changes"],
  aiDisclaimer: ["estimates", "notAdvice", "review", "decisions"]
} as const;

type LegalDocumentId = keyof typeof sectionIds;

export function LegalDocument({ document }: { document: LegalDocumentId }) {
  const t = useTranslations(`legal.${document}`);

  return (
    <main className="mx-auto max-w-4xl px-page py-section">
      <header className="border-b border-border pb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          {t("draftLabel")}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-4 rounded-xl border border-accent/30 bg-accent/10 p-4 text-sm leading-6">
          {t("draftNotice")}
        </p>
        <p className="mt-5 text-base leading-7 text-muted-foreground">
          {t("introduction")}
        </p>
      </header>
      <div className="mt-8 space-y-8">
        {sectionIds[document].map((section) => (
          <section key={section}>
            <h2 className="text-xl font-semibold">{t(`sections.${section}.title`)}</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">
              {t(`sections.${section}.body`)}
            </p>
          </section>
        ))}
      </div>
    </main>
  );
}
