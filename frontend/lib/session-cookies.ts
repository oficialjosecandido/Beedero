/** Names and options for the session cookies, in their own module because two
 * places write them through different APIs and must not drift: lib/session.ts
 * via next/headers `cookies()`, and proxy.ts via `NextResponse.cookies`. */

export const ACCESS_COOKIE = "beedero_access";
export const REFRESH_COOKIE = "beedero_refresh";

/** Firebase ID tokens are valid for exactly one hour. Expiring the cookie five
 * minutes early means proxy.ts refreshes on the way into a page, instead of
 * the API handing back a 401 halfway through rendering it. */
export const ACCESS_MAX_AGE = 60 * 55;

/** 90 days, sliding: renewed on every refresh, so an active user never hits
 * it. Firebase refresh tokens themselves don't expire — they're revoked by
 * sign-out, account deletion or a credential change — so this cookie is the
 * only thing that eventually logs an idle browser out. */
export const REFRESH_MAX_AGE = 60 * 60 * 24 * 90;

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
