import { NextResponse } from "next/server";

import { FirebaseAuthError, refreshFirebaseSession } from "@/lib/firebase-auth";
import { clearSession, getAccessToken, getRefreshToken, setSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Skip Google when the access cookie still has plenty of life — SessionRefresh
 * fires on every cold shell + tab focus, and a full securetoken round-trip was
 * adding ~1.5s to first paint for no session gain. */
const SKIP_IF_MORE_THAN_MS = 10 * 60 * 1000;

function accessExpiresAtMs(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: unknown };
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const force = new URL(request.url).searchParams.get("force") === "1";
  if (!force) {
    const access = await getAccessToken();
    if (access) {
      const expiresAt = accessExpiresAtMs(access);
      if (expiresAt && expiresAt > Date.now() + SKIP_IF_MORE_THAN_MS) {
        return NextResponse.json({ ok: true, refreshed: false });
      }
    }
  }

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
  return NextResponse.json({ ok: true, refreshed: true });
}
