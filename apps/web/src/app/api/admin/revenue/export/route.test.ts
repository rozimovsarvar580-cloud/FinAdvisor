import { afterEach, describe, expect, it, vi } from "vitest";

const { getServerSession } = vi.hoisted(() => ({
  getServerSession: vi.fn()
}));

vi.mock("next-auth/next", () => ({ getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { GET } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  getServerSession.mockReset();
});

describe("admin revenue CSV proxy", () => {
  it("requires an admin session and forwards the token server-side", async () => {
    getServerSession.mockResolvedValue({
      accessToken: "admin-access-token",
      user: { role: "admin" }
    });
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.test");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("section,metric\nsummary,active", {
        status: 200,
        headers: { "content-type": "text/csv" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finadvisor.test/admin/revenue/export",
      expect.objectContaining({
        headers: {
          Authorization: expect.stringMatching(/^Bearer admin-access-token$/)
        },
        cache: "no-store"
      })
    );
    expect(response.headers.get("content-disposition")).toBe(
      "attachment; filename=admin_revenue.csv"
    );
    expect(await response.text()).toContain("active");
  });

  it("rejects non-admin sessions without contacting the API", async () => {
    getServerSession.mockResolvedValue({
      accessToken: "owner-access-token",
      user: { role: "tadbirkor" }
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET();

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects admin sessions without an access token", async () => {
    getServerSession.mockResolvedValue({ user: { role: "admin" } });

    const response = await GET();

    expect(response.status).toBe(401);
  });
});
