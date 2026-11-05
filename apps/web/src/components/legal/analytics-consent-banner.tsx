"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const CONSENT_KEY = "finadvisor-analytics-consent";
const VISITOR_KEY = "finadvisor-visitor-id";

type ConsentChoice = "accepted" | "rejected";

function getVisitorId(): string {
  const existing = window.localStorage.getItem(VISITOR_KEY);
  if (existing) return existing;
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  const created = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  window.localStorage.setItem(VISITOR_KEY, created);
  return created;
}

export function AnalyticsConsentBanner() {
  const t = useTranslations("common.analyticsConsent");
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(CONSENT_KEY) === null);
    } catch {
      setOpen(true);
      setError(t("failed"));
    } finally {
      setReady(true);
    }
  }, [t]);

  const saveConsent = async (choice: ConsentChoice) => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/analytics/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitor_id: getVisitorId(),
          consent: choice === "accepted"
        })
      });
      if (!response.ok) throw new Error("consent_request_failed");
      window.localStorage.setItem(CONSENT_KEY, choice);
      setOpen(false);
    } catch {
      setError(t("failed"));
    } finally {
      setSaving(false);
    }
  };

  if (!ready) return null;

  return (
    <>
      {open ? (
        <section
          aria-labelledby="analytics-consent-title"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-3xl rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-xl sm:p-6"
          data-testid="analytics-consent-banner"
          role="region"
        >
          <h2 className="text-lg font-semibold" id="analytics-consent-title">
            {t("title")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t("description")}
          </p>
          {error ? (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={saving}
              onClick={() => void saveConsent("accepted")}
              type="button"
            >
              {saving ? t("saving") : t("accept")}
            </button>
            <button
              className="rounded-xl border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={saving}
              onClick={() => void saveConsent("rejected")}
              type="button"
            >
              {saving ? t("saving") : t("reject")}
            </button>
          </div>
        </section>
      ) : (
        <button
          className="fixed bottom-4 right-4 z-40 rounded-full border border-border bg-card px-4 py-2 text-sm text-card-foreground shadow-lg transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onClick={() => setOpen(true)}
          type="button"
        >
          {t("manage")}
        </button>
      )}
    </>
  );
}
