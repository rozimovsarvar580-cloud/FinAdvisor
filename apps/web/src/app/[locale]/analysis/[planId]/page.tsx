import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import en from "@legacy-messages/en.json";
import ru from "@legacy-messages/ru.json";
import uz from "@legacy-messages/uz.json";

const messages = { uz, ru, en } as const;

export function generateStaticParams() {
  return Object.keys(messages).map((locale) => ({ locale, planId: "plan-001" }));
}

export default async function AnalysisPage({
  params,
}: {
  params: Promise<{ locale: string; planId: string }>;
}) {
  const { locale, planId } = await params;
  if (!(locale in messages)) notFound();
  const home = messages[locale as keyof typeof messages].home;
  const t = await getTranslations({ locale, namespace: "routeCopy" });

  return (
    <main style={{ maxWidth: 720 }}>
      <h1>{home.title}</h1>
      <h2>{t("analysis.title", { planId })}</h2>
      <p>{t("analysis.score", { score: 72 })}</p>
      <h3>{t("analysis.strengths")}</h3>
      <ul><li>{t("analysis.positiveProfit")}</li><li>{t("analysis.scenarioData")}</li></ul>
      <h3>{t("analysis.risks")}</h3>
      <ul><li>{t("analysis.cashReserve")}</li></ul>
      <p>{t("analysis.aiDisclaimer")}</p>
      <Link href={`/${locale}/plans/${planId}`}>{t("common.backToPlan")}</Link>
    </main>
  );
}
