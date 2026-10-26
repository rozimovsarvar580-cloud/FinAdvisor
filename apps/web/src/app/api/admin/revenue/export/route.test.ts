import { afterEach, describe, expect, it, vi } from "vitest";

const { getServerSession } = vi.hoisted(() => ({ getServerSession: vi.fn() }));
vi.mock("next-auth/next", () => ({ getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { GET } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  getServerSession.mockReset();
});

describe("GET /api/admin/revenue/export", () => {
  it("forwards the admin token and streams the CSV download", async () => {
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.test");
    getServerSession.mockResolvedValue({
      accessToken: "admin-token",
      user: { role: "admin" }
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("metric,value\nmrr,100", {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="revenue.csv"'
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain("revenue.csv");
    expect(await response.text()).toContain("mrr,100");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finadvisor.test/admin/revenue/export",
      expect.objectContaining({
        headers: { Authorization: "Bearer admin-token" },
        cache: "no-store"
      })
    );
  });

  it("blocks unauthenticated and non-admin users before proxying", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    getServerSession.mockResolvedValueOnce(null).mockResolvedValueOnce({
      accessToken: "owner-token",
      user: { role: "tadbirkor" }
    });

    expect((await GET()).status).toBe(401);
    expect((await GET()).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
