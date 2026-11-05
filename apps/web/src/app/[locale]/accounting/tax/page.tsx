import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { TaxRuleProvenanceList } from "@/components/accounting/tax-rule-provenance";

const locales = ["uz", "ru", "en"] as const;
export const dynamic = "force-dynamic";
const apiTaxRulesSchema = z.object({
  source_name: z.string(),
  rules: z.array(
    z.object({
      key: z.enum([
        "turnover_tax",
        "profit_tax",
        "employer_social_contribution"
      ]),
      rate: z.string().nullable(),
      source_url: z.string(),
      effective_date: z.string(),
      verified: z.boolean(),
      verified_by: z.string().nullable()
    })
  )
});
const displayedTaxRuleSchema = z.object({
  key: z.enum(["turnover_tax", "profit_tax"]),
  rate: z.string().nullable(),
  source_url: z.string().url(),
  effective_date: z.string(),
  verified: z.boolean(),
  verified_by: z.string().nullable()
});

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function TaxPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  const t = await getTranslations({ locale, namespace: "routeCopy" });
  const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
  const response = await fetch(`${apiUrl}/calc/tax-rules`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Tax rule service returned HTTP ${response.status}`);
  }
  const parsed = apiTaxRulesSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("Tax rule service returned an invalid response");
  }
  const displayedRules = parsed.data.rules.filter(
    (rule) => rule.key === "turnover_tax" || rule.key === "profit_tax"
  );
  const rules = displayedRules.map((rule) => {
    const displayedRule = displayedTaxRuleSchema.safeParse(rule);
    if (!displayedRule.success) {
      throw new Error("Tax rule service returned invalid tax provenance");
    }
    return displayedRule.data;
  });

  return (
    <main className="mx-auto max-w-4xl px-page py-section">
      <h1 className="text-3xl font-semibold">{t("accounting.taxTitle")}</h1>
      <p className="mt-3 text-muted-foreground">{t("accounting.taxRulesDescription")}</p>
      <TaxRuleProvenanceList sourceName={parsed.data.source_name} rules={rules} />
      <Link
        className="mt-6 inline-flex rounded-md text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        href={`/${locale}/accounting`}
      >
        {t("common.back")}
      </Link>
    </main>
  );
}
