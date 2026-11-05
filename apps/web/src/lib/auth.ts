import type { NextAuthOptions, User } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { cookies } from "next/headers";
import CredentialsProvider from "next-auth/providers/credentials";
import FacebookProvider from "next-auth/providers/facebook";
import GoogleProvider from "next-auth/providers/google";
import type { JWT } from "next-auth/jwt";
import { z } from "zod";

const loginResultSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
<<<<<<< HEAD
=======
  expires_in: z.number().int().positive(),
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
  is_new: z.boolean().optional(),
  user: z.object({
    id: z.string().min(1),
    email: z.string().email(),
    name: z.string(),
    role: z.enum(["tadbirkor", "buxgalter", "investor", "admin"]),
    needs_role: z.boolean().default(false)
  })
});

const accessTokenClaimsSchema = z.object({ exp: z.number() });
const roleUpdateSchema = z.object({
  role: z.enum(["tadbirkor", "buxgalter", "investor"])
});

type LoginResult = z.infer<typeof loginResultSchema>;
const currentUserSchema = z.object({
  email: z.string().email(),
  name: z.string(),
  role: z.enum(["tadbirkor", "buxgalter", "investor", "admin"]),
  needs_role: z.boolean()
});

type OAuthProvider = "google" | "facebook";
export type UserRole = "tadbirkor" | "buxgalter" | "investor";
export type SessionRole = UserRole | "admin";

