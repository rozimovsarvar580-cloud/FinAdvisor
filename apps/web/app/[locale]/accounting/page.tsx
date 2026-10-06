import Link from "next/link";
import { notFound } from "next/navigation";

import en from "../../../../../packages/i18n/messages/en.json";
import ru from "../../../../../packages/i18n/messages/ru.json";
import uz from "../../../../../packages/i18n/messages/uz.json";

const messages = { uz, ru, en } as const;

export function generateStaticParams() {
  return Object.keys(messages).map((locale) => ({ locale }));
}

export default async function AccountingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!(locale in messages)) notFound();
  const home = messages[locale as keyof typeof messages].home;

  return (
    <main style={{ maxWidth: 840 }}>
      <h1>{home.title}</h1>
      <h2>Accounting workspace</h2>
      <div style={{ display: "grid", gap: 12 }}>
        <Link href={`/${locale}/accounting/daily`}>Daily entries</Link>
        <Link href={`/${locale}/accounting/inventory`}>Inventory</Link>
        <Link href={`/${locale}/accounting/payroll`}>Payroll</Link>
        <Link href={`/${locale}/accounting/tax`}>Tax</Link>
        <Link href={`/${locale}/accounting/loans`}>Loans</Link>
        <Link href={`/${locale}/accounting/import`}>Import statement</Link>
      </div>
    </main>
  );
}
