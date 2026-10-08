"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";

export default function ResetPasswordForm() {
  const t = useTranslations("routeCopy");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email") }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.message ?? t("resetPassword.error"));
      return;
    }
    setMessage(t("resetPassword.sent"));
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
      <label>{t("common.email")}<input name="email" type="email" required autoComplete="email" /></label>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <button type="submit">{t("resetPassword.sendLink")}</button>
    </form>
  );
}
