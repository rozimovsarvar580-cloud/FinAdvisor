import { getToken } from "next-auth/jwt";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "./i18n/routing";
import { isSupportedLocale } from "./lib/locales";

const handleI18nRouting = createMiddleware(routing);
const rateLimitWindowMs = 60_000;
const maxRequestsPerWindow = 120;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function getClientKey(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwardedFor.split(",")[0]?.trim() || "unknown";
  return ip;
}

function enforceRateLimit(request: NextRequest) {
  const key = getClientKey(request);
  const now = Date.now();
  const entry = rateLimitBuckets.get(key);

  if (!entry || entry.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + rateLimitWindowMs });
    return false;
  }

  if (entry.count >= maxRequestsPerWindow) {
    return true;
  }

  entry.count += 1;
  return false;
}

export default async function middleware(request: NextRequest) {
  if (enforceRateLimit(request)) {
    const retryAfter = Math.max(1, Math.ceil((rateLimitBuckets.get(getClientKey(request))?.resetAt ?? Date.now()) - Date.now()) / 1000);
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(maxRequestsPerWindow),
          "X-RateLimit-Remaining": "0"
        }
      }
    );
  }

  const [, locale, ...segments] = request.nextUrl.pathname.split("/");
  const roleOnboarding = segments[0] === "onboarding" && segments[1] === "role";
  const protectedSection = segments[0] === "app" || segments[0] === "dashboard";
  if (locale && isSupportedLocale(locale)) {
    const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
    const token = secret ? await getToken({ req: request, secret }) : null;
    const legacyToken = request.cookies.get("finadvisor_token")?.value;
    if ((protectedSection || roleOnboarding) && !token && !legacyToken) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = `/${locale}/login`;
      loginUrl.search = "";
      loginUrl.searchParams.set(
        "callbackUrl",
        `${request.nextUrl.pathname}${request.nextUrl.search}`
      );
      return NextResponse.redirect(loginUrl);
    }
    if (token?.needsRole === true && !roleOnboarding) {
      const onboardingUrl = request.nextUrl.clone();
      onboardingUrl.pathname = `/${locale}/onboarding/role`;
      onboardingUrl.search = "";
      return NextResponse.redirect(onboardingUrl);
    }
    if (token && token.needsRole !== true && roleOnboarding) {
      const appUrl = request.nextUrl.clone();
      appUrl.pathname = `/${locale}/app`;
      appUrl.search = "";
      return NextResponse.redirect(appUrl);
    }
  }

  return handleI18nRouting(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"]
};
