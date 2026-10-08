"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";

export default function RegisterForm() {
  const t = useTranslations("routeCopy");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [verified, setVerified] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: form.get("full_name"),
        email: form.get("email"),
        password: form.get("password"),
      }),
    });
    const body = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(body.message ?? t("register.errors.registrationFailed"));
      return;
    }
    setMessage(t("register.verificationSent", { code: "123456" }));
    setVerificationEmail(String(form.get("email")));
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: verificationEmail, code: form.get("code") }),
    });
    const body = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(body.message ?? t("register.errors.verificationFailed"));
      return;
    }
    setVerified(true);
    setMessage(t("register.verificationSuccess"));
  }

  if (verificationEmail && !verified) {
    return (
      <form onSubmit={verify} style={{ display: "grid", gap: 12 }}>
        <p role="status">{message}</p>
        <label>{t("register.verificationCode")}<input name="code" inputMode="numeric" pattern="\d{6}" maxLength={6} required /></label>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={loading}>{loading ? t("common.verifying") : t("common.verifyEmail")}</button>
      </form>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
      <label>{t("common.fullName")}<input name="full_name" type="text" required minLength={2} autoComplete="name" /></label>
      <label>{t("common.email")}<input name="email" type="email" required autoComplete="email" /></label>
      <label>{t("common.password")}<input name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
      <small>{t("register.passwordHint")}</small>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <button type="submit" disabled={loading}>{loading ? t("common.creating") : t("common.register")}</button>
    </form>
  );
}
