import Link from "next/link";
import { notFound } from "next/navigation";
import RegisterForm from "./RegisterForm";

import en from "../../../../../packages/i18n/messages/en.json";
import ru from "../../../../../packages/i18n/messages/ru.json";
import uz from "../../../../../packages/i18n/messages/uz.json";

const messages = { uz, ru, en } as const;

export function generateStaticParams() {
  return Object.keys(messages).map((locale) => ({ locale }));
}

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!(locale in messages)) notFound();
  const copy = messages[locale as keyof typeof messages].home;
  return (
    <main style={{ maxWidth: 460 }}>
      <h1>{copy.title}</h1>
      <h2>Create account</h2>
      <RegisterForm />
      <p>Already have an account? <Link href={`/${locale}/login`}>Sign in</Link></p>
    </main>
  );
}
