import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import ResetPasswordForm from "./ResetPasswordForm";

import en from "@legacy-messages/en.json";
import ru from "@legacy-messages/ru.json";
import uz from "@legacy-messages/uz.json";

const messages = { uz, ru, en } as const;

export function generateStaticParams() {
  return Object.keys(messages).map((locale) => ({ locale }));
}

export default async function ResetPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!(locale in messages)) notFound();
  const copy = messages[locale as keyof typeof messages].home;
  const t = await getTranslations({ locale, namespace: "routeCopy" });
  return (
    <main style={{ maxWidth: 420 }}>
      <h1>{copy.title}</h1>
      <h2>{t("resetPassword.title")}</h2>
      <ResetPasswordForm />
      <p><Link href={`/${locale}/login`}>{t("common.backToLogin")}</Link></p>
    </main>
  );
}
