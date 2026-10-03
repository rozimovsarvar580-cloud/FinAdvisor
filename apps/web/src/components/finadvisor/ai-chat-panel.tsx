"use client";

import { useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { type PlanCalculations } from "@/components/finadvisor/plan-wizard";

const chatEventSchema = z.object({ text: z.string() });
const chatErrorSchema = z.object({ detail: z.string() });

type ChatMessage = { role: "user" | "assistant"; content: string };

export function AIChatPanel({
  calculations
}: {
  calculations?: PlanCalculations;
}) {
  const t = useTranslations("finadvisor.chat");
  const errors = useTranslations("errors");
  const locale = useLocale();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [requestError, setRequestError] = useState<string>();
  const [isStreaming, setIsStreaming] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = draft.trim();
    if (!question || isStreaming) {
      return;
    }

    setDraft("");
    setRequestError(undefined);
    setIsStreaming(true);
    setMessages((current) => [
      ...current,
      { role: "user", content: question },
      { role: "assistant", content: "" }
    ]);
    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          message: question,
          plan_calculations: calculations ?? null
        })
      });
      if (!response.ok || !response.body) {
        setRequestError(response.status === 503 ? "chatAIUnavailable" : "chatFailed");
        setMessages((current) => current.slice(0, -1));
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let pendingEvent = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split(/\r?\n\r?\n/);
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          const dataLines = frame
            .split(/\r?\n/)
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim());
          const eventLine = frame.split(/\r?\n/).find((line) => line.startsWith("event:"));
          if (!dataLines.length) {
            continue;
          }
          const data = dataLines.join("\n");
          if (eventLine?.slice(6).trim() === "error") {
            const error = chatErrorSchema.safeParse(JSON.parse(data));
            setRequestError(
              error.success && error.data.detail === "chat.ai_unavailable"
                ? "chatAIUnavailable"
                : "chatFailed"
            );
            continue;
          }
          const parsed = chatEventSchema.safeParse(JSON.parse(data));
          if (!parsed.success) {
            setRequestError("chatFailed");
            continue;
          }
          pendingEvent += parsed.data.text;
          const nextText = pendingEvent;
          setMessages((current) => {
            const updated = [...current];
            const last = updated.at(-1);
            if (last?.role === "assistant") {
              updated[updated.length - 1] = {
                role: "assistant",
                content: nextText
              };
            }
            return updated;
          });
          transcriptRef.current?.scrollTo({
            top: transcriptRef.current.scrollHeight,
            behavior: "smooth"
          });
        }
      }
    } catch {
      setRequestError("chatFailed");
      setMessages((current) => {
        const updated = [...current];
        if (updated.at(-1)?.role === "assistant") {
          updated.pop();
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }

  function useQuickPrompt(prompt: string) {
    setDraft(prompt);
  }

  return (
    <Card className="flex min-h-[620px] flex-col p-5 sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
        {t("eyebrow")}
      </p>
      <h2 className="mt-2 text-2xl font-semibold">{t("title")}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {calculations ? t("planAttached") : t("noPlanAttached")}
      </p>
      <div
        aria-label={t("transcript")}
        className="mt-6 flex-1 space-y-4 overflow-y-auto rounded-xl bg-muted/50 p-4"
        ref={transcriptRef}
        role="log"
      >
        {!messages.length ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t("empty")}
          </p>
        ) : null}
        {messages.map((message, index) => (
          <div
            className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${
              message.role === "user"
                ? "ml-auto bg-primary text-primary-foreground"
                : "bg-card text-card-foreground"
            }`}
            key={`${message.role}-${index}`}
          >
            {message.content || (isStreaming && index === messages.length - 1 ? t("thinking") : "")}
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {(["breakEven", "loan", "missingInfo"] as const).map((promptKey) => (
          <Button
            key={promptKey}
            onClick={() => useQuickPrompt(t(`quickPrompts.${promptKey}`))}
            type="button"
            variant="outline"
          >
            {t(`quickPrompts.${promptKey}`)}
          </Button>
        ))}
      </div>
      {requestError ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {errors(requestError)}
        </p>
      ) : null}
      <form className="mt-4 flex gap-2" onSubmit={sendMessage}>
        <label className="sr-only" htmlFor="finadvisor-chat-input">
          {t("messageLabel")}
        </label>
        <Input
          autoComplete="off"
          id="finadvisor-chat-input"
          maxLength={4000}
          placeholder={t("placeholder")}
          required
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button disabled={isStreaming || !draft.trim()} type="submit">
          {isStreaming ? t("sending") : t("send")}
        </Button>
      </form>
    </Card>
  );
}
