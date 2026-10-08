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

export default async function NewPlanPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!(locale in messages)) notFound();

  const home = messages[locale as keyof typeof messages].home;
  const t = await getTranslations({ locale, namespace: "routeCopy" });

  return (
    <main style={{ maxWidth: 640 }}>
      <h1>{home.title}</h1>
      <h2>{t("plans.newTitle")}</h2>
      <form style={{ display: "grid", gap: 12 }}>
        <label>
          {t("plans.name")}
          <input type="text" placeholder={t("plans.restaurantName")} style={{ width: "100%", padding: 10 }} />
        </label>
        <button type="submit" style={{ padding: "12px 16px" }}>{t("common.saveDraft")}</button>
      </form>
      <Link href={`/${locale}/plans`}>{t("common.backToPlans")}</Link>
    </main>
  );
}
