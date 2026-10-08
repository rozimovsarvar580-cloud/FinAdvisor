import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

const locales = ["uz", "ru", "en"] as const;

export default async function AppSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  const t = await getTranslations({ locale, namespace: "routeCopy" });
  return (
    <main>
      <h1>{t("appSettings.title")}</h1>
      <section className="card">
        <h2>{t("appSettings.activeSession")}</h2>
        <p>{t("appSettings.sessionProtected")}</p>
        <p>{t("appSettings.signOutHint")}</p>
        <Link href={`/${locale}/dashboard/settings`}>{t("appSettings.profileSettings")}</Link>
      </section>
    </main>
  );
}
