import { afterEach, describe, expect, it, vi } from "vitest";

import { PUT } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("saved plan edit proxy", () => {
  it("requires authentication", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await PUT(
      new Request("https://web.finadvisor.test/api/plans/plan-1", {
        method: "PUT",
        body: "{}"
      }),
      { params: { planId: "plan-1" } }
    );

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards an authenticated edit to the matching plan", async () => {
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.test");
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ plan_id: "plan/one", version: 2 }, { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const payload = JSON.stringify({
      summary: "Updated summary",
      sections: [{ title: "Operations", content: "Updated details." }]
    });

    const response = await PUT(
      new Request("https://web.finadvisor.test/api/plans/plan%2Fone", {
        method: "PUT",
        headers: {
          Authorization: "Bearer owner-token",
          "Content-Type": "application/json"
        },
        body: payload
      }),
      { params: { planId: "plan/one" } }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ plan_id: "plan/one", version: 2 });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finadvisor.test/plans/plan%2Fone",
      expect.objectContaining({
        method: "PUT",
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
