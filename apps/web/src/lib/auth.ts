import type { NextAuthOptions, User } from "next-auth";
import { cookies } from "next/headers";
import CredentialsProvider from "next-auth/providers/credentials";
import FacebookProvider from "next-auth/providers/facebook";
import GoogleProvider from "next-auth/providers/google";
import { z } from "zod";

const loginResultSchema = z.object({
  access_token: z.string().min(1),
  user: z.object({
    id: z.string().min(1),
    email: z.string().email(),
    name: z.string(),
    role: z.enum(["tadbirkor", "buxgalter", "investor"])
  })
});

type LoginResult = z.infer<typeof loginResultSchema>;

type OAuthProvider = "google" | "facebook";
export type UserRole = "tadbirkor" | "buxgalter" | "investor";

type FinAdvisorUser = User & {
  role: UserRole;
  accessToken: string;
};

export async function exchangeOAuthAccount(
  provider: OAuthProvider,
  accessToken: string,
  role: UserRole = "tadbirkor"
): Promise<LoginResult> {
  const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
  const response = await fetch(`${apiUrl}/auth/oauth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, access_token: accessToken, role }),
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
        accessToken: result.access_token
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
    async jwt({ token, user, account }) {
      if (
        account &&
        (account.provider === "google" || account.provider === "facebook")
      ) {
        if (!account.access_token) {
          throw new Error("OAuth provider did not return an access token");
        }
        const cookieStore = cookies();
        const roleIntent = cookieStore.get("finadvisor_oauth_role")?.value;
        const role: UserRole =
          roleIntent === "buxgalter" || roleIntent === "investor"
            ? roleIntent
            : "tadbirkor";
        let result: LoginResult;
        try {
          result = await exchangeOAuthAccount(
            account.provider,
            account.access_token,
            role
          );
        } finally {
          cookieStore.delete("finadvisor_oauth_role");
        }
        token.sub = result.user.id;
        token.role = result.user.role;
        token.accessToken = result.access_token;
        return token;
      }

      if (user) {
        token.role = user.role;
        token.accessToken = user.accessToken;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role;
      }
      session.accessToken = token.accessToken;
      return session;
    }
  },
  pages: {
    signIn: "/uz/login"
  }
};
