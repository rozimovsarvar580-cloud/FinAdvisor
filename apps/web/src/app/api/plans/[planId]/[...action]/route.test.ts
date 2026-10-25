import { afterEach, describe, expect, it, vi } from "vitest";

import { DELETE, GET, POST } from "./route";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("saved plan action proxy", () => {
  it("forwards history reads with the owner authorization", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ current_version: 2, versions: [], share_enabled: false })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request("http://localhost/api/plans/plan-1/versions", {
        headers: { Authorization: "Bearer owner-token" }
      }),
      { params: { planId: "plan-1", action: ["versions"] } }
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/plans/plan-1/versions",
      expect.objectContaining({
        method: "GET",
        headers: { Authorization: "Bearer owner-token" },
        cache: "no-store"
      })
    );
  });

  it("forwards restore and duplicate POST actions", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(async () => Response.json({ version: 3 }));
    vi.stubGlobal("fetch", fetchMock);
    const createRequest = () =>
      new Request("http://localhost/api", {
        method: "POST",
        headers: {
          Authorization: "Bearer owner-token",
          "Content-Type": "application/json"
        },
        body: "{}"
      });

    await POST(createRequest(), {
      params: { planId: "plan-1", action: ["restore", "2"] }
    });
    await POST(createRequest(), {
      params: { planId: "plan-1", action: ["duplicate"] }
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://127.0.0.1:8000/plans/plan-1/restore/2",
      expect.objectContaining({ method: "POST", body: "{}" })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:8000/plans/plan-1/duplicate",
      expect.objectContaining({ method: "POST", body: "{}" })
    );
  });

  it("revokes sharing and returns a bodyless 204 response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await DELETE(
      new Request("http://localhost/api", {
        method: "DELETE",
        headers: { Authorization: "Bearer owner-token" }
      }),
      { params: { planId: "plan-1", action: ["share"] } }
    );

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/plans/plan-1/share",
      expect.objectContaining({ method: "DELETE" })
    );
  });
});
