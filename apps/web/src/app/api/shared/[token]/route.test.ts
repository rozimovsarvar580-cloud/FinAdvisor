import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("shared plan proxy", () => {
  it("forwards a valid opaque token without owner credentials", async () => {
    const token = "a".repeat(43);
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ plan_id: "plan-1" })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new Request("http://localhost/api"), {
      params: { token }
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(fetchMock).toHaveBeenCalledWith(
      `http://127.0.0.1:8000/plans/shared/${token}`,
      { cache: "no-store" }
    );
  });

  it("rejects malformed share tokens before contacting the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new Request("http://localhost/api"), {
      params: { token: "not-a-token" }
    });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
