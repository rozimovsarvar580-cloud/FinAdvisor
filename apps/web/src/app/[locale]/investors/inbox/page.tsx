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

export default async function InboxPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!(locale in messages)) notFound();
  const t = await getTranslations({ locale, namespace: "routeCopy" });
  return <main><h1>{t("investors.inboxTitle")}</h1><p>{t("investors.fundingQuestions")} — {t("dashboard.unread")}</p><Link href={`/${locale}/investors`}>{t("common.back")}</Link></main>;
}
