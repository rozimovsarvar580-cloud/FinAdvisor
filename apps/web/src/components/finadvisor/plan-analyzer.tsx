"use client";

import { useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const analysisSchema = z.object({
  readiness_score: z.number().int().min(0).max(100),
  missing_items: z.array(z.string()),
  extracted_text_length: z.number().int().nonnegative()
});

const acceptedFileTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
]);

export function PlanAnalyzer() {
  const t = useTranslations("finadvisor.analyzer");
  const errors = useTranslations("errors");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File>();
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [requestError, setRequestError] = useState<string>();
  const [result, setResult] = useState<z.infer<typeof analysisSchema>>();

  function acceptFile(candidate?: File) {
    setRequestError(undefined);
    setResult(undefined);
    if (!candidate) {
      setFile(undefined);
      return;
    }
    const supportedType =
      acceptedFileTypes.has(candidate.type) ||
      candidate.name.toLocaleLowerCase().endsWith(".pdf") ||
      candidate.name.toLocaleLowerCase().endsWith(".docx");
    if (!supportedType) {
      setFile(undefined);
      setRequestError("unsupportedPlanFile");
      return;
    }
    setFile(candidate);
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    acceptFile(event.target.files?.[0]);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    acceptFile(event.dataTransfer.files[0]);
  }

  async function analyzeDocument() {
    if (!file) {
      setRequestError("selectPlanFile");
      return;
    }
    setIsAnalyzing(true);
    setRequestError(undefined);
    setResult(undefined);
    try {
      const data = new FormData();
      data.set("file", file);
      const response = await fetch("/api/plans/analyze", {
        method: "POST",
        body: data
      });
      if (!response.ok) {
        setRequestError(
          response.status === 413 || response.status === 415
            ? "unsupportedPlanFile"
            : "analysisFailed"
        );
        return;
      }
      setResult(analysisSchema.parse(await response.json()));
    } catch (error) {
      setRequestError(
        error instanceof TypeError ? "analysisUnavailable" : "analysisFailed"
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <Card className="p-5 sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
        {t("eyebrow")}
      </p>
      <h2 className="mt-2 text-2xl font-semibold">{t("title")}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t("description")}</p>
      <div
        className={`mt-7 rounded-2xl border border-dashed p-8 text-center transition-colors ${
          isDragging ? "border-primary bg-primary/5" : "border-border bg-muted/30"
        }`}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
      >
        <input
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          id="plan-document"
          onChange={onFileChange}
          ref={fileInputRef}
          type="file"
        />
        <p className="font-medium">{t("dropPrompt")}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t("acceptedFiles")}</p>
        <Button
          className="mt-5"
          onClick={() => fileInputRef.current?.click()}
          type="button"
          variant="outline"
        >
          {t("chooseFile")}
        </Button>
        {file ? (
          <p className="mt-4 break-all text-sm text-muted-foreground">
            {file.name}
          </p>
        ) : null}
      </div>
      {requestError ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {errors(requestError)}
        </p>
      ) : null}
      <Button
        className="mt-5"
        disabled={!file || isAnalyzing}
        onClick={analyzeDocument}
        type="button"
      >
        {isAnalyzing ? t("analyzing") : t("analyze")}
      </Button>
      {result ? (
        <div aria-live="polite" className="mt-7 grid gap-6 md:grid-cols-[180px_1fr]">
          <div className="flex flex-col items-center gap-3">
            <div
              aria-label={t("score", { score: result.readiness_score })}
              className="grid h-36 w-36 place-items-center rounded-full"
              role="img"
              style={{
                background: `conic-gradient(hsl(var(--primary)) ${result.readiness_score}%, hsl(var(--muted)) 0)`
              }}
            >
              <div className="grid h-28 w-28 place-items-center rounded-full bg-card">
                <span className="text-3xl font-semibold">
                  {result.readiness_score}
                  <span className="text-base">/100</span>
                </span>
              </div>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              {t("readinessScore")}
            </p>
          </div>
          <div>
            <h3 className="font-semibold">{t("missingTitle")}</h3>
            {result.missing_items.length ? (
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                {result.missing_items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                {t("noMissingItems")}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
