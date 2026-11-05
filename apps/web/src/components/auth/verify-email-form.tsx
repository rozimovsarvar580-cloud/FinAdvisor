"use client";

<<<<<<< HEAD
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

type RequestState = "idle" | "loading" | "success" | "error";

export function VerifyEmailForm({ token }: { token?: string }) {
  const t = useTranslations("authFlows");
  const [requestState, setRequestState] = useState<RequestState>("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setRequestState("error");
      return;
    }

    setRequestState("loading");
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
        cache: "no-store"
      });
      setRequestState(response.ok ? "success" : "error");
    } catch (error) {
      if (error instanceof TypeError) {
        setRequestState("error");
        return;
      }
      throw error;
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">
        {t("verifyTitle")}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("verifyDescription")}
      </p>
      {!token ? (
        <p className="mt-6 text-sm text-red-600" role="alert">
          {t("missingToken")}
        </p>
      ) : null}
      {requestState === "success" ? (
        <p className="mt-6 text-sm text-muted-foreground" role="status">
          {t("verifySuccess")}
        </p>
      ) : null}
      {requestState === "error" && token ? (
        <p className="mt-6 text-sm text-red-600" role="alert">
          {t("verifyError")}
        </p>
      ) : null}
      <form className="mt-8" onSubmit={submit}>
        <Button
          className="w-full"
          disabled={!token || requestState === "loading"}
          loading={requestState === "loading"}
          type="submit"
        >
          {requestState === "loading" ? t("verifying") : t("verifySubmit")}
        </Button>
      </form>
      {requestState === "success" ? (
        <p className="mt-6 text-center text-sm">
          <Link className="font-medium text-primary hover:underline" href="/login">
            {t("backToLogin")}
          </Link>
        </p>
      ) : null}
=======
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

type VerificationStatus = "verifying" | "success" | "error";

export function VerifyEmailForm({ token }: { token: string }) {
  const t = useTranslations("routeCopy.verifyEmail");
  const [status, setStatus] = useState<VerificationStatus>(
    token ? "verifying" : "error"
  );

  useEffect(() => {
    if (!token) {
      return;
    }
    let active = true;
    async function verifyEmail() {
      try {
        const response = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token })
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
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
    </div>
  );
}
