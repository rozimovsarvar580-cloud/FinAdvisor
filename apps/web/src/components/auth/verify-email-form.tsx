"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

type VerificationStatus = "verifying" | "success" | "error";

export function VerifyEmailForm({ token }: { token?: string }) {
  const t = useTranslations("routeCopy.verifyEmail");
  const [status, setStatus] = useState<VerificationStatus>(
    token ? "verifying" : "error"
  );

  useEffect(() => {
    if (!token) {
      return;
    }
    const verificationToken = token;
    let active = true;
    async function verifyEmail() {
      try {
        const response = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: verificationToken })
        });
        if (active) {
          setStatus(response.ok ? "success" : "error");
        }
      } catch (error) {
        if (error instanceof TypeError) {
          if (active) setStatus("error");
          return;
        }
        throw error;
      }
    }
    void verifyEmail();
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
      {status === "verifying" ? (
        <p className="mt-3 text-sm text-muted-foreground" role="status">
          {t("verifying")}
        </p>
      ) : null}
      {status === "success" ? (
        <p className="mt-3 text-sm text-muted-foreground" role="status">
          {t("success")}
        </p>
      ) : null}
      {status === "error" ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {t(token ? "error" : "missingToken")}
        </p>
      ) : null}
      <p className="mt-6 text-sm">
        <Link
          className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href="/login"
        >
          {t("backToLogin")}
        </Link>
      </p>
    </div>
  );
}
