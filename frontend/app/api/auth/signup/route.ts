import { NextResponse } from "next/server";

import { getEntraConfig } from "@/lib/entra";
import { clearSession } from "@/lib/session";
import { SITE_URL } from "@/lib/site-metadata";

export const dynamic = "force-dynamic";

// Starts the Entra sign-up flow directly (prompt=create). Do not route through
// Entra logout first — that shows a "pick an account to sign out" screen.
export async function GET() {
  const config = getEntraConfig();
  if (!config) {
    return NextResponse.redirect(new URL("/register?error=entra_not_configured", SITE_URL));
  }

  await clearSession();
  return NextResponse.redirect(new URL("/api/auth/login?screen=signup", SITE_URL));
}
