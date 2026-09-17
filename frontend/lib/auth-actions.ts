"use server";

import { redirect } from "next/navigation";

import { ApiError, apiFetch } from "./api";
import {
  FirebaseAuthError,
  authErrorMessage,
  completeSignInWithEmailLink,
  isFirebaseAuthConfigured,
  looksLikeEmail,
  randomState,
  safeNextPath,
} from "./firebase-auth";
import { sendSignInLink } from "./signin-link";
import {
  clearPendingConfirmation,
  clearPendingLink,
  getPendingConfirmation,
  readPendingLink,
  setPendingLink,
  setSession,
} from "./session";

/** `sent` carries the address back so the page can say where the link went. */
export type SignInState = { sent?: string; error?: string } | null;

function errorFrom(err: unknown): string {
  if (err instanceof FirebaseAuthError) return authErrorMessage(err.code);
  throw err;
}

/**
 * Emails a sign-in link.
 *
 * The reply is the same whether or not the address has an account — Firebase
 * creates the user on first redemption, not here — so this can't be used to
 * probe who's a member.
 */
export async function sendSignInLinkAction(
  _prev: SignInState,
  formData: FormData
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeNextPath(String(formData.get("next") ?? ""));

  if (!looksLikeEmail(email)) return { error: "Enter a valid email address." };
  // Sending no longer needs the public API key — the API mints the link with
  // its service account — but redeeming the click does. Checking here means a
  // frontend missing its config says so now, rather than mailing a link that
  // can't be completed when it lands.
  if (!isFirebaseAuthConfigured()) return { error: authErrorMessage("unconfigured") };

  // `state` pairs the click with this send; the API puts it, and `next`, into
  // the link it builds. Both come back as query params on /api/auth/callback.
  const state = randomState();

  try {
    await sendSignInLink(email, state, next);
  } catch (err) {
    return { error: errorFrom(err) };
  }

  // Only once the link is actually out: a failed send shouldn't leave the
  // browser primed to complete a sign-in that was never started. Also drops
  // any half-finished cross-device prompt, so the page shows the new state.
  await setPendingLink(email, state);
  await clearPendingConfirmation();
  return { sent: email };
}

/**
 * Completes a sign-in whose link was opened on a different device or browser
 * from the one that requested it — there, nothing local knows the address, and
 * Firebase won't redeem the code without it.
 */
export async function confirmSignInAction(
  _prev: SignInState,
  formData: FormData
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeNextPath(String(formData.get("next") ?? ""));
  const oobCode = await getPendingConfirmation();

  if (!oobCode) return { error: authErrorMessage("EXPIRED_OOB_CODE") };
  if (!looksLikeEmail(email)) return { error: "Enter a valid email address." };

  let session;
  try {
    session = await completeSignInWithEmailLink(email, oobCode);
  } catch (err) {
    return { error: errorFrom(err) };
  }

  await setSession(session.idToken, session.refreshToken);
  await clearPendingConfirmation();
  await clearPendingLink();
  // Outside the try: redirect() signals by throwing, and catching it here
  // would turn a successful sign-in into an error message.
  redirect(`/auth/continue?next=${encodeURIComponent(next)}`);
}

/**
 * Redeems a magic link the user pasted into the PWA.
 *
 * iOS Home Screen apps have a separate cookie jar from Safari, so tapping the
 * emailed link signs the *browser* in and leaves the installed app logged out.
 * Pasting the same URL back into the app completes sign-in in the right store.
 */
export async function completePastedLinkAction(
  _prev: SignInState,
  formData: FormData
): Promise<SignInState> {
  const raw = String(formData.get("link") ?? "").trim();
  const nextFallback = safeNextPath(String(formData.get("next") ?? ""));

  let oobCode: string | null = null;
  let state: string | null = null;
  let next = nextFallback;

  try {
    // Accept a full URL or a bare query string someone copied incompletely.
    const url = raw.includes("://")
      ? new URL(raw)
      : new URL(raw.startsWith("?") ? raw : `?${raw}`, "https://beedero.local");
    oobCode = url.searchParams.get("oobCode");
    state = url.searchParams.get("state");
    next = safeNextPath(url.searchParams.get("next") ?? nextFallback);
  } catch {
    return { error: "That doesn't look like a Beedero sign-in link." };
  }

  if (!oobCode) {
    return { error: "That link is missing its sign-in code. Copy the full link from the email." };
  }

  const pending = await readPendingLink();
  if (!pending.email) {
    return {
      error: "Request a sign-in link from this app first, then paste the email link here.",
    };
  }
  if (pending.state && state && pending.state !== state) {
    await clearPendingLink();
    return { error: authErrorMessage("invalid_state") };
  }

  let session;
  try {
    session = await completeSignInWithEmailLink(pending.email, oobCode);
  } catch (err) {
    return { error: errorFrom(err) };
  }

  await setSession(session.idToken, session.refreshToken);
  await clearPendingLink();
  await clearPendingConfirmation();
  redirect(next);
}

export async function logoutAction() {
  // A Route Handler rather than clearing cookies inline, so that DELETE-account
  // and sign-out land on the same one path.
  redirect("/api/auth/logout");
}

export async function deleteAccountAction(_prevState: string | null, formData: FormData) {
  if (String(formData.get("confirmation") ?? "") !== "DELETE") {
    return "Type DELETE to confirm.";
  }
  try {
    await apiFetch("/auth/me/", { method: "DELETE" });
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    return "Could not delete your account. Try again in a moment.";
  }
  redirect("/api/auth/logout");
}
