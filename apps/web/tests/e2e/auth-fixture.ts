import { encode } from "next-auth/jwt";
import type { Page, Route } from "@playwright/test";

export const E2E_NEXTAUTH_SECRET =
  "playwright-only-nextauth-secret-not-for-deployments";
const sessionCookieName = "next-auth.session-token";
const e2eSession = {
  expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  user: {
    id: "playwright-owner",
    name: "Playwright Owner",
    email: "playwright@example.test",
    role: "tadbirkor" as const
  },
  accessToken: "playwright-api-token",
  needsRole: false
};

async function createSessionToken(): Promise<string> {
  return encode({
    token: {
      sub: e2eSession.user.id,
      name: e2eSession.user.name,
      email: e2eSession.user.email,
      role: e2eSession.user.role,
      accessToken: e2eSession.accessToken,
      refreshToken: "playwright-refresh-token",
      accessTokenExpires: Date.now() + 60 * 60 * 1000,
      needsRole: false
    },
    secret: E2E_NEXTAUTH_SECRET,
    maxAge: 60 * 60
  });
}

async function setSessionCookie(route: Route): Promise<void> {
  const token = await createSessionToken();
  const form = new URLSearchParams(route.request().postData() ?? "");
  const callbackUrl = new URL(
    form.get("callbackUrl") ?? "/en/app",
    "http://127.0.0.1:3000"
  ).toString();
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: {
      "Set-Cookie": `${sessionCookieName}=${token}; Path=/; HttpOnly; SameSite=Lax`
    },
    body: JSON.stringify({ url: callbackUrl })
  });
}

export async function mockCredentialsSignIn(page: Page): Promise<void> {
  let authenticated = false;
  await page.route("**/api/auth/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith("/session")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(authenticated ? e2eSession : null)
      });
    } else if (pathname.endsWith("/csrf")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ csrfToken: "playwright-csrf-token" })
      });
    } else if (pathname.endsWith("/providers")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          credentials: {
            id: "credentials",
            name: "Credentials",
            type: "credentials",
            signinUrl: "http://127.0.0.1:3000/api/auth/signin/credentials",
            callbackUrl: "http://127.0.0.1:3000/api/auth/callback/credentials"
          }
        })
      });
    } else if (pathname.includes("/credentials")) {
      authenticated = true;
      await setSessionCookie(route);
    } else {
      await route.fallback();
    }
  });
}

export async function installAuthenticatedSession(page: Page): Promise<void> {
  const token = await createSessionToken();
  await page.context().addCookies([
    {
      name: sessionCookieName,
      value: token,
      url: "http://127.0.0.1:3000",
      httpOnly: true,
      secure: false,
      sameSite: "Lax"
    }
  ]);
  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(e2eSession)
    });
  });
}
