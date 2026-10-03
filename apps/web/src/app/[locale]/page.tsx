import { useTranslations } from "next-intl";

export default function HomePage() {
  const t = useTranslations("home");

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-5xl items-center px-page">
      <div className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
          FinAdvisor
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          {t("tagline")}
        </h1>
      </div>
    </main>
  );
}
