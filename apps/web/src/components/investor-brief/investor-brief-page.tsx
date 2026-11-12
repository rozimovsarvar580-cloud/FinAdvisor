"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export function InvestorBriefPage() {
  const t = useTranslations("investorBrief");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string>();
  const [result, setResult] = useState<"success" | "failure">();

  useEffect(() => {
    if (!pdfUrl) return;
    return () => URL.revokeObjectURL(pdfUrl);
  }, [pdfUrl]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || !consent) return;

    setIsSubmitting(true);
    setResult(undefined);
    try {
      const response = await fetch("/api/investor-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, consent, locale })
      });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/pdf")) {
        setResult("failure");
        return;
      }

      const url = URL.createObjectURL(await response.blob());
      setPdfUrl(url);
      setResult("success");
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      setResult("failure");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-page py-section">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
          {t("description")}
        </p>
      </header>

      <section
        aria-labelledby="investor-summary-title"
        className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-8"
      >
        <h2 className="text-xl font-semibold" id="investor-summary-title">
          {t("summaryTitle")}
        </h2>
        <dl className="mt-5 grid gap-5 md:grid-cols-3">
          {(["audience", "product", "model"] as const).map((item) => (
            <div className="space-y-2" key={item}>
              <dt className="font-semibold">{t(`${item}Title`)}</dt>
              <dd className="text-sm leading-6 text-muted-foreground">
                {t(`${item}Text`)}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        aria-labelledby="investor-pdf-title"
        className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-8"
      >
        <h2 className="text-xl font-semibold" id="investor-pdf-title">
          {t("pdfTitle")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t("pdfLanguage")}
        </p>
        <form className="mt-5 max-w-xl space-y-4" onSubmit={submit}>
          <label className="grid gap-2 text-sm font-medium" htmlFor="investor-brief-email">
            {t("emailLabel")}
            <input
              autoComplete="email"
              className="h-11 rounded-md border border-input bg-background px-3 font-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              id="investor-brief-email"
              maxLength={320}
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label className="flex items-start gap-3 text-sm text-muted-foreground">
            <input
              checked={consent}
              className="mt-1 size-4 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onChange={(event) => setConsent(event.target.checked)}
              required
              type="checkbox"
            />
            <span>
              {t("consent")}{" "}
              <Link
                className="rounded-sm text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                href="/privacy"
              >
                {t("privacyLink")}
              </Link>
            </span>
          </label>
          {result ? (
            <p
              className={
                result === "success"
                  ? "text-sm text-primary"
                  : "text-sm text-destructive"
              }
              role={result === "failure" ? "alert" : "status"}
            >
              {t(result)}
            </p>
          ) : null}
          <Button disabled={!email.trim() || !consent} loading={isSubmitting} type="submit">
            {t(isSubmitting ? "loading" : "submit")}
          </Button>
        </form>

        {pdfUrl ? (
          <div className="mt-6 space-y-4">
            <div className="flex flex-wrap gap-4">
              <a
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
                download="finadvisor-investor-brief.pdf"
                href={pdfUrl}
              >
                {t("download")}
              </a>
              <a
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-reduce:transition-none"
                href={pdfUrl}
                rel="noreferrer"
                target="_blank"
              >
                {t("open")}
              </a>
            </div>
            <iframe
              className="h-[75vh] min-h-96 w-full rounded-lg border border-border bg-background"
              src={pdfUrl}
              title={t("viewTitle")}
            />
          </div>
        ) : null}
      </section>
    </main>
  );
}
