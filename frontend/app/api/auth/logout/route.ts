import { NextResponse } from "next/server";

import { clearPendingConfirmation, clearPendingLink, clearSession } from "@/lib/session";
import { SITE_URL } from "@/lib/site-metadata";

export const dynamic = "force-dynamic";

/**
 * Signs out by dropping our cookies.
 *
 * Under Entra this also had to end an SSO session at the identity provider,
 * or the next "create account" would silently log back in as the same person.
 * Firebase email links have no such ambient session: nothing is signed in
 * until a fresh link is clicked, so clearing cookies is the whole job.
 */
export async function GET() {
  await clearSession();
  await clearPendingLink();
  await clearPendingConfirmation();
  return NextResponse.redirect(new URL("/", SITE_URL));
}
