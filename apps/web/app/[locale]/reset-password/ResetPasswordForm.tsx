"use client";

import { FormEvent, useState } from "react";

export default function ResetPasswordForm() {
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
      setError(body.message ?? "Unable to send reset link.");
      return;
    }
    setMessage(body.message);
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
      <label>Email<input name="email" type="email" required autoComplete="email" /></label>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <button type="submit">Send reset link</button>
    </form>
  );
}
