import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    user: {
      id: string;
      role?: "tadbirkor" | "buxgalter" | "investor";
    } & DefaultSession["user"];
  }

  interface User {
    role?: "tadbirkor" | "buxgalter" | "investor";
    accessToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: "tadbirkor" | "buxgalter" | "investor";
    accessToken?: string;
  }
}
