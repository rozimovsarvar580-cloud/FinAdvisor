import { afterEach, describe, expect, it, vi } from "vitest";

import { proxyBillingRequest } from "./proxy";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("billing API proxy", () => {
  it("requires authentication and same-origin mutations", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const unauthenticated = await proxyBillingRequest(
      new Request("https://web.finadvisor.test/api/billing/summary"),
      "summary",
      "GET"
    );
    const crossOrigin = await proxyBillingRequest(
      new Request("https://web.finadvisor.test/api/billing/cancel", {
        method: "POST",
        headers: {
          Origin: "https://attacker.test",
          Authorization: "Bearer access-token"
        }
      }),
      "cancel",
      "POST"
    );

    expect(unauthenticated.status).toBe(401);
    expect(crossOrigin.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards authenticated summary reads without caching", async () => {
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.test");
    const summary = { current_plan: "free", invoices: [] };
    const fetchMock = vi.fn().mockResolvedValue(Response.json(summary));
    vi.stubGlobal("fetch", fetchMock);

    const response = await proxyBillingRequest(
      new Request("https://web.finadvisor.test/api/billing/summary", {
        headers: { Authorization: "Bearer access-token" }
      }),
      "summary",
      "GET"
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(summary);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finadvisor.test/billing/summary",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer access-token" },
        cache: "no-store"
      })
    );
  });

  it("forwards same-origin mutation bodies and reports unavailable service", async () => {
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.test");
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ cancel_at_period_end: true })
    );
    vi.stubGlobal("fetch", fetchMock);
    const payload = JSON.stringify({ plan: "business" });

    const response = await proxyBillingRequest(
      new Request("https://web.finadvisor.test/api/billing/plan-change", {
        method: "POST",
        headers: {
          Origin: "https://web.finadvisor.test",
          Authorization: "Bearer access-token",
          "Content-Type": "application/json"
        },
        body: payload
      }),
      "plan-change",
      "POST"
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finadvisor.test/billing/plan-change",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer access-token",
          "Content-Type": "application/json"
        },
        body: payload,
        cache: "no-store"
      })
    );

    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    const unavailable = await proxyBillingRequest(
      new Request("https://web.finadvisor.test/api/billing/cancel", {
        method: "POST",
        headers: {
          Origin: "https://web.finadvisor.test",
          Authorization: "Bearer access-token"
        }
      }),
      "cancel",
      "POST"
    );
    expect(unavailable.status).toBe(503);
  });
});
