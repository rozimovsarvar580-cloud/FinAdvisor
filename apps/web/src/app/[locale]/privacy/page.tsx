import { notFound } from "next/navigation";

import { LegalDocument } from "@/components/legal/legal-document";

const locales = ["uz", "ru", "en"] as const;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function PrivacyPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  return <LegalDocument document="privacy" />;
}
