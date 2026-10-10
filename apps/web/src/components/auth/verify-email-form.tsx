"use client";

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
    </div>
  );
}
