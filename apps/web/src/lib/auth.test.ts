import type { Profile, Session } from "next-auth";
import { afterEach, describe, expect, it, vi } from "vitest";

import { authOptions, exchangeOAuthAccount } from "./auth";

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: () => ({ value: "investor" }),
    delete: vi.fn()
  })
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("exchangeOAuthAccount", () => {
  it("exchanges a verified provider access token with the API", async () => {
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.test");
    vi.stubEnv("INTERNAL_API_KEY", "internal-api-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "finadvisor-jwt",
          refresh_token: "finadvisor-refresh-token",
          expires_in: 900,
          is_new: true,
          user: {
            id: "user-123",
            email: "owner@example.com",
            name: "Restaurant Owner",
            role: "tadbirkor",
            needs_role: true
          }
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      exchangeOAuthAccount({
        provider: "google",
        providerAccountId: "google-account-123",
        email: "owner@example.com",
        name: "Restaurant Owner",
        avatarUrl: "https://example.com/avatar.png",
        emailVerified: true,
        role: "investor"
      })
    ).resolves.toMatchObject({
      access_token: "finadvisor-jwt",
      refresh_token: "finadvisor-refresh-token",
      is_new: true,
      user: { id: "user-123" }
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finadvisor.test/auth/oauth",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Key": "internal-api-key"
        },
        body: JSON.stringify({
          provider: "google",
          provider_account_id: "google-account-123",
          email: "owner@example.com",
          name: "Restaurant Owner",
          avatar_url: "https://example.com/avatar.png",
          email_verified: true,
          role: "investor"
        })
      })
    );
  });

  it("surfaces failed API exchanges", async () => {
    vi.stubEnv("INTERNAL_API_KEY", "internal-api-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 503 }))
    );

    await expect(
      exchangeOAuthAccount({
        provider: "facebook",
        providerAccountId: "facebook-account-123",
        email: "owner@example.com",
        name: "Restaurant Owner",
        avatarUrl: null,
        emailVerified: false
      })
    ).rejects.toThrow("OAuth exchange failed with status 503");
  });

  it("does not call the API when the internal key is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      exchangeOAuthAccount({
        provider: "google",
        providerAccountId: "google-account-123",
        email: "owner@example.com",
        name: "Restaurant Owner",
        avatarUrl: null,
        emailVerified: true
      })
    ).rejects.toThrow("INTERNAL_API_KEY must be configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stores the trusted OAuth result and marks new accounts for role onboarding", async () => {
    vi.stubEnv("INTERNAL_API_KEY", "internal-api-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: "finadvisor-jwt",
            refresh_token: "finadvisor-refresh-token",
            expires_in: 900,
            is_new: true,
            user: {
              id: "user-123",
              email: "owner@example.com",
              name: "Restaurant Owner",
              role: "investor",
              needs_role: true
            }
          }),
          { status: 200 }
        )
      )
    );
    const jwtCallback = authOptions.callbacks?.jwt;
    if (!jwtCallback) throw new Error("JWT callback is required");

    const token = await jwtCallback({
      token: {},
      user: {
        id: "provider-user-123",
        name: "Restaurant Owner",
        email: "owner@example.com",
        image: "https://example.com/avatar.png"
      },
      account: {
        provider: "google",
        providerAccountId: "google-account-123",
        type: "oauth"
      },
      profile: { email_verified: true } as Profile,
      trigger: "signIn"
    });

    expect(token).toMatchObject({
      sub: "user-123",
      role: "investor",
      accessToken: "finadvisor-jwt",
      refreshToken: "finadvisor-refresh-token",
      needsRole: true
    });
    expect(token.accessTokenExpires).toBeGreaterThan(Date.now());
  });

  it("rotates expired access tokens and exposes refresh failures in the session", async () => {
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.test");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "rotated-access-token",
            refresh_token: "rotated-refresh-token",
            expires_in: 900,
            user: {
              id: "user-123",
              email: "owner@example.com",
              name: "Restaurant Owner",
              role: "tadbirkor"
            }
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    const jwtCallback = authOptions.callbacks?.jwt;
    const sessionCallback = authOptions.callbacks?.session;
    if (!jwtCallback || !sessionCallback) {
      throw new Error("Auth callbacks are required");
    }

    const initialToken = {
      sub: "user-123",
      role: "tadbirkor" as const,
      accessToken: "expired-access-token",
      refreshToken: "old-refresh-token",
      accessTokenExpires: Date.now() - 1
    };
    const refreshed = await jwtCallback({
      token: initialToken,
      user: undefined as never,
      account: null
    });
    expect(refreshed.accessToken).toBe("rotated-access-token");
    expect(refreshed.refreshToken).toBe("rotated-refresh-token");

    const rejected = await jwtCallback({
      token: {
        ...refreshed,
        accessTokenExpires: Date.now() - 1
      },
      user: undefined as never,
      account: null
    });
    const session = (await sessionCallback({
      session: {
        expires: new Date(Date.now() + 60_000).toISOString(),
        user: {
          id: "user-123",
          email: "owner@example.com",
          name: "Restaurant Owner",
          image: null
        }
      },
      token: rejected,
      user: {
        id: "user-123",
        email: "owner@example.com",
        emailVerified: null,
        name: "Restaurant Owner",
        image: null
      },
      newSession: undefined,
      trigger: "update"
    })) as Session;

    expect(rejected.error).toBe("RefreshAccessTokenError");
    expect(session.accessToken).toBeUndefined();
    expect(session.error).toBe("RefreshAccessTokenError");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refreshes the server-owned role onboarding state on session update", async () => {
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.test");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          email: "owner@example.com",
          name: "Updated Owner",
          role: "investor",
          needs_role: false
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const jwtCallback = authOptions.callbacks?.jwt;
    if (!jwtCallback) throw new Error("JWT callback is required");

    const token = await jwtCallback({
      token: {
        sub: "user-123",
        role: "tadbirkor",
        accessToken: "active-access-token",
        refreshToken: "active-refresh-token",
        accessTokenExpires: Date.now() + 300_000,
        needsRole: true
      },
      user: undefined as never,
      account: null,
      trigger: "update"
    });

    expect(token).toMatchObject({
      name: "Updated Owner",
      email: "owner@example.com",
      role: "investor",
      needsRole: false
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finadvisor.test/auth/me",
      expect.objectContaining({
        headers: { Authorization: "Bearer active-access-token" },
        cache: "no-store"
      })
    );
  });
});
