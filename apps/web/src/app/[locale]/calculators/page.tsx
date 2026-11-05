import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Card } from "@/components/ui/card";

const locales = ["uz", "ru", "en"] as const;
const calculatorTypes = [
  "startup-cost",
  "payroll",
  "tax",
  "loan",
  "profit"
] as const;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function CalculatorsPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  const t = await getTranslations({ locale, namespace: "routeCopy.calculator" });

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:py-16">
      <header className="max-w-3xl">
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-3 text-muted-foreground">{t("description")}</p>
      </header>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {calculatorTypes.map((type) => (
          <Card className="h-full p-5 transition-colors hover:border-primary/60" key={type}>
            <Link
              className="block h-full rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              href={`/${locale}/calculators/${type}`}
            >
              <h2 className="text-lg font-semibold">
                {t(`labels.${type}`)}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t(`descriptions.${type}`)}
              </p>
            </Link>
          </Card>
        ))}
      </div>
    </main>
  );
}
