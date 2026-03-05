import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, sessionToken } from "./lib/auth";

function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/api/auth/login") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/favicon.png"
  );
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  try {
    const expected = await sessionToken();
    const actual = request.cookies.get(SESSION_COOKIE)?.value ?? "";

    if (actual === expected) {
      return NextResponse.next();
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Auth configuration error" },
      { status: 500 },
    );
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const login = new URL("/login", request.url);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!.*\\..*).*)", "/api/:path*"],
};
