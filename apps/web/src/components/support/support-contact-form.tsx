"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

type SupportCategory = "general" | "technical" | "billing" | "feedback";

export function SupportContactForm({
  fixedCategory,
  initialName = "",
  initialEmail = "",
  onSuccess
}: {
  fixedCategory?: SupportCategory;
  initialName?: string;
  initialEmail?: string;
  onSuccess?: () => void;
}) {
  const t = useTranslations("support");
  const locale = useLocale();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [category, setCategory] = useState<SupportCategory>(
    fixedCategory ?? "general"
  );
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<"success" | "failure">();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || !consent) return;

    setIsSubmitting(true);
    setResult(undefined);
    try {
      const response = await fetch("/api/support/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          category: fixedCategory ?? category,
          message,
          consent,
          locale
        })
      });
      if (!response.ok) {
        setResult("failure");
        return;
      }
      setResult("success");
      setMessage("");
      setConsent(false);
      onSuccess?.();
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      setResult("failure");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <label className="grid gap-2 text-sm font-medium" htmlFor="support-name">
        {t("nameLabel")}
        <input
          autoComplete="name"
          className="h-11 rounded-md border border-input bg-background px-3 font-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          id="support-name"
          maxLength={200}
          onChange={(event) => setName(event.target.value)}
          required
          value={name}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium" htmlFor="support-email">
        {t("emailLabel")}
        <input
          autoComplete="email"
          className="h-11 rounded-md border border-input bg-background px-3 font-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          id="support-email"
          maxLength={320}
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </label>
      {!fixedCategory ? (
        <label className="grid gap-2 text-sm font-medium" htmlFor="support-category">
          {t("categoryLabel")}
          <select
            className="h-11 rounded-md border border-input bg-background px-3 font-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            id="support-category"
            onChange={(event) => setCategory(event.target.value as SupportCategory)}
            value={category}
          >
            {(["general", "technical", "billing", "feedback"] as const).map(
              (option) => (
                <option key={option} value={option}>
                  {t(`categories.${option}`)}
                </option>
              )
            )}
          </select>
        </label>
      ) : null}
      <label className="grid gap-2 text-sm font-medium" htmlFor="support-message">
        {t("messageLabel")}
        <textarea
          className="min-h-32 rounded-md border border-input bg-background px-3 py-2 font-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          id="support-message"
          maxLength={4000}
          minLength={10}
          onChange={(event) => setMessage(event.target.value)}
          required
          value={message}
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
      <Button
        disabled={
          !name.trim() || !email.trim() || message.trim().length < 10 || !consent
        }
        loading={isSubmitting}
        type="submit"
      >
        {t(isSubmitting ? "sending" : "submit")}
      </Button>
    </form>
  );
}
