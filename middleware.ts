import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "demonmc_session";

const PUBLIC_PAGES = new Set([
  "/",
  "/rules",
  "/announcements",
  "/store",
  "/apply",
  "/report",
]);

const PUBLIC_API = new Set([
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/auth/register",
  "/api/auth/forgot-password",
  "/api/auth/forgot-password/verify",
  "/api/auth/reset-password",
  "/api/auth/reset-password/verify",
  "/api/status",
  "/api/reports",
  "/api/reports/upload",
]);

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname === "/players" || pathname.startsWith("/players/")) {
    const home = req.nextUrl.clone();
    home.pathname = "/";
    home.search = "";
    return NextResponse.redirect(home);
  }

  if (
    PUBLIC_PAGES.has(pathname) ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    PUBLIC_API.has(pathname) ||
    pathname.startsWith("/api/brand/")
  ) {
    return NextResponse.next();
  }

  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/staff/login") {
    if (hasSession) return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", "/staff");
    return NextResponse.redirect(url);
  }

  if (hasSession) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next|images|icon|hero\\.png|favicon\\.ico|mc-avatar-default\\.svg).*)",
  ],
};
