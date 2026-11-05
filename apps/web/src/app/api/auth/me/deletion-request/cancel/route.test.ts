import { afterEach, describe, expect, it, vi } from "vitest";

const { getServerSession } = vi.hoisted(() => ({ getServerSession: vi.fn() }));
vi.mock("next-auth", () => ({ getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { POST } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  getServerSession.mockReset();
});

describe("POST /api/auth/me/deletion-request/cancel", () => {
  it("forwards a same-origin cancellation to the authenticated API", async () => {
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.test");
    getServerSession.mockResolvedValue({
      accessToken: "account-token",
      user: { role: "tadbirkor" }
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{"deletion_requested_at":null}', {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request(
      "https://finadvisor.test/api/auth/me/deletion-request/cancel",
      {
        method: "POST",
        headers: { Origin: "https://finadvisor.test" }
      }
    );

    const response = await POST(request);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finadvisor.test/auth/me/deletion-request/cancel",
      expect.objectContaining({ method: "POST", cache: "no-store" })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deletion_requested_at: null });
  });
});
