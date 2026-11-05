import { afterEach, describe, expect, it, vi } from "vitest";

const { getServerSession } = vi.hoisted(() => ({
  getServerSession: vi.fn()
}));

vi.mock("next-auth", () => ({ getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

import { PATCH } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  getServerSession.mockReset();
});

function request(
  body: unknown,
  origin = "http://localhost"
): Request {
  return new Request("http://localhost/api/auth/role", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body)
  });
}

describe("PATCH /api/auth/role", () => {
  it("forwards the selected role using the server-side access token", async () => {
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.test");
    getServerSession.mockResolvedValue({ accessToken: "server-access-token" });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ role: "investor", needs_role: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await PATCH(request({ role: "investor" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      role: "investor",
      needs_role: false
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finadvisor.test/auth/me",
      expect.objectContaining({
        method: "PATCH",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer server-access-token"
        },
        body: JSON.stringify({ role: "investor" })
      })
    );
  });

  it("rejects requests without a same-origin valid role or authenticated session", async () => {
    getServerSession.mockResolvedValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const crossOrigin = await PATCH(
      request({ role: "investor" }, "https://attacker.example")
    );
    const invalidRole = await PATCH(request({ role: "admin" }));
    const unauthenticated = await PATCH(request({ role: "investor" }));

    expect(crossOrigin.status).toBe(403);
    expect(invalidRole.status).toBe(400);
    expect(unauthenticated.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
