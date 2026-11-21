"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const CONSENT_KEY = "finadvisor-analytics-consent";
const VISITOR_KEY = "finadvisor-visitor-id";
const PENDING_KEY = "finadvisor-analytics-consent-pending";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

type ConsentChoice = "accepted" | "rejected";

function getCookie(name: string): string | null {
  const prefix = `${name}=`;
  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

function setCookie(name: string, value: string): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

function removeCookie(name: string): void {
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function getVisitorId(): string {
  const existing = getCookie(VISITOR_KEY);
  if (existing) return existing;
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  const created = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  setCookie(VISITOR_KEY, created);
  return created;
}

async function syncPendingConsent(): Promise<void> {
  const choice = getCookie(PENDING_KEY);
  if (choice !== "accepted" && choice !== "rejected") return;

  const response = await fetch("/api/analytics/consent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      visitor_id: getVisitorId(),
      consent: choice === "accepted"
    })
  });
  if (response.ok) removeCookie(PENDING_KEY);
}

export function AnalyticsConsentBanner() {
  const t = useTranslations("common.analyticsConsent");
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let hasChoice = getCookie(CONSENT_KEY) !== null;
    try {
      if (!hasChoice) {
        const previousChoice = window.localStorage.getItem(CONSENT_KEY);
        if (previousChoice === "accepted" || previousChoice === "rejected") {
          setCookie(CONSENT_KEY, previousChoice);
          hasChoice = true;
        }
      }
      if (!getCookie(VISITOR_KEY)) {
        const previousVisitorId = window.localStorage.getItem(VISITOR_KEY);
        if (previousVisitorId) setCookie(VISITOR_KEY, previousVisitorId);
      }
    } catch (error) {
      if (!(error instanceof DOMException)) throw error;
    }
    setOpen(!hasChoice);
    setReady(true);

    const handleOnline = () => {
      void syncPendingConsent().catch((error: unknown) => {
        if (!(error instanceof TypeError)) throw error;
      });
    };
    if (getCookie(PENDING_KEY)) handleOnline();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  const saveConsent = async (choice: ConsentChoice) => {
    setSaving(true);
    setCookie(CONSENT_KEY, choice);
    setCookie(PENDING_KEY, choice);
    setOpen(false);
    try {
      await syncPendingConsent();
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
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
          className="mx-4 mb-4 mt-4 max-w-3xl rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-xl sm:mx-auto sm:p-6"
          data-testid="analytics-consent-banner"
          role="region"
        >
          <h2 className="text-lg font-semibold" id="analytics-consent-title">
            {t("title")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t("description")}
          </p>
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
          className="mb-4 ml-auto mr-4 mt-4 block rounded-full border border-border bg-card px-4 py-2 text-sm text-card-foreground shadow-lg transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onClick={() => setOpen(true)}
          type="button"
        >
          {t("manage")}
        </button>
      )}
    </>
  );
}
