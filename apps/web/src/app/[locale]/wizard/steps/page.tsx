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

export default async function WizardStepsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!(locale in messages)) notFound();

  const home = messages[locale as keyof typeof messages].home;
  const t = await getTranslations({ locale, namespace: "routeCopy" });

  return (
    <main style={{ maxWidth: 720 }}>
      <h1>{home.title}</h1>
      <h2>{t("wizard.stepsTitle")}</h2>
      <ol>
        <li>{t("wizard.profile")} — {t("dashboard.done")}</li>
        <li>{t("wizard.setupCosts")} — {t("dashboard.inProgress")}</li>
        <li>{t("wizard.staffing")} — {t("dashboard.pending")}</li>
        <li>{t("wizard.scenarioReview")} — {t("dashboard.pending")}</li>
      </ol>
      <Link href={`/${locale}/wizard`}>{t("common.backToWizard")}</Link>
    </main>
  );
}