<<<<<<< HEAD
type OAuthIdentity = {
=======
type OAuthAccountProfile = {
  provider: OAuthProvider;
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
  providerAccountId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  emailVerified: boolean;
<<<<<<< HEAD
};

type FinAdvisorUser = User & {
  role: UserRole;
  accessToken: string;
  refreshToken: string;
};

const refreshBufferMs = 30_000;

function getAccessTokenExpiresAt(accessToken: string): number {
  const payload = accessToken.split(".")[1];
  if (!payload) {
    throw new Error("Authentication service returned an invalid access token");
  }

  let claims: unknown;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch (error) {
    throw new Error("Authentication service returned an invalid access token", {
      cause: error
    });
  }
  return accessTokenClaimsSchema.parse(claims).exp * 1000;
}

function applyLoginResult(
  token: JWT,
  result: LoginResult,
  needsRole: boolean
): JWT {
  token.sub = result.user.id;
  token.role = result.user.role;
  token.accessToken = result.access_token;
  token.refreshToken = result.refresh_token;
  token.accessTokenExpires = getAccessTokenExpiresAt(result.access_token);
  token.needsRole = needsRole;
  delete token.refreshError;
  return token;
}

export async function refreshAccessToken(token: JWT): Promise<JWT> {
  if (!token.refreshToken) {
    return {
      ...token,
      accessToken: undefined,
      refreshError: "RefreshAccessTokenError"
    };
  }

  const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
  const response = await fetch(`${apiUrl}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: token.refreshToken }),
    cache: "no-store"
  });
  if (!response.ok) {
    return {
      ...token,
      accessToken: undefined,
      refreshToken: undefined,
      refreshError: "RefreshAccessTokenError"
    };
  }

  const result = loginResultSchema.parse(await response.json());
  return applyLoginResult(token, result, token.needsRole ?? false);
}

export async function updateUserRole(
  token: JWT,
  role: UserRole
): Promise<JWT> {
  if (token.needsRole !== true) {
    return token;
  }
  if (!token.accessToken) {
    throw new Error("Role onboarding requires an active access token");
  }

  const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
  const response = await fetch(`${apiUrl}/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token.accessToken}`
    },
    body: JSON.stringify({ role }),
    cache: "no-store"
  });
  if (!response.ok) {
    token.roleUpdateError = "RoleUpdateError";
    return token;
  }

  const profile = roleUpdateSchema.parse(await response.json());
  if (profile.role !== role) {
    throw new Error("Profile API returned a different role than requested");
  }
  token.role = profile.role;
  token.needsRole = false;
  delete token.roleUpdateError;
  return token;
}

export async function exchangeOAuthAccount(
  provider: OAuthProvider,
  identity: OAuthIdentity,
  role: UserRole = "tadbirkor"
=======
  role?: UserRole;
};

type FinAdvisorUser = User & {
  role: SessionRole;
  accessToken: string;
  refreshToken: string;
  accessTokenExpires: number;
  needsRole: boolean;
};

const refreshFailure = (token: JWT): JWT => ({
  ...token,
  accessToken: undefined,
  refreshToken: undefined,
  accessTokenExpires: 0,
  error: "RefreshAccessTokenError"
});

async function refreshAccessToken(token: JWT): Promise<JWT> {
  if (!token.refreshToken) {
    return refreshFailure(token);
  }

  const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: token.refreshToken }),
      cache: "no-store"
    });
  } catch (error) {
    if (error instanceof TypeError) {
      return refreshFailure(token);
    }
    throw error;
  }
  if (!response.ok) {
    return refreshFailure(token);
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return refreshFailure(token);
    }
    throw error;
  }
  const parsedResult = loginResultSchema.safeParse(responseBody);
  if (!parsedResult.success) {
    return refreshFailure(token);
  }

  const result = parsedResult.data;
  return {
    ...token,
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    accessTokenExpires: Date.now() + result.expires_in * 1000,
    needsRole: result.user.needs_role,
    error: undefined
  };
}

async function refreshSessionIdentity(token: JWT): Promise<JWT> {
  if (!token.accessToken) {
    throw new Error("Cannot refresh session identity without an access token");
  }
  const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
  const response = await fetch(`${apiUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${token.accessToken}` },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`Session identity refresh failed with status ${response.status}`);
  }
  const result = currentUserSchema.parse(await response.json());
  return {
    ...token,
    name: result.name,
    email: result.email,
    role: result.role,
    needsRole: result.needs_role,
    error: undefined
  };
}

export async function exchangeOAuthAccount(
  profile: OAuthAccountProfile
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
): Promise<LoginResult> {
  const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
  const internalKey = process.env.INTERNAL_API_KEY;
  if (!internalKey) {
<<<<<<< HEAD
    throw new Error("OAuth exchange is not configured");
=======
    throw new Error("INTERNAL_API_KEY must be configured for OAuth exchange");
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
  }
  const response = await fetch(`${apiUrl}/auth/oauth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Key": internalKey
    },
    body: JSON.stringify({
<<<<<<< HEAD
      provider,
      provider_account_id: identity.providerAccountId,
      email: identity.email,
      name: identity.name,
      avatar_url: identity.avatarUrl,
      email_verified: identity.emailVerified,
      role
=======
      provider: profile.provider,
      provider_account_id: profile.providerAccountId,
      email: profile.email,
      name: profile.name,
      avatar_url: profile.avatarUrl,
      email_verified: profile.emailVerified,
      role: profile.role ?? "tadbirkor"
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
    }),
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`OAuth exchange failed with status ${response.status}`);
  }

  return loginResultSchema.parse(await response.json());
}

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    name: "Email",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" }
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials.password) {
        return null;
      }

      const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        cache: "no-store"
      });

      if (response.status === 401 || response.status === 422) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`Authentication service returned ${response.status}`);
      }

      const result = loginResultSchema.parse(await response.json());
      return {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        accessToken: result.access_token,
<<<<<<< HEAD
        refreshToken: result.refresh_token
=======
        refreshToken: result.refresh_token,
        accessTokenExpires: Date.now() + result.expires_in * 1000,
        needsRole: result.user.needs_role
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
      } satisfies FinAdvisorUser;
    }
  })
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET
    })
  );
}

if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
  providers.push(
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET
    })
  );
}

