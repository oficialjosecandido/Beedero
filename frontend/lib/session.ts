import "server-only";

import { cookies } from "next/headers";

import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE,
  sessionCookieOptions,
} from "./session-cookies";

// Written by the Entra-era session and never again. Still deleted on sign-out
// so a browser carrying one from before the Firebase cutover sheds it.
const LEGACY_ID_TOKEN_COOKIE = "beedero_id_token";

// --- Pending magic link ----------------------------------------------------
// Written when a sign-in link is sent, read when it's clicked. The email is
// not a convenience: Firebase requires it back at redemption time (see
// completeSignInWithEmailLink), and the state pairs a click with the send it
// came from.
const LINK_EMAIL_COOKIE = "beedero_link_email";
const LINK_STATE_COOKIE = "beedero_link_state";
// Set only on the cross-device path, where the click lands on a browser that
// never saw the send. Holds the one-time code while we ask for the address,
// so it stays out of the URL bar and out of browser history.
const LINK_CODE_COOKIE = "beedero_link_code";

// Firebase sign-in links are good for six hours. Matching that means a link
// that still works never drops a same-device user into the "which address was
// this?" prompt.
const LINK_MAX_AGE = 60 * 60 * 6;
// The cross-device prompt is answered in the moment or not at all.
const LINK_CODE_MAX_AGE = 60 * 15;

const linkCookieOptions = { ...sessionCookieOptions, maxAge: LINK_MAX_AGE };

// apiFetch()'s 401-retry path calls setSession()/clearSession() from plain
// Server Component renders (page.tsx), not just from Server Actions/Route
// Handlers. Next.js only allows cookie mutation in the latter two contexts
// and throws synchronously otherwise ("Cookies can only be modified in a
// Server Action or Route Handler") — swallow just that error so an in-render
// refresh still returns a usable token for the current request, even though
// it can't persist the new cookie until the next allowed context runs.
function isReadonlyCookiesError(err: unknown) {
  return err instanceof Error && err.message.includes("can only be modified in a Server Action");
}

export async function setSession(idToken: string, refreshToken: string) {
  const store = await cookies();
  try {
    store.set(ACCESS_COOKIE, idToken, { ...sessionCookieOptions, maxAge: ACCESS_MAX_AGE });
    store.set(REFRESH_COOKIE, refreshToken, {
      ...sessionCookieOptions,
      maxAge: REFRESH_MAX_AGE,
    });
  } catch (err) {
    if (!isReadonlyCookiesError(err)) throw err;
  }
}

export async function clearSession() {
  const store = await cookies();
  try {
    store.delete(ACCESS_COOKIE);
    store.delete(REFRESH_COOKIE);
    store.delete(LEGACY_ID_TOKEN_COOKIE);
  } catch (err) {
    if (!isReadonlyCookiesError(err)) throw err;
  }
}

export async function getAccessToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(REFRESH_COOKIE)?.value;
}

export async function isAuthenticated(): Promise<boolean> {
  return Boolean(await getAccessToken());
}

export async function setPendingLink(email: string, state: string) {
  const store = await cookies();
  store.set(LINK_EMAIL_COOKIE, email, linkCookieOptions);
  store.set(LINK_STATE_COOKIE, state, linkCookieOptions);
}

export async function readPendingLink(): Promise<{ email?: string; state?: string }> {
  const store = await cookies();
  return {
    email: store.get(LINK_EMAIL_COOKIE)?.value,
    state: store.get(LINK_STATE_COOKIE)?.value,
  };
}

export async function clearPendingLink() {
  const store = await cookies();
  store.delete(LINK_EMAIL_COOKIE);
  store.delete(LINK_STATE_COOKIE);
}

export async function setPendingConfirmation(oobCode: string) {
  const store = await cookies();
  store.set(LINK_CODE_COOKIE, oobCode, { ...sessionCookieOptions, maxAge: LINK_CODE_MAX_AGE });
}

export async function getPendingConfirmation(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(LINK_CODE_COOKIE)?.value;
}

export async function clearPendingConfirmation() {
  const store = await cookies();
  store.delete(LINK_CODE_COOKIE);
}
