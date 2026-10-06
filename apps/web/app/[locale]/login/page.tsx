import Link from "next/link";
import { notFound } from "next/navigation";

import en from "../../../../../packages/i18n/messages/en.json";
import ru from "../../../../../packages/i18n/messages/ru.json";
import uz from "../../../../../packages/i18n/messages/uz.json";
import LoginForm from "./LoginForm";

const messages = { uz, ru, en } as const;

export function generateStaticParams() {
  return Object.keys(messages).map((locale) => ({ locale }));
}

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!(locale in messages)) notFound();

  const copy = messages[locale as keyof typeof messages].home;

  return (
    <main style={{ maxWidth: 420 }}>
      <h1>{copy.title}</h1>
      <h2>Login</h2>
      <LoginForm locale={locale} />
      <p>
        No account? <Link href={`/${locale}/register`}>Create one</Link>
      </p>
      <p>
        <Link href={`/${locale}/reset-password`}>Forgot password?</Link>
      </p>
    </main>
  );
}
