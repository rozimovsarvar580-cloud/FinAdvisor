"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export function SamplePlanDownloadForm() {
  const t = useTranslations("landing.hero.samplePlan");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<"success" | "failure">();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || !consent) return;

    setIsSubmitting(true);
    setMessage(undefined);
    try {
      const response = await fetch("/api/lead-magnet/sample-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, consent, locale })
      });
      if (!response.ok) {
        setMessage("failure");
        return;
      }

      const pdf = await response.blob();
      const downloadUrl = URL.createObjectURL(pdf);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `finadvisor-sample-business-plan-${locale}.pdf`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
      setMessage("success");
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      setMessage("failure");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-4 border-t border-border pt-4" onSubmit={submit}>
      <label className="grid gap-2 text-sm font-medium" htmlFor="sample-plan-email">
        {t("emailLabel")}
        <input
          autoComplete="email"
          className="h-11 rounded-md border border-input bg-background px-3 font-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          id="sample-plan-email"
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
      {message ? (
        <p
          className={
            message === "success"
              ? "text-sm text-primary"
              : "text-sm text-destructive"
          }
          role={message === "failure" ? "alert" : "status"}
        >
          {t(message)}
        </p>
      ) : null}
      <Button
        disabled={!email.trim() || !consent}
        loading={isSubmitting}
        type="submit"
      >
        {t(isSubmitting ? "loading" : "download")}
      </Button>
    </form>
  );
}
