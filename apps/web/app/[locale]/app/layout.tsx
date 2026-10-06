import { notFound } from "next/navigation";
import AppShell from "./AppShell";

const locales = ["uz", "ru", "en"] as const;

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  return <AppShell locale={locale}>{children}</AppShell>;
}
