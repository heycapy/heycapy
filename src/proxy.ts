import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

const PUBLIC_PATHS = ["/r"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (pathname.startsWith("/login")) {
    if (session) return NextResponse.redirect(new URL("/", request.url));
    return withoutStaleCookie(NextResponse.next(), token);
  }

  if (!session) {
    return withoutStaleCookie(NextResponse.redirect(new URL("/login", request.url)), token);
  }

  return NextResponse.next();
}

// A revoked or expired session: drop it so the browser stops sending it
function withoutStaleCookie(response: NextResponse, token: string | undefined): NextResponse {
  if (token) response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js$|manifest\\.webmanifest$|opengraph-image|.*\\.png$|api/telegram|api/webhook|api/reminder-action|api/feedback|api/e2e|api/health).*)",
  ],
};
