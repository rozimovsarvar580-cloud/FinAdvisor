import { afterEach, describe, expect, it, vi } from "vitest";

import { exchangeOAuthAccount } from "./auth";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("exchangeOAuthAccount", () => {
  it("exchanges a verified provider access token with the API", async () => {
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.test");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "finadvisor-jwt",
          user: {
            id: "user-123",
            email: "owner@example.com",
            name: "Restaurant Owner",
            role: "tadbirkor"
          }
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      exchangeOAuthAccount("google", "provider-access-token", "investor")
    ).resolves.toMatchObject({
      access_token: "finadvisor-jwt",
      user: { id: "user-123" }
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finadvisor.test/auth/oauth",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        body: JSON.stringify({
          provider: "google",
          access_token: "provider-access-token",
          role: "investor"
        })
      })
    );
  });

  it("surfaces failed API exchanges", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 503 }))
    );

    await expect(
      exchangeOAuthAccount("facebook", "provider-access-token")
    ).rejects.toThrow("OAuth exchange failed with status 503");
  });
});
