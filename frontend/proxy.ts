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

// Mirrors lib/entra.ts's getEntraConfig(), duplicated rather than imported:
// proxy.ts is edge middleware and intentionally self-contained, and
// lib/entra.ts uses node:crypto, which isn't guaranteed available in the
// edge runtime.
function entraTokenUrl(): string | null {
  const tenantId = process.env.ENTRA_TENANT_ID;
  const subdomain = process.env.ENTRA_TENANT_SUBDOMAIN;
  const customDomain = process.env.ENTRA_CUSTOM_DOMAIN;
  if (!tenantId || !(subdomain || customDomain)) return null;
  const authority = customDomain ? `https://${customDomain}` : `https://${subdomain}.ciamlogin.com`;
  return `${authority}/${tenantId}/oauth2/v2.0/token`;
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

async function refreshEntraSession(refresh: string) {
  const tokenUrl = entraTokenUrl();
  const clientId = process.env.ENTRA_WEB_CLIENT_ID;
  const clientSecret = process.env.ENTRA_WEB_CLIENT_SECRET;
  const scope = process.env.ENTRA_API_SCOPE;
  if (!tokenUrl || !clientId || !clientSecret || !scope) return null;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refresh,
    scope: `openid offline_access ${scope}`,
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return null;

  const tokens: { access_token: string; refresh_token?: string } = await res.json();
  const response = NextResponse.next();
  response.cookies.set(ACCESS_COOKIE, tokens.access_token, { ...cookieOptions, maxAge: 60 * 30 });
  response.cookies.set(REFRESH_COOKIE, tokens.refresh_token ?? refresh, {
    ...cookieOptions,
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

export async function proxy(request: NextRequest) {
  if (request.cookies.has(ACCESS_COOKIE)) {
    return NextResponse.next();
  }

  // The access cookie is short-lived (30min) and routinely expires mid-visit.
  // Rather than bounce a still-valid session to /login, try the longer-lived
  // refresh cookie here — this mirrors lib/api.ts's tryRefresh(), but has to
  // live in the proxy: cookies can only be written from middleware or a
  // Server Action/Route Handler, never from a plain Server Component render,
  // so the page itself can't silently refresh on the way in.
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  if (refresh) {
    try {
      const response = await refreshEntraSession(refresh);
      if (response) return response;
    } catch {
      // Entra unreachable — fall through to the login redirect below.
    }
  }

  return redirectToLogin(request);
}

export const config = {
  matcher: ["/dashboard/:path*", "/org/:path*", "/discovery/:path*", "/feed/:path*", "/invite/:path*"],
};
