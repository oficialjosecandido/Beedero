import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { FirebaseAuthError, completeSignInWithEmailLink, safeNextPath } from "@/lib/firebase-auth";
import {
  clearPendingLink,
  readPendingLink,
  setPendingConfirmation,
} from "@/lib/session";
import { ACCESS_COOKIE, REFRESH_COOKIE, accessCookieAttrs, refreshCookieAttrs } from "@/lib/session-cookies";
import { SITE_URL } from "@/lib/site-metadata";

export const dynamic = "force-dynamic";

/**
 * Where a sign-in link lands.
 *
 * Two link shapes arrive here, and both must keep working:
 *
 *  - Ours. accounts/signin_link.py builds the emailed link itself — this path,
 *    with `state`, `next`, `mode` and `oobCode` as top-level params — so that
 *    every URL in a Beedero email is a beedero.com one.
 *  - Firebase's own action handler. Anything minted the other way (or by an
 *    older build) points at `<project>.firebaseapp.com/__/auth/action`, which
 *    for mode=signIn redirects here with `oobCode`, `mode` and `apiKey` appended
 *    to the `continueUrl` it was given — and may pass that `continueUrl` along
 *    as a param, with `state` and `next` nested inside it.
 *
 * Reading top-level first and falling back to the nested copy covers both, so
 * links already sitting in inboxes keep working across the change.
 *
 * After a successful redemption we land on /auth/continue rather than the app
 * destination directly. That page detects whether we're already inside the
 * installed PWA; if the email client opened a browser tab instead, it can
 * steer the user back into the app (Chromium) or explain the paste-in-app path
 * (iOS, where Home Screen apps have a separate cookie jar from Safari).
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("mode");
  const oobCode = params.get("oobCode");

  // Both of these are echoed back by a third party, so neither decides anything
  // beyond its own contents — `next` is narrowed to a path on this site before
  // it is ever used as a redirect target.
  let state = params.get("state");
  let next = params.get("next");
  const continueUrl = params.get("continueUrl");
  if (continueUrl && (state === null || next === null)) {
    try {
      const nested = new URL(continueUrl, SITE_URL).searchParams;
      state ??= nested.get("state");
      next ??= nested.get("next");
    } catch {
      // Malformed — fall through on whatever came in top-level.
    }
  }
  const destination = safeNextPath(next);

  const failure = (code: string) =>
    NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(code)}`, SITE_URL)
    );

  // Beedero only ever sends mode=signIn links. Anything else means this route
  // was hit by a link it doesn't handle.
  if (mode && mode !== "signIn") return failure("missing_code");
  if (!oobCode) return failure("missing_code");

  const pending = await readPendingLink();

  // State is checked only when this browser has a record of the send. A click
  // from a different device legitimately has no cookie — that's the branch
  // below, not a failure. A cookie that exists and disagrees IS a failure.
  if (pending.state && state && pending.state !== state) {
    await clearPendingLink();
    return failure("invalid_state");
  }

  if (!pending.email) {
    // Cross-device: Firebase needs the address back before it will redeem the
    // code, and only the person who typed it knows which one it was. Park the
    // code in an httpOnly cookie rather than the URL so it stays out of
    // history and out of any Referer header, and go ask.
    await setPendingConfirmation(oobCode);
    return NextResponse.redirect(
      new URL(`/login?confirm=1&next=${encodeURIComponent(destination)}`, SITE_URL)
    );
  }

  let idToken: string;
  let refreshToken: string;
  try {
    const session = await completeSignInWithEmailLink(pending.email, oobCode);
    idToken = session.idToken;
    refreshToken = session.refreshToken;
  } catch (err) {
    await clearPendingLink();
    if (err instanceof FirebaseAuthError) return failure(err.code);
    throw err;
  }

  await clearPendingLink();

  // Set cookies on the redirect response itself — more reliable than
  // cookies().set() followed by a separate NextResponse.redirect().
  const response = NextResponse.redirect(
    new URL(`/auth/continue?next=${encodeURIComponent(destination)}`, SITE_URL)
  );
  response.cookies.set(ACCESS_COOKIE, idToken, accessCookieAttrs());
  response.cookies.set(REFRESH_COOKIE, refreshToken, refreshCookieAttrs());
  return response;
}
