import Link from "next/link";
import { notFound } from "next/navigation";

import en from "@legacy-messages/en.json";
import ru from "@legacy-messages/ru.json";
import uz from "@legacy-messages/uz.json";

const messages = { uz, ru, en } as const;

export function generateStaticParams() {
  return Object.keys(messages).map((locale) => ({ locale, planId: "plan-001" }));
}

export default async function AnalysisPage({
  params,
}: {
  params: Promise<{ locale: string; planId: string }>;
}) {
  const { locale, planId } = await params;
  if (!(locale in messages)) notFound();
  const home = messages[locale as keyof typeof messages].home;

  return (
    <main style={{ maxWidth: 720 }}>
      <h1>{home.title}</h1>
      <h2>Plan analysis: {planId}</h2>
      <p>Bank-readiness score: 72/100</p>
      <h3>Strengths</h3>
      <ul><li>Positive operating profit</li><li>Scenario data is present</li></ul>
      <h3>Risks</h3>
      <ul><li>Cash reserve should cover at least three months</li></ul>
      <p>This explanation uses finance-engine results; the AI does not calculate financial values.</p>
      <Link href={`/${locale}/plans/${planId}`}>Back to plan</Link>
    </main>
  );
}
