import { NextResponse } from "next/server";

import { endSessionUrl, getEntraConfig } from "@/lib/entra";
import { clearSession, getIdToken } from "@/lib/session";
import { SITE_URL } from "@/lib/site-metadata";

export const dynamic = "force-dynamic";

function postLogoutRedirectUri() {
  return process.env.ENTRA_POST_LOGOUT_REDIRECT_URI?.replace(/\/$/, "") || `${SITE_URL}/`;
}

/** Clears Beedero cookies and ends the Entra SSO session so the next signup is not auto-login. */
export async function GET() {
  const config = getEntraConfig();
  const idToken = await getIdToken();
  await clearSession();

  if (!config) {
    return NextResponse.redirect(new URL("/", SITE_URL));
  }

  const logoutUrl = new URL(endSessionUrl(config));
  logoutUrl.searchParams.set("client_id", config.webClientId);
  logoutUrl.searchParams.set("post_logout_redirect_uri", postLogoutRedirectUri());
  logoutUrl.searchParams.set("ui_locales", "en");
  if (idToken) {
    logoutUrl.searchParams.set("id_token_hint", idToken);
  }

  return NextResponse.redirect(logoutUrl);
}
