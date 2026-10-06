import { getToken } from "next-auth/jwt";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "./i18n/routing";
import { isSupportedLocale } from "./lib/locales";

const handleI18nRouting = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  const [, locale, ...segments] = request.nextUrl.pathname.split("/");
  const protectedSection = segments[0] === "app" || segments[0] === "dashboard";
  if (locale && isSupportedLocale(locale) && protectedSection) {
    const secret = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;
    const token = secret ? await getToken({ req: request, secret }) : null;
    const legacyToken = request.cookies.get("finadvisor_token")?.value;
    if (!token && !legacyToken) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = `/${locale}/login`;
      loginUrl.search = "";
      loginUrl.searchParams.set(
        "callbackUrl",
        `${request.nextUrl.pathname}${request.nextUrl.search}`
      );
      return NextResponse.redirect(loginUrl);
    }
  }

  return handleI18nRouting(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"]
};
