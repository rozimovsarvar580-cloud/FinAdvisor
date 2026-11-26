import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("generic plan proxy", () => {
  it("requires authentication before creating a plan", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("https://web.finadvisor.test/api/plans", {
        method: "POST",
        body: "{}"
      })
    );

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards the owner's request to the API without caching", async () => {
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.test");
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ id: "plan-1" }, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const body = JSON.stringify({ sector_id: "retail_shop", inputs: {} });

    const response = await POST(
      new Request("https://web.finadvisor.test/api/plans", {
        method: "POST",
        headers: {
          Authorization: "Bearer owner-access-token",
          "Content-Type": "application/json"
        },
        body
      })
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "plan-1" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finadvisor.test/plans",
      expect.objectContaining({
        method: "POST",
        body,
        headers: {
          Authorization: "Bearer owner-access-token",
          "Content-Type": "application/json"
        },
        cache: "no-store"
      })
    );
  });
});
