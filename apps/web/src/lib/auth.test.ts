<<<<<<< HEAD
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
=======
import type { Profile, Session } from "next-auth";
import { afterEach, describe, expect, it, vi } from "vitest";

import { authOptions, exchangeOAuthAccount } from "./auth";

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: () => ({ value: "investor" }),
    delete: vi.fn()
  })
}));
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331

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
<<<<<<< HEAD
    vi.stubEnv("INTERNAL_API_KEY", "server-only-test-key");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify(loginResponse({ access_token: "finadvisor-jwt" })),
=======
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
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
<<<<<<< HEAD
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
=======
      exchangeOAuthAccount({
        provider: "google",
        providerAccountId: "google-account-123",
        email: "owner@example.com",
        name: "Restaurant Owner",
        avatarUrl: "https://example.com/avatar.png",
        emailVerified: true,
        role: "investor"
      })
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
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
        }),
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Key": "server-only-test-key"
        }
      })
    );
  });

  it("surfaces failed API exchanges", async () => {
<<<<<<< HEAD
    vi.stubEnv("INTERNAL_API_KEY", "server-only-test-key");
=======
    vi.stubEnv("INTERNAL_API_KEY", "internal-api-key");
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 503 }))
    );

    await expect(
<<<<<<< HEAD
      exchangeOAuthAccount("facebook", {
=======
      exchangeOAuthAccount({
        provider: "facebook",
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
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
<<<<<<< HEAD
      exchangeOAuthAccount("google", {
=======
      exchangeOAuthAccount({
        provider: "google",
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
        providerAccountId: "google-account-123",
        email: "owner@example.com",
        name: "Restaurant Owner",
        avatarUrl: null,
<<<<<<< HEAD
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
=======
        emailVerified: true
      })
    ).rejects.toThrow("INTERNAL_API_KEY must be configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stores the trusted OAuth result and marks new accounts for role onboarding", async () => {
    vi.stubEnv("INTERNAL_API_KEY", "internal-api-key");
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
<<<<<<< HEAD
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
=======
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
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
          { status: 200 }
        )
      )
    );
<<<<<<< HEAD
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
=======
    const jwtCallback = authOptions.callbacks?.jwt;
    if (!jwtCallback) throw new Error("JWT callback is required");

    const token = await jwtCallback({
      token: {},
      user: {
        id: "provider-user-123",
        name: "Restaurant Owner",
        email: "owner@example.com",
        image: "https://example.com/avatar.png"
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
      },
      account: {
        provider: "google",
        providerAccountId: "google-account-123",
        type: "oauth"
      },
<<<<<<< HEAD
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
=======
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
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
            user: {
              id: "user-123",
              email: "owner@example.com",
              name: "Restaurant Owner",
<<<<<<< HEAD
              role: "buxgalter"
            }
          })
        ),
=======
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
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
<<<<<<< HEAD
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
=======
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
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
  });
});
