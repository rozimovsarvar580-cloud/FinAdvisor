import { afterEach, describe, expect, it, vi } from "vitest";

const { getServerSession } = vi.hoisted(() => ({ getServerSession: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { GET } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  getServerSession.mockReset();
});

describe("GET /api/auth/me/export", () => {
  it("forwards the authenticated export and preserves download headers", async () => {
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.test");
    getServerSession.mockResolvedValue({
      accessToken: "account-token",
      user: { role: "tadbirkor" }
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{"account":{"id":"owner"}}', {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": 'attachment; filename="finadvisor-data-export.json"',
          "Cache-Control": "no-store"
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request("https://finadvisor.test/api/auth/me/export");

    const response = await GET(request);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finadvisor.test/auth/me/export",
      expect.objectContaining({ method: "GET", cache: "no-store" })
    );
    expect(response.headers.get("content-disposition")).toContain(
      "finadvisor-data-export.json"
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ account: { id: "owner" } });
  });
});
