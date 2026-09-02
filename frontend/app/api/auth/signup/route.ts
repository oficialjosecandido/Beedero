import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { endSessionUrl, getEntraConfig } from "@/lib/entra";
import { clearSession, getIdToken } from "@/lib/session";
import { SITE_URL } from "@/lib/site-metadata";

export const dynamic = "force-dynamic";

const FORCE_SIGNUP_COOKIE = "beedero_force_signup";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 120,
};

function postLogoutRedirectUri() {
  return process.env.ENTRA_POST_LOGOUT_REDIRECT_URI?.replace(/\/$/, "") || SITE_URL;
}

/**
 * Starts signup (Entra prompt=create).
 *
 * If the browser already has a Beedero session, clear Entra SSO first so
 * "Create account" is not silently auto-logged into the existing user.
 * Without a local session, skip logout — otherwise Entra shows a confusing
 * "select an account to sign out" page (often in the browser language).
 */
export async function GET() {
  const config = getEntraConfig();
  if (!config) {
    return NextResponse.redirect(new URL("/register?error=entra_not_configured", SITE_URL));
  }

  const idToken = await getIdToken();

  if (!idToken) {
    await clearSession();
    return NextResponse.redirect(new URL("/api/auth/login?screen=signup", SITE_URL));
  }

  await clearSession();

  const store = await cookies();
  store.set(FORCE_SIGNUP_COOKIE, "1", COOKIE_OPTS);

  const logoutUrl = new URL(endSessionUrl(config));
  logoutUrl.searchParams.set("client_id", config.webClientId);
  logoutUrl.searchParams.set("post_logout_redirect_uri", `${postLogoutRedirectUri()}/register`);
  logoutUrl.searchParams.set("ui_locales", "en");
  logoutUrl.searchParams.set("id_token_hint", idToken);

  return NextResponse.redirect(logoutUrl);
}
