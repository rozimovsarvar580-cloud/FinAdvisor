"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";

const passwordSchema = z.object({
  password: z.string().min(8, "passwordTooShort").max(128, "passwordTooLong")
});

type RequestState = "idle" | "loading" | "success" | "error";

export default function ResetPasswordForm({ token }: { token?: string }) {
  const t = useTranslations("authFlows");
  const auth = useTranslations("auth");
  const errors = useTranslations("errors");
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [passwordError, setPasswordError] = useState<string>();
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestState("idle");
    setPasswordError(undefined);
    if (!token) {
      setRequestState("error");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const parsed = passwordSchema.safeParse({
      password: String(formData.get("password") ?? "")
    });
    if (!parsed.success) {
      setPasswordError(parsed.error.issues[0]?.message ?? "passwordTooShort");
      return;
    }

    setRequestState("loading");
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: parsed.data.password }),
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
        {t("resetTitle")}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("resetDescription")}
      </p>
      {!token ? (
        <p className="mt-6 text-sm text-red-600" role="alert">
          {t("missingToken")}
        </p>
      ) : null}
      <form className="mt-8 space-y-5" noValidate onSubmit={submit}>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="reset-password">
            {t("newPassword")}
          </label>
          <div className="relative">
            <Input
              aria-describedby={
                passwordError ? "reset-password-error" : undefined
              }
              aria-invalid={Boolean(passwordError)}
              autoComplete="new-password"
              className="pr-24"
              disabled={!token || requestState === "loading"}
              id="reset-password"
              name="password"
              type={showPassword ? "text" : "password"}
            />
            <Button
              aria-label={auth(showPassword ? "hidePassword" : "showPassword")}
              className="absolute right-1 top-1/2 -translate-y-1/2 px-2"
              disabled={!token || requestState === "loading"}
              onClick={() => setShowPassword((visible) => !visible)}
              size="sm"
              type="button"
              variant="ghost"
            >
              {auth(showPassword ? "hidePassword" : "showPassword")}
            </Button>
          </div>
          {passwordError ? (
            <p
              className="text-sm text-red-600"
              id="reset-password-error"
              role="alert"
            >
              {errors(passwordError)}
            </p>
          ) : null}
        </div>
        {requestState === "success" ? (
          <p className="text-sm text-muted-foreground" role="status">
            {t("resetSuccess")}
          </p>
        ) : null}
        {requestState === "error" && token ? (
          <p className="text-sm text-red-600" role="alert">
            {t("resetError")}
          </p>
        ) : null}
        <Button
          className="w-full"
          disabled={!token || requestState === "loading"}
          loading={requestState === "loading"}
          type="submit"
        >
          {requestState === "loading" ? t("saving") : t("resetSubmit")}
        </Button>
      </form>
      {requestState === "success" ? (
        <p className="mt-6 text-center text-sm">
          <Link
            className="font-medium text-primary hover:underline"
            href="/login"
          >
            {t("backToLogin")}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
