import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

describe("investor brief proxy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("forwards consent and returns the inline PDF without caching", async () => {
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.test/");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("%PDF-investor", {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'inline; filename="finadvisor-investor-brief.pdf"'
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
      new Request("https://finadvisor.test/api/investor-brief", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://finadvisor.test"
        },
        body
      })
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finadvisor.test/investor-brief/download",
      expect.objectContaining({ method: "POST", body, cache: "no-store" })
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("inline");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("%PDF-investor");
  });

  it("rejects cross-origin writes and oversized request bodies", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const crossOrigin = await POST(
      new Request("https://finadvisor.test/api/investor-brief", {
        method: "POST",
        headers: { Origin: "https://other.example" },
        body: "{}"
      })
    );
    const oversized = await POST(
      new Request("https://finadvisor.test/api/investor-brief", {
        method: "POST",
        body: JSON.stringify({ email: "owner@example.com", message: "x".repeat(5000) })
      })
    );

    expect(crossOrigin.status).toBe(403);
    expect(oversized.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
