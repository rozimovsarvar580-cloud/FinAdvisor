import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

describe("sample plan lead proxy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("forwards the consented request and returns the PDF download", async () => {
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.test");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("%PDF-sample", {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="sample.pdf"'
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const body = JSON.stringify({
      email: "owner@example.com",
      consent: true,
      locale: "en"
    });

    const response = await POST(
      new Request("https://finadvisor.test/api/lead-magnet/sample-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://finadvisor.test"
        },
        body
      })
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finadvisor.test/lead-magnet/sample-plan",
      expect.objectContaining({ method: "POST", body, cache: "no-store" })
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("sample.pdf");
    expect(await response.text()).toBe("%PDF-sample");
  });

  it("rejects cross-origin requests", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      new Request("https://finadvisor.test/api/lead-magnet/sample-plan", {
        method: "POST",
        headers: { Origin: "https://other.example" },
        body: "{}"
      })
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects oversized payloads before forwarding", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      new Request("https://finadvisor.test/api/lead-magnet/sample-plan", {
        method: "POST",
        body: JSON.stringify({ value: "x".repeat(5000) })
      })
    );

    expect(response.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
