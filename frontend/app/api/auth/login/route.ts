import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { authorizeUrl, generatePkce, getEntraConfig, randomToken } from "@/lib/entra";
import { SITE_URL } from "@/lib/site-metadata";

export const dynamic = "force-dynamic";

const OAUTH_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 600, // the whole redirect round-trip should take seconds, not minutes
};

export async function GET(request: NextRequest) {
  const config = getEntraConfig();
  if (!config) {
    return NextResponse.redirect(new URL("/login?error=entra_not_configured", SITE_URL));
  }

  const next = request.nextUrl.searchParams.get("next") || "/feed";
  const screen = request.nextUrl.searchParams.get("screen"); // "signup" -> Entra prompt=create

  const { verifier, challenge } = generatePkce();
  const state = randomToken();
  const nonce = randomToken();

  const store = await cookies();
  store.set("beedero_oidc_verifier", verifier, OAUTH_COOKIE_OPTS);
  store.set("beedero_oidc_state", state, OAUTH_COOKIE_OPTS);
  store.set("beedero_oidc_nonce", nonce, OAUTH_COOKIE_OPTS);
  store.set("beedero_oidc_next", next, OAUTH_COOKIE_OPTS);
  if (screen === "signup") {
    store.set("beedero_oidc_screen", "signup", OAUTH_COOKIE_OPTS);
    store.delete("beedero_signup_after_logout");
  }

  const url = new URL(authorizeUrl(config));
  url.searchParams.set("client_id", config.webClientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", `openid offline_access ${config.scope}`);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("ui_locales", "en");
  if (screen === "signup") {
    url.searchParams.set("prompt", "create");
    url.searchParams.set("screen_hint", "signup");
  } else {
    url.searchParams.set("prompt", "login");
  }

  return NextResponse.redirect(url);
}
