import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Renamed from middleware.ts (Next.js 16, see AGENTS.md). Only guards
// presence of the session cookie — actual authorization is always
// re-checked server-side by the Django API on every request.

const ACCESS_COOKIE = "beedero_access";
const REFRESH_COOKIE = "beedero_refresh";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

function backendUrl() {
  return (process.env.BACKEND_URL ?? "http://localhost:8000/api").replace(/\/$/, "");
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export async function proxy(request: NextRequest) {
  if (request.cookies.has(ACCESS_COOKIE)) {
    return NextResponse.next();
  }

  // The access cookie is short-lived (30min) and routinely expires mid-visit.
  // Rather than bounce a still-valid session to /login, try the longer-lived
  // refresh cookie here — this mirrors apiFetch's tryRefresh(), but has to
  // live in the proxy: cookies can only be written from middleware or a
  // Server Action/Route Handler, never from a plain Server Component render,
  // so the page itself can't silently refresh on the way in.
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  if (refresh) {
    try {
      const res = await fetch(`${backendUrl()}/auth/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      if (res.ok) {
        const tokens: { access: string; refresh?: string } = await res.json();
        const response = NextResponse.next();
        response.cookies.set(ACCESS_COOKIE, tokens.access, { ...cookieOptions, maxAge: 60 * 30 });
        if (tokens.refresh) {
          response.cookies.set(REFRESH_COOKIE, tokens.refresh, {
            ...cookieOptions,
            maxAge: 60 * 60 * 24 * 7,
          });
        }
        return response;
      }
    } catch {
      // Backend unreachable — fall through to the login redirect below.
    }
  }

  return redirectToLogin(request);
}

export const config = {
  matcher: ["/dashboard/:path*", "/org/:path*", "/discovery/:path*", "/feed/:path*", "/invite/:path*"],
};
