import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionFromToken } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

const PUBLIC_PATHS = ["/home", "/about", "/how-to-use"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get("host") ?? "";

  const rootDomain = process.env.ROOT_DOMAIN;
  const isRootDomain =
    !!rootDomain && (hostname === rootDomain || hostname === `www.${rootDomain}`);
  if (isRootDomain && pathname === "/") {
    return NextResponse.rewrite(new URL("/home", request.url));
  }

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await getSessionFromToken(token) : null;

  if (pathname.startsWith("/login")) {
    if (session) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.png$|api/telegram|api/webhook|api/feedback).*)",
  ],
};
