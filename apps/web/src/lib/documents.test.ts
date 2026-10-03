import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DocumentExportError,
  requestPlanDocument,
  type PlanDocumentPayload
} from "./documents";

const plan: PlanDocumentPayload = {
  summary: "Restaurant plan",
  sections: [{ title: "Operations", content: "Open every day." }],
  calculations: { monthly_revenue: "150000000.00" }
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestPlanDocument", () => {
  it.each([
    ["pdf", "finadvisor-plan-plan-1.pdf"],
    ["excel", "finadvisor-plan-plan-1.xlsx"]
  ] as const)("requests %s and returns its download name", async (format, filename) => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("document", { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestPlanDocument("plan-1", format, "uz", plan);

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/documents/plan-1/${format}`,
      expect.objectContaining({ method: "POST" })
    );
    expect(result.filename).toBe(filename);
    expect(await result.blob.text()).toBe("document");
  });

  it("marks a failed export response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    await expect(requestPlanDocument("plan-1", "pdf", "uz", plan)).rejects.toMatchObject({
      kind: "failed"
    });
  });

  it("marks a network failure as unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network error")));

    await expect(requestPlanDocument("plan-1", "pdf", "uz", plan)).rejects.toBeInstanceOf(
      DocumentExportError
    );
  });
});
