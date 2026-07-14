import { NextResponse } from "next/server";

import { getEntraConfig, tokenUrl } from "@/lib/entra";
import { clearSession, getRefreshToken, setSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST() {
  const config = getEntraConfig();
  const refresh = await getRefreshToken();

  if (!config || !refresh) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = new URLSearchParams({
    client_id: config.webClientId,
    client_secret: config.webClientSecret,
    grant_type: "refresh_token",
    refresh_token: refresh,
    scope: `openid offline_access ${config.scope}`,
  });

  let tokens: { access_token: string; refresh_token?: string };
  try {
    const res = await fetch(tokenUrl(config), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      await clearSession();
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    tokens = await res.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 });
  }

  await setSession(tokens.access_token, tokens.refresh_token ?? refresh);
  return NextResponse.json({ ok: true });
}
