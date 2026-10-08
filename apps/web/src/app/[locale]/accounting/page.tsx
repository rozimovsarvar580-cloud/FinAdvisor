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

export default async function AccountingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!(locale in messages)) notFound();
  const home = messages[locale as keyof typeof messages].home;
  const t = await getTranslations({ locale, namespace: "routeCopy" });

  return (
    <main style={{ maxWidth: 840 }}>
      <h1>{home.title}</h1>
      <h2>{t("accounting.workspace")}</h2>
      <div style={{ display: "grid", gap: 12 }}>
        <Link href={`/${locale}/accounting/daily`}>{t("accounting.dailyTitle")}</Link>
        <Link href={`/${locale}/accounting/inventory`}>{t("accounting.inventoryTitle")}</Link>
        <Link href={`/${locale}/accounting/payroll`}>{t("accounting.payrollTitle")}</Link>
        <Link href={`/${locale}/accounting/tax`}>{t("accounting.taxTitle")}</Link>
        <Link href={`/${locale}/accounting/loans`}>{t("accounting.loansTitle")}</Link>
        <Link href={`/${locale}/accounting/import`}>{t("accounting.importTitle")}</Link>
      </div>
    </main>
  );
}
