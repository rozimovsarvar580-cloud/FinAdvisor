import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

describe("analytics consent proxy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("forwards consent to the private API", async () => {
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.test");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ recorded: true }), {
        status: 202,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request("https://finadvisor.test/api/analytics/consent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://finadvisor.test"
      },
      body: JSON.stringify({ visitor_id: "visitor_identifier_123", consent: true })
    });

    const response = await POST(request);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finadvisor.test/analytics/consent",
      expect.objectContaining({ method: "POST", cache: "no-store" })
    );
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ recorded: true });
  });

  it("rejects cross-origin consent writes", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request("https://finadvisor.test/api/analytics/consent", {
      method: "POST",
      headers: { Origin: "https://attacker.test" },
      body: "{}"
    });

    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
