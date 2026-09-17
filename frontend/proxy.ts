import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { refreshFirebaseSession } from "@/lib/firebase-auth";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  accessCookieAttrs,
  refreshCookieAttrs,
} from "@/lib/session-cookies";
import { SITE_URL } from "@/lib/site-metadata";

// Renamed from middleware.ts (Next.js 16, see AGENTS.md). Only guards
// presence of the session cookie — actual authorization is always
// re-checked server-side by the Django API on every request.

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL("/login", SITE_URL);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

function withSessionCookies(
  response: NextResponse,
  idToken: string,
  refreshToken: string
) {
  response.cookies.set(ACCESS_COOKIE, idToken, accessCookieAttrs());
  response.cookies.set(REFRESH_COOKIE, refreshToken, refreshCookieAttrs());
  return response;
}

export async function proxy(request: NextRequest) {
  if (request.cookies.has(ACCESS_COOKIE)) {
    return NextResponse.next();
  }

  // The access cookie is deliberately shorter-lived than the Firebase ID token
  // inside it, so it routinely expires mid-visit. Rather than bounce a
  // still-valid session to /login, trade the longer-lived refresh cookie here.
  // This has to live in the proxy: cookies can only be written from a proxy or
  // a Server Action/Route Handler, never from a plain Server Component render,
  // so the page itself can't silently refresh on the way in. lib/api.ts does
  // the same thing from the other side, for calls that 401 mid-render.
  //
  // Unlike the Entra version this replaces, it imports the shared helper
  // rather than re-implementing the call: proxy files run in the Node.js
  // runtime as of Next 16, and lib/firebase-auth.ts is plain fetch anyway.
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  if (refresh) {
    try {
      const tokens = await refreshFirebaseSession(refresh);
      if (tokens) {
        return withSessionCookies(NextResponse.next(), tokens.idToken, tokens.refreshToken);
      }
      // Refresh token revoked / invalid — fall through to login.
    } catch {
      // Firebase unreachable. A network blip is not a logged-out user: keep
      // the refresh cookie and let the request through so apiFetch can retry
      // the refresh from the page render. Bouncing to /login here is what made
      // overnight opens feel like the session had died.
      return NextResponse.next();
    }
  }

  return redirectToLogin(request);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/org/:path*",
    "/discovery/:path*",
    "/jobs/:path*",
    "/feed/:path*",
    "/invite/:path*",
    "/network/:path*",
    "/messages/:path*",
    "/notifications/:path*",
    "/connections/:path*",
  ],
};
