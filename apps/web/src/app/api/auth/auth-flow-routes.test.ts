import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as forgotPassword } from "./forgot-password/route";
import { POST as resetPassword } from "./reset-password/route";
import { POST as verifyEmail } from "./verify-email/route";

const routes = [
  ["forgot-password", forgotPassword, { email: "owner@example.com" }],
  ["reset-password", resetPassword, { token: "reset-token", password: "NewPass123!" }],
  ["verify-email", verifyEmail, { token: "verify-token" }]
] as const;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("account recovery API proxies", () => {
  it.each(routes)("forwards the %s request to the current auth API", async (path, handler, payload) => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "ok" }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await handler(
      new NextRequest(`http://localhost/api/auth/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ message: "ok" });
    expect(fetchMock).toHaveBeenCalledWith(
      `http://127.0.0.1:8000/auth/${path}`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(payload),
        cache: "no-store"
      })
    );
  });

  it("preserves backend failure status codes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "invalid token" }), { status: 400 })
      )
    );

    const response = await resetPassword(
      new NextRequest("http://localhost/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "expired", password: "NewPass123!" })
      })
    );

    expect(response.status).toBe(400);
  });
});
