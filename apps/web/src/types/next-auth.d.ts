import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    needsRole: boolean;
    refreshError?: "RefreshAccessTokenError";
    roleUpdateError?: "RoleUpdateError";
    user: {
      id: string;
      role?: "tadbirkor" | "buxgalter" | "investor";
    } & DefaultSession["user"];
  }

  interface User {
    role?: "tadbirkor" | "buxgalter" | "investor";
    accessToken?: string;
    refreshToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "tadbirkor" | "buxgalter" | "investor";
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    needsRole?: boolean;
    refreshError?: "RefreshAccessTokenError";
    roleUpdateError?: "RoleUpdateError";
  }
}
