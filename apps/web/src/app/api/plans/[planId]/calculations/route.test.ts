import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("saved plan calculator proxy", () => {
  it("requires authentication", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("https://web.finadvisor.test/api/plans/plan-1/calculations", {
        method: "POST",
        body: "{}"
      }),
      { params: { planId: "plan-1" } }
    );

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards authenticated saves to the matching API resource", async () => {
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.test");
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ plan_id: "plan/one", result: {} }, { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const payload = JSON.stringify({
      calculation_type: "break-even",
      inputs: { fixed_costs: "1000", variable_cost_ratio_percent: "20" }
    });

    const response = await POST(
      new Request("https://web.finadvisor.test/api/plans/plan%2Fone/calculations", {
        method: "POST",
        headers: {
          Authorization: "Bearer user-token",
          "Content-Type": "application/json"
        },
        body: payload
      }),
      { params: { planId: "plan/one" } }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ plan_id: "plan/one", result: {} });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finadvisor.test/plans/plan%2Fone/calculations",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer user-token",
          "Content-Type": "application/json"
        },
        body: payload,
        cache: "no-store"
      })
    );
  });
});
