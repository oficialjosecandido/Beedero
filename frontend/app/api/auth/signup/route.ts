import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { endSessionUrl, getEntraConfig } from "@/lib/entra";
import { clearSession } from "@/lib/session";
import { SITE_URL } from "@/lib/site-metadata";

export const dynamic = "force-dynamic";

const SIGNUP_FLAG_COOKIE = "beedero_signup_after_logout";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 300,
};

// Ends any lingering Entra SSO session before starting signup OAuth. Without
// this, prompt=create is ignored when the browser still has a CIAM cookie and
// the user gets silently signed into their existing account instead of signup.
export async function GET() {
  const config = getEntraConfig();
  if (!config) {
    return NextResponse.redirect(new URL("/register?error=entra_not_configured", SITE_URL));
  }

  await clearSession();

  const store = await cookies();
  store.set(SIGNUP_FLAG_COOKIE, "1", COOKIE_OPTS);

  const siteUrl = SITE_URL.replace(/\/$/, "");
  const logoutUrl = new URL(endSessionUrl(config));
  logoutUrl.searchParams.set("client_id", config.webClientId);
  logoutUrl.searchParams.set("post_logout_redirect_uri", `${siteUrl}/login`);

  return NextResponse.redirect(logoutUrl);
}
