import { NextResponse } from "next/server";

import { FirebaseAuthError, refreshFirebaseSession } from "@/lib/firebase-auth";
import { clearSession, getRefreshToken, setSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST() {
  const refresh = await getRefreshToken();
  if (!refresh) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let tokens;
  try {
    tokens = await refreshFirebaseSession(refresh);
  } catch (err) {
    // Reaching Firebase failed. Leave the cookies alone — a blip is not a
    // revoked session — and let the caller retry.
    if (err instanceof FirebaseAuthError && err.code === "network") {
      return NextResponse.json({ ok: false }, { status: 502 });
    }
    throw err;
  }

  if (!tokens) {
    await clearSession();
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  await setSession(tokens.idToken, tokens.refreshToken);
  return NextResponse.json({ ok: true });
}
