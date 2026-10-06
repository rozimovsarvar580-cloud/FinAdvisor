import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const protectedPath = request.nextUrl.pathname.includes("/dashboard") || request.nextUrl.pathname.includes("/app");
  if (protectedPath && !request.cookies.get("finadvisor_token")) {
    const login = new URL(`/${request.nextUrl.pathname.split("/")[1]}/login`, request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/:locale/dashboard/:path*", "/:locale/app/:path*"],
};
