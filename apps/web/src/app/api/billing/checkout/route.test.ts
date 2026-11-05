import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("billing checkout proxy", () => {
  it("requires same-origin requests and an authenticated user", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const crossOrigin = await POST(
      new Request("https://web.finadvisor.test/api/billing/checkout", {
        method: "POST",
        headers: {
          Origin: "https://attacker.test",
          Authorization: "Bearer token"
        },
        body: "{}"
      })
    );
    const unauthenticated = await POST(
      new Request("https://web.finadvisor.test/api/billing/checkout", {
        method: "POST",
        headers: { Origin: "https://web.finadvisor.test" },
        body: "{}"
      })
    );

    expect(crossOrigin.status).toBe(403);
    expect(unauthenticated.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards checkout requests to the authenticated billing API", async () => {
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.test");
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json(
        {
          subscription_id: "subscription-1",
          invoice_id: "invoice-1",
          amount_minor: 1000,
          currency: "USD",
          checkout_url: "https://web.finadvisor.test/checkout"
        },
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const payload = JSON.stringify({
      plan: "pro",
      billing_period: "weekly",
      locale: "en"
    });

    const response = await POST(
      new Request("https://web.finadvisor.test/api/billing/checkout", {
        method: "POST",
        headers: {
          Origin: "https://web.finadvisor.test",
          Authorization: "Bearer owner-token",
          "Content-Type": "application/json"
        },
        body: payload
      })
    );

    expect(response.status).toBe(200);
    expect((await response.json()).amount_minor).toBe(1000);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finadvisor.test/billing/checkout",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer owner-token",
          "Content-Type": "application/json"
        },
        body: payload,
        cache: "no-store"
      })
    );
  });
});
