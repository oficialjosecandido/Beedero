import "server-only";

import { firebaseConfig } from "./firebase-config";

/**
 * Firebase Authentication over its REST API, called from the server only.
 *
 * Deliberately not the `firebase/auth` client SDK: the session model here is
 * httpOnly cookies set by the server (lib/session.ts), and pulling the SDK in
 * would ship ~90 KB of JS to every visitor to reach the same place. The REST
 * endpoints below are what the SDK itself calls.
 *
 * This module redeems links and refreshes sessions. *Sending* a link lives in
 * lib/signin-link.ts, which asks the Django API to do it — that side holds the
 * service-account credential needed to mint a link without Firebase mailing its
 * own unbranded version of it.
 *
 * The API key is the public Firebase Web API key (NEXT_PUBLIC_FIREBASE_API_KEY)
 * — it identifies the project, it isn't a secret, and nothing here needs a
 * service-account credential. That lives on the Django side, which verifies
 * the ID tokens this module obtains.
 */

const IDENTITY_TOOLKIT = "https://identitytoolkit.googleapis.com/v1";
const SECURE_TOKEN = "https://securetoken.googleapis.com/v1/token";
const TIMEOUT_MS = 10_000;

export type FirebaseSession = {
  idToken: string;
  refreshToken: string;
  /** True the first time an email signs in — no local row exists yet. */
  isNewUser: boolean;
};

/** Identity Toolkit's own error string, e.g. INVALID_OOB_CODE. `network` and
 * `unconfigured` are ours, for the two failures that never reach Google. */
export class FirebaseAuthError extends Error {
  code: string;

  constructor(code: string) {
    super(`Firebase auth error: ${code}`);
    this.name = "FirebaseAuthError";
    this.code = code;
  }
}

export function isFirebaseAuthConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey);
}

function apiKey(): string {
  if (!firebaseConfig.apiKey) throw new FirebaseAuthError("unconfigured");
  return firebaseConfig.apiKey;
}

async function post(url: string, init: RequestInit) {
  let res: Response;
  let text: string;
  try {
    // AbortSignal.timeout covers the body read too, not just the handshake —
    // a response that stalls mid-body still aborts.
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    text = await res.text();
  } catch {
    throw new FirebaseAuthError("network");
  }

  let body: { error?: { message?: string } } & Record<string, unknown>;
  try {
    body = JSON.parse(text);
  } catch {
    throw new FirebaseAuthError("network");
  }

  if (!res.ok) {
    // Google appends detail after a space ("INVALID_EMAIL : bad") — keep only
    // the code so callers can switch on it.
    const message = body.error?.message ?? "unknown";
    throw new FirebaseAuthError(message.split(/[\s:]/)[0] || "unknown");
  }
  return body;
}

function identityToolkit(method: string, payload: Record<string, unknown>) {
  return post(`${IDENTITY_TOOLKIT}/${method}?key=${encodeURIComponent(apiKey())}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/**
 * Redeems a clicked sign-in link.
 *
 * Both halves are required: the `oobCode` from the link and the email it was
 * sent to. That's Firebase's protection against a link read in transit — the
 * interceptor has the code but not the address the sender typed, so the code
 * alone is not a session.
 */
export async function completeSignInWithEmailLink(
  email: string,
  oobCode: string
): Promise<FirebaseSession> {
  const data = await identityToolkit("accounts:signInWithEmailLink", { email, oobCode });
  return {
    idToken: String(data.idToken ?? ""),
    refreshToken: String(data.refreshToken ?? ""),
    isNewUser: Boolean(data.isNewUser),
  };
}

/**
 * Trades a refresh token for a fresh ID token. Returns null when the refresh
 * token is no longer good (revoked, account deleted) — the caller's cue to
 * drop the session rather than retry.
 *
 * Different host and different casing from the endpoints above: securetoken
 * speaks form-encoded OAuth with snake_case fields, while identitytoolkit
 * speaks JSON with camelCase ones.
 */
export async function refreshFirebaseSession(
  refreshToken: string
): Promise<{ idToken: string; refreshToken: string } | null> {
  let body: Record<string, unknown>;
  try {
    body = await post(`${SECURE_TOKEN}?key=${encodeURIComponent(apiKey())}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
    });
  } catch (err) {
    // A network blip isn't proof the session is dead, so let it bubble; the
    // caller keeps the cookies and the next request tries again.
    if (err instanceof FirebaseAuthError && err.code === "network") throw err;
    return null;
  }

  const idToken = String(body.id_token ?? "");
  if (!idToken) return null;
  return { idToken, refreshToken: String(body.refresh_token ?? refreshToken) };
}

/** Opaque value tying a clicked link back to the request that sent it. */
export function randomState(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/** Cheap shape check — the real validation is whether the link arrives. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/**
 * Narrows a post-sign-in destination to a path on this site.
 *
 * The value travels through a query string and an emailed link, so it's
 * attacker-controllable: "//evil.com" and "https://evil.com" are both valid
 * `Location` values that leave the site, and an open redirect on a login route
 * is exactly the thing phishing wants.
 */
export function safeNextPath(value: string | undefined | null, fallback = "/feed"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

/** User-facing copy for a FirebaseAuthError code (and for the `?error=` values
 * the callback route redirects with). Lives here so the sign-in page and the
 * server actions can't describe the same failure two different ways. */
export function authErrorMessage(code: string): string;
export function authErrorMessage(code: string | undefined | null): string | null;
export function authErrorMessage(code: string | undefined | null): string | null {
  if (!code) return null;
  return (
    {
      unconfigured: "Sign-in isn't available right now. Please try again shortly.",
      network: "Couldn't reach the sign-in service. Please try again.",
      // Both mean the Firebase project itself hasn't had email-link sign-in
      // turned on — an operator problem, so don't blame the visitor.
      CONFIGURATION_NOT_FOUND: "Sign-in isn't available right now. Please try again shortly.",
      OPERATION_NOT_ALLOWED: "Sign-in isn't available right now. Please try again shortly.",
      INVALID_EMAIL: "That doesn't look like a valid email address.",
      INVALID_OOB_CODE: "That sign-in link is no longer valid — it may already have been used.",
      EXPIRED_OOB_CODE: "That sign-in link has expired. Request a new one below.",
      USER_DISABLED: "This account has been disabled. Contact us if you think that's a mistake.",
      TOO_MANY_ATTEMPTS_TRY_LATER: "Too many attempts. Wait a few minutes and try again.",
      invalid_state: "That sign-in link didn't match this browser's request. Request a new one below.",
      missing_code: "That link is incomplete. Request a new one below.",
    }[code] ?? "Sign-in failed. Please request a new link."
  );
}
