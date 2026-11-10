import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    needsRole?: boolean;
    error?: "RefreshAccessTokenError";
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role?: "tadbirkor" | "buxgalter" | "investor" | "admin";
      isDemo?: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role?: "tadbirkor" | "buxgalter" | "investor" | "admin";
    accessToken?: string;
    refreshToken?: string | null;
    accessTokenExpires?: number;
    needsRole?: boolean;
    isDemo?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "tadbirkor" | "buxgalter" | "investor" | "admin";
    accessToken?: string;
    refreshToken?: string | null;
    accessTokenExpires?: number;
    needsRole?: boolean;
    isDemo?: boolean;
    error?: "RefreshAccessTokenError";
  }
}
