import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getEntraConfig, tokenUrl } from "@/lib/entra";
import { setSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const OAUTH_COOKIE_NAMES = [
  "beedero_oidc_verifier",
  "beedero_oidc_state",
  "beedero_oidc_nonce",
  "beedero_oidc_next",
];

export async function GET(request: NextRequest) {
  const config = getEntraConfig();
  if (!config) {
    return NextResponse.redirect(new URL("/login?error=entra_not_configured", request.url));
  }

  const params = request.nextUrl.searchParams;
  const providerError = params.get("error");
  const code = params.get("code");
  const state = params.get("state");

  const store = await cookies();
  const expectedState = store.get("beedero_oidc_state")?.value;
  const verifier = store.get("beedero_oidc_verifier")?.value;
  const next = store.get("beedero_oidc_next")?.value || "/feed";
  for (const name of OAUTH_COOKIE_NAMES) store.delete(name);

  if (providerError) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(providerError)}`, request.url));
  }
  if (!code || !state || !verifier || state !== expectedState) {
    return NextResponse.redirect(new URL("/login?error=entra_invalid_state", request.url));
  }

  const body = new URLSearchParams({
    client_id: config.webClientId,
    client_secret: config.webClientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    code_verifier: verifier,
    scope: `openid offline_access ${config.scope}`,
  });

  let tokens: { access_token: string; refresh_token?: string };
  try {
    const res = await fetch(tokenUrl(config), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      return NextResponse.redirect(new URL("/login?error=entra_token_exchange_failed", request.url));
    }
    tokens = await res.json();
  } catch {
    return NextResponse.redirect(new URL("/login?error=entra_unreachable", request.url));
  }

  await setSession(tokens.access_token, tokens.refresh_token ?? "", "entra");
  return NextResponse.redirect(new URL(next, request.url));
}
