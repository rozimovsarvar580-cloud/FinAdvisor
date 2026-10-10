import type { JWT } from "next-auth/jwt";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { cookieGet, cookieDelete } = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  cookieDelete: vi.fn()
}));

vi.mock("next/headers", () => ({
  cookies: () => ({ get: cookieGet, delete: cookieDelete })
}));

import {
  authOptions,
  exchangeOAuthAccount,
  refreshAccessToken,
  updateUserRole
} from "./auth";

function accessToken(expiresAt = Math.floor(Date.now() / 1000) + 900): string {
  const payload = Buffer.from(JSON.stringify({ exp: expiresAt })).toString(
    "base64url"
  );
  return `header.${payload}.signature`;
}

function loginResponse(overrides: Record<string, unknown> = {}) {
  return {
    access_token: accessToken(),
    refresh_token: "finadvisor-refresh-token",
    is_new: false,
    user: {
      id: "user-123",
      email: "owner@example.com",
      name: "Restaurant Owner",
      role: "tadbirkor"
    },
    ...overrides
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  cookieGet.mockReset();
  cookieDelete.mockReset();
});

describe("exchangeOAuthAccount", () => {
  it("exchanges a verified provider identity with the API using the internal key", async () => {
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.test");
    vi.stubEnv("INTERNAL_API_KEY", "server-only-test-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify(loginResponse({ access_token: "finadvisor-jwt" })),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      exchangeOAuthAccount(
        "google",
        {
          providerAccountId: "google-account-123",
          email: "owner@example.com",
          name: "Restaurant Owner",
          avatarUrl: "https://example.com/avatar.png",
          emailVerified: true
        },
        "investor"
      )
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
          provider_account_id: "google-account-123",
          email: "owner@example.com",
          name: "Restaurant Owner",
          avatar_url: "https://example.com/avatar.png",
          email_verified: true,
          role: "investor"
        }),
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Key": "server-only-test-key"
        }
      })
    );
  });

  it("surfaces failed API exchanges", async () => {
    vi.stubEnv("INTERNAL_API_KEY", "server-only-test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 503 }))
    );

    await expect(
      exchangeOAuthAccount("facebook", {
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
      exchangeOAuthAccount("google", {
        providerAccountId: "google-account-123",
        email: "owner@example.com",
        name: "Restaurant Owner",
        avatarUrl: null,
        emailVerified: false
      })
    ).rejects.toThrow("OAuth exchange is not configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("role onboarding", () => {
  it("handles NextAuth session updates by saving the role first", async () => {
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.test");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ role: "investor" }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const callback = authOptions.callbacks?.jwt;
    if (!callback) {
      throw new Error("NextAuth JWT callback is not configured");
    }

    const updated = await callback({
      token: {
        accessToken: "active-access-token",
        role: "tadbirkor",
        needsRole: true
      },
      trigger: "update",
      session: { role: "investor" },
      user: {
        id: "user-123",
        email: "owner@example.com",
        emailVerified: null
      },
      account: null,
      profile: undefined,
      isNewUser: false
    });

    expect(updated).toMatchObject({ role: "investor", needsRole: false });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("persists a supported role before clearing the onboarding flag", async () => {
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.test");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ role: "investor" }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const token: JWT = {
      sub: "user-123",
      accessToken: "active-access-token",
      role: "tadbirkor",
      needsRole: true
    };

    const updated = await updateUserRole(token, "investor");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finadvisor.test/me",
      expect.objectContaining({
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer active-access-token"
        },
        body: JSON.stringify({ role: "investor" })
      })
    );
    expect(updated).toMatchObject({
      role: "investor",
      needsRole: false
    });
  });

  it("keeps onboarding required when the profile API rejects the update", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 403 }))
    );
    const token: JWT = {
      accessToken: "active-access-token",
      role: "tadbirkor",
      needsRole: true
    };

    const updated = await updateUserRole(token, "investor");

    expect(updated).toMatchObject({
      role: "tadbirkor",
      needsRole: true,
      roleUpdateError: "RoleUpdateError"
    });
  });

  it("does not change an already-completed account through session updates", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const token: JWT = { role: "tadbirkor", needsRole: false };

    await expect(updateUserRole(token, "investor")).resolves.toBe(token);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("NextAuth callbacks", () => {
  it("stores the OAuth tokens and role-onboarding state in the JWT", async () => {
    vi.stubEnv("INTERNAL_API_KEY", "server-only-test-key");
    cookieGet.mockReturnValue({ value: "investor" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify(
            loginResponse({
              access_token: accessToken(),
              refresh_token: "oauth-refresh-token",
              is_new: true,
              user: {
                id: "oauth-user-123",
                email: "owner@example.com",
                name: "Restaurant Owner",
                role: "investor"
              }
            })
          ),
          { status: 200 }
        )
      )
    );
    const callback = authOptions.callbacks?.jwt;
    if (!callback) {
      throw new Error("NextAuth JWT callback is not configured");
    }
    const profile = {
      sub: "google-account-123",
      email_verified: true
    };

    const token = await callback({
      token: {},
      user: {
        id: "oauth-user-123",
        email: "owner@example.com",
        name: "Restaurant Owner"
      },
      account: {
        provider: "google",
        providerAccountId: "google-account-123",
        type: "oauth"
      },
      profile,
      trigger: "signIn",
      isNewUser: true
    });

    expect(token).toMatchObject({
      sub: "oauth-user-123",
      role: "investor",
      accessTokenExpires: expect.any(Number),
      accessToken: expect.any(String),
      refreshToken: "oauth-refresh-token",
      needsRole: true
    });
    expect(cookieDelete).toHaveBeenCalledWith("finadvisor_oauth_role");
  });

  it("returns the access token and needsRole without exposing the refresh token", async () => {
    const callback = authOptions.callbacks?.session;
    if (!callback) {
      throw new Error("NextAuth session callback is not configured");
    }

    const session = await callback({
      session: {
        needsRole: false,
        expires: new Date(Date.now() + 60_000).toISOString(),
        user: {
          id: "oauth-user-123",
          name: "Restaurant Owner",
          email: "owner@example.com",
          image: null
        }
      },
      token: {
        sub: "oauth-user-123",
        role: "investor",
        accessToken: "finadvisor-access-token",
        refreshToken: "private-refresh-token",
        needsRole: true
      },
      user: {
        id: "oauth-user-123",
        email: "owner@example.com",
        emailVerified: null
      },
      newSession: {},
      trigger: "update"
    });

    expect(session).toMatchObject({
      accessToken: "finadvisor-access-token",
      needsRole: true,
      user: { id: "oauth-user-123", role: "investor" }
    });
    expect(session).not.toHaveProperty("refreshToken");
  });

  it("refreshes expiring access tokens and rotates the refresh token", async () => {
    vi.stubEnv("FINADVISOR_API_URL", "https://api.finadvisor.test");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify(
          loginResponse({
            access_token: accessToken(),
            refresh_token: "rotated-refresh-token",
            user: {
              id: "user-123",
              email: "owner@example.com",
              name: "Restaurant Owner",
              role: "buxgalter"
            }
          })
        ),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const token: JWT = {
      sub: "user-123",
      role: "tadbirkor",
      accessToken: "expired-access-token",
      refreshToken: "previous-refresh-token",
      accessTokenExpires: 0,
      needsRole: false
    };

    const refreshed = await refreshAccessToken(token);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.finadvisor.test/auth/refresh",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ refresh_token: "previous-refresh-token" })
      })
    );
    expect(refreshed).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: "rotated-refresh-token",
      role: "buxgalter",
      needsRole: false,
      accessTokenExpires: expect.any(Number)
    });
    expect(refreshed).not.toHaveProperty("refreshError");
  });

  it("marks refresh failures so the session no longer exposes an access token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 401 }))
    );
    const token: JWT = {
      sub: "user-123",
      accessToken: "expired-access-token",
      refreshToken: "revoked-refresh-token",
      accessTokenExpires: 0
    };

    const refreshed = await refreshAccessToken(token);
    const sessionCallback = authOptions.callbacks?.session;
    if (!sessionCallback) {
      throw new Error("NextAuth session callback is not configured");
    }
    const session = await sessionCallback({
      session: {
        needsRole: false,
        expires: new Date(Date.now() + 60_000).toISOString(),
        user: {
          id: "user-123",
          name: "Restaurant Owner",
          email: "owner@example.com",
          image: null
        }
      },
      token: refreshed,
      user: {
        id: "user-123",
        email: "owner@example.com",
        emailVerified: null
      },
      newSession: {},
      trigger: "update"
    });

    expect(session).toMatchObject({
      accessToken: undefined,
      refreshError: "RefreshAccessTokenError"
    });
  });

  it("uses a locale-aware NextAuth sign-in path", () => {
    expect(authOptions.pages?.signIn).toBe("/login");
    expect(authOptions.pages?.signIn).not.toContain("/uz/");
  });
});
