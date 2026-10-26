"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  DocumentExportError,
  requestPlanDocument,
  type DocumentFormat
} from "@/lib/documents";

import {
  planResultSchema,
  type PlanResult
} from "@/components/finadvisor/plan-wizard";

const calculationKeys = [
  "monthly_revenue",
  "monthly_payroll",
  "startup_capex",
  "total_startup_cost",
  "monthly_fixed_costs",
  "monthly_variable_cost",
  "monthly_operating_profit",
  "annual_operating_profit",
  "break_even_revenue",
  "target_monthly_revenue",
  "loan_first_payment",
  "loan_total_payment",
  "loan_total_interest",
  "annual_debt_service",
  "dscr"
] as const;

const planVersionHistorySchema = z.object({
  current_version: z.number().int().positive(),
  versions: z.array(
    z.object({
      version: z.number().int().positive(),
      created_at: z.string(),
      summary: z.string(),
      sections: z.array(z.object({ title: z.string(), content: z.string() })),
      markdown: z.string()
    })
  ),
  share_enabled: z.boolean()
});
const planShareSchema = z.object({ token: z.string().min(40).max(50) });

const documentFormats: { format: DocumentFormat; label: string }[] = [
  { format: "pdf", label: "exportPdf" },
  { format: "excel", label: "exportExcel" },
  { format: "bank-pack", label: "exportBankPack" },
  { format: "synergy", label: "exportSynergy" }
];

