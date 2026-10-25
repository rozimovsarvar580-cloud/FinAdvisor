import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as forgotPassword } from "./forgot-password/route";
import { POST as resetPassword } from "./reset-password/route";
import { POST as verifyEmail } from "./verify-email/route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function request(body: unknown) {
  return new Request("http://localhost/api/auth/flow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

describe("account recovery API proxies", () => {
  it("forwards forgot-password requests to the API", async () => {
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.test");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{"message":"accepted"}', {
        status: 202,
        headers: { "Content-Type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await forgotPassword(request({ email: "owner@example.com" }));

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ message: "accepted" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finadvisor.test/auth/forgot-password",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        body: JSON.stringify({ email: "owner@example.com" })
      })
    );
  });

  it("forwards reset-password token and new password requests", async () => {
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.test");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{"message":"reset"}', { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await resetPassword(
      request({ token: "single-use-token", password: "StrongPass123!" })
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finadvisor.test/auth/reset-password",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          token: "single-use-token",
          password: "StrongPass123!"
        })
      })
    );
  });

  it("forwards email verification token requests and failure statuses", async () => {
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.test");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{"detail":"auth.invalid_or_expired_email_token"}', {
        status: 400
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await verifyEmail(request({ token: "expired-token" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      detail: "auth.invalid_or_expired_email_token"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finadvisor.test/auth/verify-email",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "expired-token" })
      })
    );
  });
});
