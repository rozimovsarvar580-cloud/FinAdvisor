import { afterEach, describe, expect, it, vi } from "vitest";

import { forwardDocumentExport } from "./document-proxy";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("forwardDocumentExport", () => {
  it("forwards the export body and returns the file headers", async () => {
    const upstream = new Response("pdf bytes", {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="plan.pdf"'
      }
    });
    const fetchMock = vi.fn().mockResolvedValue(upstream);
    vi.stubGlobal("fetch", fetchMock);

    const response = await forwardDocumentExport(
      new Request("http://localhost/api", {
        method: "POST",
        body: JSON.stringify({ locale: "uz" })
      }),
      "plan-1",
      "pdf"
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/documents/plan-1/pdf",
      expect.objectContaining({ method: "POST" })
    );
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(await response.text()).toBe("pdf bytes");
  });

  it("rejects unsafe document paths without contacting the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await forwardDocumentExport(
      new Request("http://localhost/api", { method: "POST" }),
      "../private",
      "pdf"
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports an unavailable API service", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));

    const response = await forwardDocumentExport(
      new Request("http://localhost/api", { method: "POST", body: "{}" }),
      "plan-1",
      "excel"
    );

    expect(response.status).toBe(503);
  });
});
