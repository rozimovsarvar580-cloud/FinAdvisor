import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

describe("support contact proxy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("forwards the consented message to the API", async () => {
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.test");
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ sent: true }, { status: 202 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const body = JSON.stringify({
      name: "Owner",
      email: "owner@example.com",
      category: "general",
      message: "I would like help with my plan.",
      consent: true,
      locale: "en"
    });

    const response = await POST(
      new Request("https://finadvisor.test/api/support/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://finadvisor.test"
        },
        body
      })
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finadvisor.test/support/contact",
      expect.objectContaining({ method: "POST", body, cache: "no-store" })
    );
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ sent: true });
  });

  it("rejects cross-origin writes and oversized messages", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const crossOrigin = await POST(
      new Request("https://finadvisor.test/api/support/contact", {
        method: "POST",
        headers: { Origin: "https://other.example" },
        body: "{}"
      })
    );
    const oversized = await POST(
      new Request("https://finadvisor.test/api/support/contact", {
        method: "POST",
        body: JSON.stringify({ message: "x".repeat(9000) })
      })
    );

    expect(crossOrigin.status).toBe(403);
    expect(oversized.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