export const authOptions: NextAuthOptions = {
  providers,
  secret: process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET,
  session: { strategy: "jwt" },
  callbacks: {
<<<<<<< HEAD
    async jwt({ token, user, account, profile, trigger, session }) {
=======
    async jwt({ token, user, account, profile, trigger }) {
      if (trigger === "update") {
        let currentToken = token;
        if (
          currentToken.accessTokenExpires &&
          Date.now() >= currentToken.accessTokenExpires - 60_000
        ) {
          currentToken = await refreshAccessToken(currentToken);
        }
        return refreshSessionIdentity(currentToken);
      }

>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
      if (
        account &&
        (account.provider === "google" || account.provider === "facebook")
      ) {
<<<<<<< HEAD
        if (!account.providerAccountId || !user?.email) {
          throw new Error("OAuth provider did not return a usable identity");
=======
        if (!user?.email || !account.providerAccountId) {
          throw new Error("OAuth provider did not return a verified account profile");
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
        }
        const cookieStore = cookies();
        const roleIntent = cookieStore.get("finadvisor_oauth_role")?.value;
        const role: UserRole =
          roleIntent === "buxgalter" || roleIntent === "investor"
            ? roleIntent
            : "tadbirkor";
        const emailVerified =
          account.provider === "google" &&
          profile !== undefined &&
          "email_verified" in profile &&
          profile.email_verified === true;
        let result: LoginResult;
        try {
<<<<<<< HEAD
          result = await exchangeOAuthAccount(
            account.provider,
            {
              providerAccountId: account.providerAccountId,
              email: user.email,
              name: user.name ?? user.email,
              avatarUrl: user.image ?? null,
              emailVerified:
                profile !== undefined &&
                "email_verified" in profile &&
                profile.email_verified === true
            },
=======
          result = await exchangeOAuthAccount({
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            email: user.email,
            name: user.name ?? user.email,
            avatarUrl: user.image ?? null,
            emailVerified,
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
            role
          });
        } finally {
          cookieStore.delete("finadvisor_oauth_role");
        }
<<<<<<< HEAD
        return applyLoginResult(token, result, result.is_new === true);
      }

      if (trigger === "update" && token.needsRole === true) {
        const roleUpdate = roleUpdateSchema.safeParse(session);
        if (roleUpdate.success) {
          return updateUserRole(token, roleUpdate.data.role);
        }
      }

      if (user) {
        const result = loginResultSchema.parse({
          access_token: user.accessToken,
          refresh_token: user.refreshToken,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role
          }
        });
        return applyLoginResult(token, result, false);
      }

      if (
        token.refreshError ||
        (typeof token.accessTokenExpires === "number" &&
          Date.now() < token.accessTokenExpires - refreshBufferMs)
=======
        token.sub = result.user.id;
        token.role = result.user.role;
        token.accessToken = result.access_token;
        token.refreshToken = result.refresh_token;
        token.accessTokenExpires = Date.now() + result.expires_in * 1000;
        token.needsRole = result.user.needs_role;
        return token;
      }

      if (user) {
        token.role = user.role;
        token.accessToken = user.accessToken;
        token.refreshToken = user.refreshToken;
        token.accessTokenExpires = user.accessTokenExpires;
        token.needsRole = user.needsRole;
      }

      if (
        token.accessTokenExpires &&
        Date.now() < token.accessTokenExpires - 60_000
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
      ) {
        return token;
      }
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role;
        session.user.name = token.name;
        session.user.email = token.email;
      }
<<<<<<< HEAD
      session.accessToken = token.refreshError ? undefined : token.accessToken;
      session.needsRole = token.needsRole ?? false;
      session.refreshError = token.refreshError;
      session.roleUpdateError = token.roleUpdateError;
=======
      session.accessToken = token.accessToken;
      session.needsRole = token.needsRole;
      session.error = token.error;
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
      return session;
    }
  },
  pages: {
    signIn: "/login"
  }
};
