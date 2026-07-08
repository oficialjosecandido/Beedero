import { NextResponse } from "next/server";

import { ApiError, ApiTimeoutError, anonFetch } from "@/lib/api";
import { setSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email ?? "");
  const password = String(body?.password ?? "");

  if (!email || !password) {
    return NextResponse.json({ detail: "Email and password are required." }, { status: 400 });
  }

  try {
    const tokens: { access: string; refresh: string } = await anonFetch("/auth/token/", {
      email,
      password,
    });
    await setSession(tokens.access, tokens.refresh);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof ApiTimeoutError) {
      return NextResponse.json(
        { detail: "Login is taking too long. Please try again." },
        { status: 504 }
      );
    }
    if (err instanceof ApiError) {
      return NextResponse.json({ detail: "Invalid credentials." }, { status: 401 });
    }
    throw err;
  }
}
