import type { PlanAssumptions } from "@/components/finadvisor/plan-wizard";

export type DocumentFormat = "pdf" | "excel" | "bank-pack" | "synergy";

export type PlanDocumentPayload = {
  summary: string;
  sections: { title: string; content: string }[];
  markdown: string;
  calculations: Record<string, string | number | null>;
  assumptions: PlanAssumptions;
};

export class DocumentExportError extends Error {
  constructor(
    readonly kind:
      | "failed"
      | "unavailable"
      | "upgrade-required"
      | "business-required"
  ) {
    super(kind);
    this.name = "DocumentExportError";
  }
}

export async function requestPlanDocument(
  planId: string,
  format: DocumentFormat,
  locale: string,
  plan: PlanDocumentPayload,
  accessToken: string
): Promise<{ blob: Blob; filename: string }> {
  let response: Response;
  try {
    response = await fetch(
      `/api/documents/${encodeURIComponent(planId)}/${format}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ locale, plan })
      }
    );
  } catch (error) {
    if (error instanceof TypeError) {
      throw new DocumentExportError("unavailable");
    }
    throw error;
  }

  if (!response.ok) {
    let detail: string | undefined;
    let feature: string | undefined;
    try {
      const body: unknown = await response.json();
      if (
        body !== null &&
        typeof body === "object" &&
        "detail" in body
      ) {
        if (typeof body.detail === "string") {
          detail = body.detail;
        } else if (
          body.detail !== null &&
          typeof body.detail === "object" &&
          "code" in body.detail &&
          body.detail.code === "plans.feature_not_included" &&
          "feature" in body.detail &&
          typeof body.detail.feature === "string"
        ) {
          detail = body.detail.code;
          feature = body.detail.feature;
        }
      }
    } catch (error) {
      if (!(error instanceof SyntaxError)) {
        throw error;
      }
    }
    if (
      detail === "documents.export_plan_required" ||
      (detail === "plans.feature_not_included" && feature === "exports")
    ) {
      throw new DocumentExportError("upgrade-required");
    }
    if (
      detail === "documents.business_plan_required" ||
      (detail === "plans.feature_not_included" && feature === "agent_synergy")
    ) {
      throw new DocumentExportError("business-required");
    }
    throw new DocumentExportError("failed");
  }

  const filenames: Record<DocumentFormat, string> = {
    pdf: `finadvisor-plan-${planId}.pdf`,
    excel: `finadvisor-plan-${planId}.xlsx`,
    "bank-pack": `finadvisor-bank-pack-${planId}.pdf`,
    synergy: `finadvisor-agent-synergy-${planId}.pdf`
  };
  return {
    blob: await response.blob(),
    filename: filenames[format]
  };
}
