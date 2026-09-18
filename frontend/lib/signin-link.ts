import "server-only";

import { ApiError, BackendConfigError, publicPost } from "./api";
import { FirebaseAuthError } from "./firebase-auth";

/**
 * Asks the Django API to email a sign-in code and link.
 *
 * Sending used to happen here, straight to Identity Toolkit's
 * accounts:sendOobCode. It moved because of what Firebase puts in the envelope:
 * a `noreply@<project-id>.firebaseapp.com` sender and a firebaseapp.com link,
 * which Gmail files as spam. Django holds the service-account credential that
 * can mint a link without sending one, and already owns every other
 * transactional email, so the message now comes from Beedero's own domain.
 * See accounts/signin_link.py.
 *
 * Redemption stayed on the client-side key (lib/firebase-auth.ts) — it needs
 * the ID and refresh tokens back to set cookies, which is the public API key's
 * job, not the service account's.
 *
 * Errors come back as FirebaseAuthError so the sign-in page and the server
 * actions keep describing failures through one vocabulary (authErrorMessage),
 * regardless of which side of the wire produced them.
 */
export async function sendSignInLink(
  email: string,
  state: string,
  next: string
): Promise<void> {
  try {
    await publicPost("/auth/signin-link/", { email, state, next });
  } catch (err) {
    throw asAuthError(err);
  }
}

/**
 * Trades the six digits from the email for a Firebase oobCode.
 *
 * This is the path that works everywhere. A link can only sign in whichever
 * browser the mail app chooses to open, and on iOS that is Safari — which does
 * not share cookies with a Home Screen app. A code is typed into the window
 * that asked for it, so the session lands where the person actually is.
 *
 * The oobCode never reaches the browser: it comes back to this server module,
 * which redeems it through lib/firebase-auth.ts in the same request.
 */
export async function verifySignInCode(email: string, code: string): Promise<string> {
  let oobCode: string;
  try {
    const body = await publicPost<{ oobCode?: unknown }>("/auth/signin-code/verify/", {
      email,
      code,
    });
    oobCode = String(body?.oobCode ?? "");
  } catch (err) {
    throw asAuthError(err);
  }
  // A 200 with nothing in it means the API changed shape under us — an
  // operator problem, not a wrong code, so don't tell the visitor to retype.
  if (!oobCode) throw new FirebaseAuthError("unconfigured");
  return oobCode;
}

function asAuthError(err: unknown): FirebaseAuthError {
  // Neither a reachable backend nor a correct one: nothing the visitor can fix,
  // and nothing that should read as a problem with their address.
  if (err instanceof BackendConfigError) return new FirebaseAuthError("unconfigured");
  if (!(err instanceof ApiError)) return new FirebaseAuthError("network");

  const detail =
    typeof err.body === "object" && err.body !== null
      ? String((err.body as { detail?: unknown }).detail ?? "")
      : "";

  if (err.status === 429) return new FirebaseAuthError("TOO_MANY_ATTEMPTS_TRY_LATER");
  if (err.status === 400 && detail === "invalid_email") {
    return new FirebaseAuthError("INVALID_EMAIL");
  }
  // Wrong, expired, already used, or never issued — the API deliberately
  // doesn't say which, and neither does the message the visitor sees.
  if (err.status === 400 && detail === "invalid_code") {
    return new FirebaseAuthError("invalid_code");
  }
  // 503 is the API telling us it couldn't mint or hand off the link; a 400 for
  // anything but the address means this client sent a malformed request, which
  // is our bug, not the visitor's. Both are "try again shortly".
  return new FirebaseAuthError("unconfigured");
}
