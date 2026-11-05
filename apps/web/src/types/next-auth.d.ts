import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
<<<<<<< HEAD
    needsRole: boolean;
    refreshError?: "RefreshAccessTokenError";
    roleUpdateError?: "RoleUpdateError";
=======
    needsRole?: boolean;
    error?: "RefreshAccessTokenError";
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role?: "tadbirkor" | "buxgalter" | "investor" | "admin";
    } & DefaultSession["user"];
  }

  interface User {
    role?: "tadbirkor" | "buxgalter" | "investor" | "admin";
    accessToken?: string;
    refreshToken?: string;
<<<<<<< HEAD
=======
    accessTokenExpires?: number;
    needsRole?: boolean;
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "tadbirkor" | "buxgalter" | "investor" | "admin";
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    needsRole?: boolean;
<<<<<<< HEAD
    refreshError?: "RefreshAccessTokenError";
    roleUpdateError?: "RoleUpdateError";
=======
    error?: "RefreshAccessTokenError";
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
  }
}
