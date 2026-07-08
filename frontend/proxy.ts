import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Renamed from middleware.ts (Next.js 16, see AGENTS.md). Only guards
// presence of the session cookie — actual authorization is always
// re-checked server-side by the Django API on every request.
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("beedero_access");
  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/org/:path*", "/discovery/:path*", "/feed/:path*", "/invite/:path*"],
};
