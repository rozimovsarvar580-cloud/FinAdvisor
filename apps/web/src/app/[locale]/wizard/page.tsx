import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import en from "@legacy-messages/en.json";
import ru from "@legacy-messages/ru.json";
import uz from "@legacy-messages/uz.json";

const messages = { uz, ru, en } as const;

export function generateStaticParams() {
  return Object.keys(messages).map((locale) => ({ locale }));
}

export default async function WizardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!(locale in messages)) notFound();

  const home = messages[locale as keyof typeof messages].home;
  const t = await getTranslations({ locale, namespace: "routeCopy" });

  return (
    <main style={{ maxWidth: 720 }}>
      <h1>{home.title}</h1>
      <h2>{t("wizard.title")}</h2>
      <ol>
        <li>{t("wizard.profile")}</li>
        <li>{t("wizard.setupCosts")}</li>
        <li>{t("wizard.staffing")}</li>
        <li>{t("wizard.scenarioReview")}</li>
      </ol>
      <Link href={`/${locale}/wizard/steps`}>{t("wizard.start")}</Link>
    </main>
  );
}
