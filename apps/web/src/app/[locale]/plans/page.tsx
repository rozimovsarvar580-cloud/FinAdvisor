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

export default async function PlansPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!(locale in messages)) notFound();

  const home = messages[locale as keyof typeof messages].home;
  const t = await getTranslations({ locale, namespace: "routeCopy" });
  const plans = [
    { id: "plan-001", name: "Samarqand Bistro", status: t("plans.draft") },
    { id: "plan-002", name: "Shahar Qosh", status: t("plans.review") }
  ];

  return (
    <main style={{ maxWidth: 960 }}>
      <h1>{home.title}</h1>
      <h2>{t("plans.title")}</h2>
      <ul>
        {plans.map((plan) => (
          <li key={plan.id}><Link href={`/${locale}/plans/${plan.id}`}>{plan.name}</Link> — {plan.status}</li>
        ))}
      </ul>
      <Link href={`/${locale}/plans/new`}>{t("common.createPlan")}</Link>
    </main>
  );
}
