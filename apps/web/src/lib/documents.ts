export type DocumentFormat = "pdf" | "excel";

export type PlanDocumentPayload = {
  summary: string;
  sections: { title: string; content: string }[];
  calculations: Record<string, string | number | null>;
};

export class DocumentExportError extends Error {
  constructor(readonly kind: "failed" | "unavailable") {
    super(kind);
    this.name = "DocumentExportError";
  }
}

export async function requestPlanDocument(
  planId: string,
  format: DocumentFormat,
  locale: string,
  plan: PlanDocumentPayload
): Promise<{ blob: Blob; filename: string }> {
  let response: Response;
  try {
    response = await fetch(
      `/api/documents/${encodeURIComponent(planId)}/${format}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    throw new DocumentExportError("failed");
  }

  const extension = format === "excel" ? "xlsx" : "pdf";
  return {
    blob: await response.blob(),
    filename: `finadvisor-plan-${planId}.${extension}`
  };
}
