"use client";

import { useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const criterionKeySchema = z.enum([
  "market_analysis",
  "financial_projections",
  "repayment_ability",
  "risks",
  "collateral",
  "team",
  "legal"
]);

const analysisSchema = z.object({
  score: z.number().int().min(0).max(100),
  criteria: z.array(
    z.object({
      key: criterionKeySchema,
      score: z.number().int().min(0),
      max_score: z.number().int().positive(),
      present: z.boolean()
    })
  ),
  missing_criteria: z.array(criterionKeySchema),
  improvements: z.array(
    z.object({
      key: criterionKeySchema,
      fix: z.string(),
      rewritten_section: z.string()
    })
  ),
  word_count: z.number().int().nonnegative(),
  formula: z.string()
});

const acceptedFileTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain"
]);
const acceptedFileExtensions = [".pdf", ".docx", ".xlsx", ".txt"];

export function PlanAnalyzer() {
  const locale = useLocale();
  const t = useTranslations("finadvisor.analyzer");
  const errors = useTranslations("errors");
  const { data: session } = useSession();
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
      acceptedFileExtensions.some((extension) =>
        candidate.name.toLowerCase().endsWith(extension)
      );
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
      data.set("locale", locale);
      const response = await fetch("/api/plans/analyze", {
        method: "POST",
        headers: session?.accessToken
          ? { Authorization: `Bearer ${session.accessToken}` }
          : undefined,
        body: data
      });
      if (!response.ok) {
        const errorBody: unknown = await response.json();
        const detail =
          typeof errorBody === "object" &&
          errorBody !== null &&
          "detail" in errorBody &&
          typeof errorBody.detail === "string"
            ? errorBody.detail
            : undefined;
        setRequestError(
          detail === "analysis.unsupported_file_type"
            ? "unsupportedPlanFile"
            : response.status === 429
              ? "aiLimitReached"
              : response.status === 503
                ? "analysisUnavailable"
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
          accept=".pdf,.docx,.xlsx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain"
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
              aria-label={t("score", { score: result.score })}
              className="grid h-36 w-36 place-items-center rounded-full"
              role="img"
              style={{
                background: `conic-gradient(hsl(var(--primary)) ${result.score}%, hsl(var(--muted)) 0)`
              }}
            >
              <div className="grid h-28 w-28 place-items-center rounded-full bg-card">
                <span className="text-3xl font-semibold">
                  {result.score}
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
            {result.missing_criteria.length ? (
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                {result.missing_criteria.map((key) => (
                  <li key={key}>{t(`criteria.${key}`)}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                {t("noMissingItems")}
              </p>
            )}
            <h3 className="mt-6 font-semibold">{t("criteriaTitle")}</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {result.criteria.map((criterion) => (
                <li className="flex justify-between gap-4" key={criterion.key}>
                  <span>{t(`criteria.${criterion.key}`)}</span>
                  <span>
                    {criterion.score}/{criterion.max_score}
                  </span>
                </li>
              ))}
            </ul>
            {result.improvements.length ? (
              <div className="mt-6 space-y-5">
                <h3 className="font-semibold">{t("improvementsTitle")}</h3>
                {result.improvements.map((improvement) => (
                  <article
                    className="rounded-xl border border-border p-4"
                    key={improvement.key}
                  >
                    <h4 className="font-semibold">
                      {t(`criteria.${improvement.key}`)}
                    </h4>
                    <p className="mt-2 text-sm text-muted-foreground">
                      <strong>{t("fixLabel")}: </strong>
                      {improvement.fix}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      <strong>{t("rewriteLabel")}: </strong>
                      {improvement.rewritten_section}
                    </p>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
