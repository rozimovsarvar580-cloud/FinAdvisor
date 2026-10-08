"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export default function AiExplanation({ planId, result }: { planId: string; result: Record<string, string> }) {
  const t = useTranslations("routeCopy");
  const [question, setQuestion] = useState(t("plans.questionPlaceholder"));
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");

  async function ask() {
    setError("");
    const response = await fetch(`${apiUrl}/api/v1/analysis/${planId}/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, result }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.message ?? t("plans.errors.explanationUnavailable"));
      return;
    }
    setAnswer(body.answer);
  }

  return (
    <section className="card" style={{ marginTop: 24 }}>
      <h2>{t("plans.askAboutResult")}</h2>
      <p>{t("plans.assistantDescription")}</p>
      <textarea value={question} onChange={(event) => setQuestion(event.target.value)} rows={3} />
      <button type="button" onClick={ask}>{t("plans.explain")}</button>
      {answer && <p role="status">{answer}</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