export function ReportsPanel({
  planResult,
  onPlanUpdated
}: {
  planResult?: PlanResult;
  onPlanUpdated: (result: PlanResult) => void;
}) {
  const t = useTranslations("finadvisor.reports");
  const errors = useTranslations("errors");
  const locale = useLocale();
  const { data: session } = useSession();
  const [exporting, setExporting] = useState<DocumentFormat>();
  const [exportError, setExportError] = useState<string>();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const [saveNotice, setSaveNotice] = useState<string>();
  const [history, setHistory] = useState<z.infer<typeof planVersionHistorySchema>>();
  const [historyError, setHistoryError] = useState<string>();
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [planActionError, setPlanActionError] = useState<string>();
  const [planActionNotice, setPlanActionNotice] = useState<string>();
  const [isPlanActionPending, setIsPlanActionPending] = useState(false);
  const [isCopyingShareLink, setIsCopyingShareLink] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>();
  const [shareEnabled, setShareEnabled] = useState(false);
  const [summary, setSummary] = useState(planResult?.summary ?? "");
  const [sections, setSections] = useState(planResult?.sections ?? []);

  useEffect(() => {
    const activePlan = planResult;
    const accessToken = session?.accessToken;
    if (!activePlan || !accessToken) {
      return;
    }
    const planId = activePlan.plan_id;
    let active = true;
    setSummary(activePlan.summary);
    setSections(activePlan.sections);
    setIsEditing(false);
    setHistory(undefined);
    setHistoryError(undefined);
    setShareUrl(undefined);
    setShareEnabled(false);
    setIsLoadingHistory(true);

    async function loadHistory() {
      try {
        const response = await fetch(
          `/api/plans/${encodeURIComponent(planId)}/versions`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            cache: "no-store"
          }
        );
        if (!response.ok) {
          if (active) {
            setHistoryError(
              response.status === 503
                ? "planServiceUnavailable"
                : "planHistoryFailed"
            );
          }
          return;
        }
        const parsed = planVersionHistorySchema.parse(await response.json());
        if (active) {
          setHistory(parsed);
          setShareEnabled(parsed.share_enabled);
        }
      } catch (error) {
        if (!active) {
          return;
        }
        if (error instanceof TypeError) {
          setHistoryError("planServiceUnavailable");
        } else if (error instanceof SyntaxError || error instanceof z.ZodError) {
          setHistoryError("planHistoryFailed");
        } else {
          throw error;
        }
      } finally {
        if (active) {
          setIsLoadingHistory(false);
        }
      }
    }

    void loadHistory();
    return () => {
      active = false;
    };
  }, [planResult, session?.accessToken]);

  async function exportDocument(plan: PlanResult, format: DocumentFormat) {
    setExportError(undefined);
    if (!session?.accessToken) {
      setExportError("planSessionRequired");
      return;
    }
    setExporting(format);
    try {
      const {
        plan_id: planId,
        summary,
        sections,
        markdown,
        calculations,
        assumptions
      } = plan;
      const file = await requestPlanDocument(
        planId,
        format,
        locale,
        { summary, sections, markdown, calculations, assumptions },
        session.accessToken
      );
      const fileUrl = URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(fileUrl);
    } catch (error) {
      if (error instanceof DocumentExportError) {
        const errorKeys: Record<DocumentExportError["kind"], string> = {
          failed: "documentExportFailed",
          unavailable: "documentExportUnavailable",
          "upgrade-required": "documentExportUpgradeRequired",
          "business-required": "documentExportBusinessRequired"
        };
        setExportError(errorKeys[error.kind]);
      } else {
        throw error;
      }
    } finally {
      setExporting(undefined);
    }
  }

  async function restoreVersion(version: number) {
    if (!planResult || !session?.accessToken) {
      setPlanActionError("planSessionRequired");
      return;
    }
    setPlanActionError(undefined);
    setPlanActionNotice(undefined);
    setIsPlanActionPending(true);
    try {
      const response = await fetch(
        `/api/plans/${encodeURIComponent(planResult.plan_id)}/restore/${version}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.accessToken}` }
        }
      );
      if (!response.ok) {
        setPlanActionError(
          response.status === 404 ? "planVersionNotFound" : "planHistoryActionFailed"
        );
        return;
      }
      const restored = planResultSchema.parse(await response.json());
      onPlanUpdated(restored);
      setPlanActionNotice(t("restoredVersion", { version }));
    } catch (error) {
      if (error instanceof TypeError) {
        setPlanActionError("planServiceUnavailable");
      } else if (error instanceof SyntaxError || error instanceof z.ZodError) {
        setPlanActionError("planHistoryActionFailed");
      } else {
        throw error;
      }
    } finally {
      setIsPlanActionPending(false);
    }
  }

  async function duplicatePlan() {
    if (!planResult || !session?.accessToken) {
      setPlanActionError("planSessionRequired");
      return;
    }
    setPlanActionError(undefined);
    setPlanActionNotice(undefined);
    setIsPlanActionPending(true);
    try {
      const response = await fetch(
        `/api/plans/${encodeURIComponent(planResult.plan_id)}/duplicate`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.accessToken}` }
        }
      );
      if (!response.ok) {
        setPlanActionError("planHistoryActionFailed");
        return;
      }
      const duplicate = planResultSchema.parse(await response.json());
      onPlanUpdated(duplicate);
      setPlanActionNotice(t("planDuplicated"));
    } catch (error) {
      if (error instanceof TypeError) {
        setPlanActionError("planServiceUnavailable");
      } else if (error instanceof SyntaxError || error instanceof z.ZodError) {
        setPlanActionError("planHistoryActionFailed");
      } else {
        throw error;
      }
    } finally {
      setIsPlanActionPending(false);
    }
  }

  async function setPlanSharing(enabled: boolean) {
    if (!planResult || !session?.accessToken) {
      setPlanActionError("planSessionRequired");
      return;
    }
    setPlanActionError(undefined);
    setPlanActionNotice(undefined);
    setIsPlanActionPending(true);
    try {
      const response = await fetch(
        `/api/plans/${encodeURIComponent(planResult.plan_id)}/share`,
        {
          method: enabled ? "POST" : "DELETE",
          headers: { Authorization: `Bearer ${session.accessToken}` }
        }
      );
      if (!response.ok) {
        setPlanActionError("planShareFailed");
        return;
      }
      if (enabled) {
        const { token } = planShareSchema.parse(await response.json());
        setShareUrl(
          `${window.location.origin}/${locale}/shared/${encodeURIComponent(token)}`
        );
        setShareEnabled(true);
        setPlanActionNotice(t("shareLinkEnabled"));
      } else {
        setShareUrl(undefined);
        setShareEnabled(false);
        setPlanActionNotice(t("shareLinkRevoked"));
      }
    } catch (error) {
      if (error instanceof TypeError) {
        setPlanActionError("planServiceUnavailable");
      } else if (error instanceof SyntaxError || error instanceof z.ZodError) {
        setPlanActionError("planShareFailed");
      } else {
        throw error;
      }
    } finally {
      setIsPlanActionPending(false);
    }
  }

  async function copyShareLink() {
    if (!shareUrl) {
      return;
    }
    setPlanActionError(undefined);
    setPlanActionNotice(undefined);
    setIsCopyingShareLink(true);
    try {
      await navigator.clipboard.writeText(shareUrl);
      setPlanActionNotice(t("shareLinkCopied"));
    } catch (error) {
      if (error instanceof TypeError || error instanceof DOMException) {
        setPlanActionError("shareLinkCopyFailed");
      } else {
        throw error;
      }
    } finally {
      setIsCopyingShareLink(false);
    }
  }

  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!planResult || !session?.accessToken) {
      setSaveError("planSessionRequired");
      return;
    }
    setSaveError(undefined);
    setSaveNotice(undefined);
    setIsSaving(true);
    try {
      const response = await fetch(`/api/plans/${encodeURIComponent(planResult.plan_id)}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ summary, sections })
      });
      if (!response.ok) {
        setSaveError("planEditFailed");
        return;
      }
      const updated = planResultSchema.parse(await response.json());
      setSummary(updated.summary);
      setSections(updated.sections);
      onPlanUpdated(updated);
      setIsEditing(false);
      setSaveNotice(t("savedVersion", { version: updated.version }));
    } catch (error) {
      if (error instanceof TypeError) {
        setSaveError("planServiceUnavailable");
      } else if (error instanceof SyntaxError || error instanceof z.ZodError) {
        setSaveError("planEditFailed");
      } else {
        throw error;
      }
    } finally {
      setIsSaving(false);
    }
  }

  if (!planResult) {
    return (
      <EmptyState
        description={t("emptyDescription")}
        title={t("emptyTitle")}
      />
    );
  }

  return (
    <div className="space-y-5">
      <Card className="p-5 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
          {t("eyebrow")}
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">{t("title")}</h2>
          <span className="text-sm text-muted-foreground">
            {t("versionLabel", { version: planResult.version })}
          </span>
        </div>
        {isEditing ? (
          <form className="mt-5 space-y-5" onSubmit={(event) => void savePlan(event)}>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="plan-summary">
                {t("summaryLabel")}
              </label>
              <textarea
                className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                id="plan-summary"
                maxLength={5000}
                required
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
              />
            </div>
            {sections.map((section, index) => (
              <fieldset className="space-y-3 rounded-xl border border-border p-4" key={index}>
                <legend className="px-1 text-sm font-medium">
                  {t("sectionLabel", { number: index + 1 })}
                </legend>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor={`plan-section-title-${index}`}>
                    {t("sectionTitleLabel")}
                  </label>
                  <Input
                    id={`plan-section-title-${index}`}
                    maxLength={200}
                    required
                    value={section.title}
                    onChange={(event) =>
                      setSections((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, title: event.target.value } : item
                        )
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor={`plan-section-content-${index}`}>
                    {t("sectionContentLabel")}
                  </label>
                  <textarea
                    className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    id={`plan-section-content-${index}`}
                    maxLength={10000}
                    required
                    value={section.content}
                    onChange={(event) =>
                      setSections((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, content: event.target.value } : item
                        )
                      )
                    }
                  />
                </div>
              </fieldset>
            ))}
            <div className="flex flex-wrap gap-3">
              <Button disabled={isSaving || !session?.accessToken} type="submit">
                {isSaving ? t("saving") : t("saveRevision")}
              </Button>
              <Button
                disabled={isSaving}
                onClick={() => {
                  setSummary(planResult.summary);
                  setSections(planResult.sections);
                  setIsEditing(false);
                  setSaveError(undefined);
                }}
                type="button"
                variant="outline"
              >
                {t("cancelEdit")}
              </Button>
            </div>
            {saveError ? (
              <p className="text-sm text-destructive" role="alert">{errors(saveError)}</p>
            ) : null}
          </form>
        ) : (
          <>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {planResult.summary}
            </p>
            <Button
              className="mt-4"
              disabled={!session?.accessToken}
              onClick={() => {
                setSaveNotice(undefined);
                setIsEditing(true);
              }}
              type="button"
              variant="outline"
            >
              {t("editPlan")}
            </Button>
            {saveNotice ? (
              <p className="mt-3 text-sm text-muted-foreground" role="status">
                {saveNotice}
              </p>
            ) : null}
          </>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            disabled={!session?.accessToken || isPlanActionPending}
            onClick={() => void duplicatePlan()}
            type="button"
            variant="outline"
          >
            {isPlanActionPending ? t("planActionWorking") : t("duplicatePlan")}
          </Button>
          <Button
            disabled={!session?.accessToken || isPlanActionPending || isLoadingHistory}
            onClick={() => void setPlanSharing(!shareEnabled)}
            type="button"
            variant="outline"
          >
            {isPlanActionPending
              ? t("planActionWorking")
              : shareEnabled
                ? t("revokeShareLink")
                : t("enableShareLink")}
          </Button>
          {shareEnabled && !shareUrl ? (
            <Button
              disabled={!session?.accessToken || isPlanActionPending}
              onClick={() => void setPlanSharing(true)}
              type="button"
              variant="outline"
            >
              {t("regenerateShareLink")}
            </Button>
          ) : null}
        </div>
        {shareEnabled && shareUrl ? (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <div className="min-w-0 flex-1 space-y-2">
              <label className="text-sm font-medium" htmlFor="plan-share-link">
                {t("shareLinkLabel")}
              </label>
              <Input id="plan-share-link" readOnly value={shareUrl} />
            </div>
            <Button
              className="self-end"
              disabled={isCopyingShareLink}
              onClick={() => void copyShareLink()}
              type="button"
              variant="outline"
            >
              {isCopyingShareLink ? t("copyingShareLink") : t("copyShareLink")}
            </Button>
          </div>
        ) : shareEnabled ? (
          <p className="mt-3 text-sm text-muted-foreground" role="status">
            {t("shareLinkRegenerateNotice")}
          </p>
        ) : null}
        {historyError ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {errors(historyError)}
          </p>
        ) : null}
        {planActionError ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {errors(planActionError)}
          </p>
        ) : null}
        {planActionNotice ? (
          <p className="mt-3 text-sm text-muted-foreground" role="status">
            {planActionNotice}
          </p>
        ) : null}
      </Card>
      {history ? (
        <Card aria-busy={isLoadingHistory} className="p-5 sm:p-8">
          <h3 className="text-lg font-semibold">{t("historyTitle")}</h3>
          <ol className="mt-5 space-y-3">
            {[...history.versions].reverse().map((item) => (
              <li
                className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                key={item.version}
              >
                <div>
                  <p className="font-medium">
                    {t("versionLabel", { version: item.version })}
                    {item.version === history.current_version
                      ? ` · ${t("currentVersion")}`
                      : ""}
                  </p>
                  <time
                    className="text-sm text-muted-foreground"
                    dateTime={item.created_at}
                  >
                    {new Date(item.created_at).toLocaleString(locale)}
                  </time>
                  <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>
                </div>
                <Button
                  disabled={
                    item.version === history.current_version ||
                    isPlanActionPending ||
                    !session?.accessToken
                  }
                  onClick={() => void restoreVersion(item.version)}
                  type="button"
                  variant="outline"
                >
                  {item.version === history.current_version
                    ? t("currentVersion")
                    : isPlanActionPending
                      ? t("planActionWorking")
                      : t("restoreVersion")}
                </Button>
              </li>
            ))}
          </ol>
          {isLoadingHistory ? (
            <p className="mt-3 text-sm text-muted-foreground" role="status">
              {t("historyLoading")}
            </p>
          ) : null}
        </Card>
      ) : isLoadingHistory ? (
        <Card aria-busy="true" className="p-5 sm:p-8">
          <p className="text-sm text-muted-foreground" role="status">
            {t("historyLoading")}
          </p>
        </Card>
      ) : null}
      <Card className="p-5 sm:p-8">
        <h3 className="text-lg font-semibold">{t("calculationsTitle")}</h3>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          {calculationKeys.map((key) => {
            const value = planResult.calculations[key];
            if (value === null || value === undefined) {
              return null;
            }
            return (
              <div className="rounded-xl bg-muted/50 p-4" key={key}>
                <dt className="text-sm text-muted-foreground">
                  {t(`calculations.${key}`)}
                </dt>
                <dd className="mt-1 break-all font-semibold">
                  {value}
                  {key === "dscr" ? "" : ` ${t("currency")}`}
                </dd>
              </div>
            );
          })}
        </dl>
      </Card>
      <Card className="p-5 sm:p-8">
        <h3 className="text-lg font-semibold">{t("sectionsTitle")}</h3>
        <div className="mt-5 space-y-5">
          {planResult.sections.map((section, index) => (
            <article className="border-t border-border pt-5 first:border-0 first:pt-0" key={`${section.title}-${index}`}>
              <h4 className="font-semibold">{section.title}</h4>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {section.content}
              </p>
            </article>
          ))}
        </div>
        <details className="mt-6 border-t border-border pt-5">
          <summary className="cursor-pointer rounded-md font-medium hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {t("markdownTitle")}
          </summary>
          <pre className="mt-4 overflow-x-auto whitespace-pre-wrap rounded-xl bg-muted/50 p-4 text-sm leading-6">
            {planResult.markdown}
          </pre>
        </details>
        <div className="mt-6 border-t border-border pt-5">
          <div className="flex flex-wrap gap-3">
            {documentFormats.map(({ format, label }) => (
              <Button
                aria-busy={exporting === format}
                disabled={exporting !== undefined}
                key={format}
                onClick={() => void exportDocument(planResult, format)}
                type="button"
                variant="outline"
              >
                {exporting === format ? t("exporting") : t(label)}
              </Button>
            ))}
          </div>
          {exportError ? (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {errors(exportError)}
            </p>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
