import { notFound } from "next/navigation";

import { CalculatorWorkspace } from "@/components/finadvisor/calculator-workspace";

const locales = ["uz", "ru", "en"] as const;
const calculatorTypes = [
  "startup-cost",
  "payroll",
  "tax",
  "loan",
  "profit"
] as const;

export function generateStaticParams() {
  return locales.flatMap((locale) =>
    calculatorTypes.map((type) => ({ locale, type }))
  );
}

export default async function CalculatorPage({
  params
}: {
  params: Promise<{ locale: string; type: string }>;
}) {
  const { locale, type } = await params;
  if (
    !locales.includes(locale as (typeof locales)[number]) ||
    !calculatorTypes.includes(type as (typeof calculatorTypes)[number])
  ) {
    notFound();
  }

  return (
    <CalculatorWorkspace
      calculatorType={type as (typeof calculatorTypes)[number]}
    />
  );
}
