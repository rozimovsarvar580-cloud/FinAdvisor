import { encode } from "next-auth/jwt";
import type { Page } from "@playwright/test";

export const e2eSessionSecret = "finadvisor-e2e-session-secret";

export async function installAuthenticatedSession(page: Page) {
  const token = await encode({
    secret: e2eSessionSecret,
    maxAge: 60 * 60,
    token: {
      sub: "accessibility-test-user",
      name: "Accessibility Test User",
      email: "accessibility@example.test",
      role: "tadbirkor",
      accessToken: "test-access-token",
      refreshToken: "test-refresh-token",
      accessTokenExpires: Date.now() + 60 * 60 * 1000,
      needsRole: false
    }
  });

  await page.context().addCookies([
    {
      name: "next-auth.session-token",
      value: token,
      url: "http://127.0.0.1:3000",
      httpOnly: true,
      sameSite: "Lax"
    }
  ]);
}
