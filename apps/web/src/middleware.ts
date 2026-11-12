import { getToken } from "next-auth/jwt";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "./i18n/routing";
import { isSupportedLocale } from "./lib/locales";

const handleI18nRouting = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  const [, locale, ...segments] = request.nextUrl.pathname.split("/");
  const roleOnboardingRoute =
    segments[0] === "onboarding" && segments[1] === "role";
  const protectedSection =
    segments[0] === "app" ||
    segments[0] === "dashboard" ||
    segments[0] === "admin" ||
    roleOnboardingRoute;
  if (locale && isSupportedLocale(locale) && protectedSection) {
    const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
    const token = secret ? await getToken({ req: request, secret }) : null;
    if (!token) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = `/${locale}/login`;
      loginUrl.search = "";
      loginUrl.searchParams.set(
        "callbackUrl",
        `${request.nextUrl.pathname}${request.nextUrl.search}`
      );
      return NextResponse.redirect(loginUrl);
    }
    if (token?.needsRole === true && !roleOnboardingRoute) {
      const onboardingUrl = request.nextUrl.clone();
      onboardingUrl.pathname = `/${locale}/onboarding/role`;
      onboardingUrl.search = "";
      return NextResponse.redirect(onboardingUrl);
    }
    if (token && token.needsRole !== true && roleOnboardingRoute) {
      const appUrl = request.nextUrl.clone();
      appUrl.pathname = `/${locale}/app`;
      appUrl.search = "";
      return NextResponse.redirect(appUrl);
    }
    if (segments[0] === "admin" && token.role !== "admin") {
      const appUrl = request.nextUrl.clone();
      appUrl.pathname = `/${locale}/app`;
      appUrl.search = "";
      return NextResponse.redirect(appUrl);
    }
  }

  if (locale && isSupportedLocale(locale)) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("X-NEXT-INTL-LOCALE", locale);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    const localeCookie = routing.localeCookie;

    if (
      localeCookie &&
      typeof localeCookie === "object" &&
      request.cookies.get(localeCookie.name ?? "NEXT_LOCALE")?.value !== locale
    ) {
      response.cookies.set(localeCookie.name ?? "NEXT_LOCALE", locale, {
        path: "/",
        sameSite: localeCookie.sameSite ?? "lax",
        maxAge: 60 * 60 * 24 * 365,
        secure: request.nextUrl.protocol === "https:"
      });
    }

    return response;
  }

  return handleI18nRouting(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"]
};
