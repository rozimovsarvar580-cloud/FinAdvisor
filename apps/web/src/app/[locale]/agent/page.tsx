import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

const locales = ["uz", "ru", "en"] as const;
export function generateStaticParams() { return locales.map((locale) => ({ locale })); }

export default async function AgentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  const t = await getTranslations({ locale, namespace: "routeCopy" });
  const deviceName = "Office PC";
  const queuedCommand = "sync_statement";
  return (
    <main>
      <h1>{t("agent.title")}</h1>
      <p>{t("agent.devices")}: {deviceName} — {t("agent.notConnected")}</p>
      <p>{t("agent.commandHistory")}: {queuedCommand} — {t("agent.queued")}</p>
      <Link href={`/${locale}/dashboard`}>{t("common.backToDashboard")}</Link>
    </main>
  );
}
