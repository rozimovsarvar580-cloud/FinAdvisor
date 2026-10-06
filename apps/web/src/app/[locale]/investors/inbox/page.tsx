import Link from "next/link";
import { notFound } from "next/navigation";

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
  return <main><h1>Investor inbox</h1><p>Funding questions — unread</p><Link href={`/${locale}/investors`}>Back</Link></main>;
}
