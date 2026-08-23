import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SITE_URL } from "@/lib/site-metadata";

export const dynamic = "force-dynamic";

const FORCE_SIGNUP_COOKIE = "beedero_force_signup";

/** Resumes signup after Entra logout cleared the SSO session. */
export async function GET() {
  const store = await cookies();
  const force = store.get(FORCE_SIGNUP_COOKIE)?.value === "1";
  store.delete(FORCE_SIGNUP_COOKIE);

  if (force) {
    return NextResponse.redirect(new URL("/api/auth/login?screen=signup", SITE_URL));
  }
  return NextResponse.redirect(new URL("/register", SITE_URL));
}
