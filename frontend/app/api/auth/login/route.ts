import { NextResponse } from "next/server";
import { SESSION_COOKIE, authPassword, sessionToken } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const password = String(formData.get("password") ?? "").trim();

    if (!password || password !== authPassword()) {
      return NextResponse.redirect(new URL("/login?error=1", request.url));
    }

    const token = await sessionToken();
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.set({
      name: SESSION_COOKIE,
      value: token,
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Auth error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
