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
  sendSignInLink,
} from "./firebase-auth";
import {
  clearPendingConfirmation,
  clearPendingLink,
  getPendingConfirmation,
  setPendingLink,
  setSession,
} from "./session";
import { SITE_URL } from "./site-metadata";

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
  if (!isFirebaseAuthConfigured()) return { error: authErrorMessage("unconfigured") };

  // Both the landing route and the carrier for our own state: Firebase's action
  // handler redirects the click here, appending oobCode to the query below.
  // SITE_URL is what makes one Firebase project serve localhost and production
  // alike — the destination rides in the link, not in project settings.
  const continueUrl = new URL("/api/auth/callback", SITE_URL);
  const state = randomState();
  continueUrl.searchParams.set("state", state);
  continueUrl.searchParams.set("next", next);

  try {
    await sendSignInLink(email, continueUrl.toString());
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
