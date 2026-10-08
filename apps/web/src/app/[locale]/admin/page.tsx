import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

const locales = ["uz", "ru", "en"] as const;
export function generateStaticParams() { return locales.map((locale) => ({ locale })); }

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  const t = await getTranslations({ locale, namespace: "routeCopy" });
  return (
    <main>
      <h1>{t("admin.title")}</h1>
      <ul><li>{t("admin.users")}</li><li>{t("admin.planModeration")}</li><li>{t("admin.kycReview")}</li><li>{t("admin.auditLog")}</li><li>{t("admin.featureFlags")}</li></ul>
      <Link href={`/${locale}/dashboard`}>{t("common.backToDashboard")}</Link>
    </main>
  );
}
