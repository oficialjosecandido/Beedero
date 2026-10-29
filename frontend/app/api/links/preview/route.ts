import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const ACCESS_COOKIE = "beedero_access";
const UPSTREAM_TIMEOUT_MS = 12_000;

function backendUrl() {
  return (process.env.BACKEND_URL ?? "http://localhost:8000/api").replace(/\/$/, "");
}

export async function GET(request: Request) {
  const jar = await cookies();
  const token = jar.get(ACCESS_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url).searchParams.get("url") ?? "";
  if (!url) {
    return NextResponse.json({ detail: "url is required." }, { status: 400 });
  }
  let res: Response;
  try {
    res = await fetch(`${backendUrl()}/links/preview/?url=${encodeURIComponent(url)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    return NextResponse.json({ detail: "Upstream service unavailable." }, { status: 502 });
  }
  const body = await res.text();
  const headers = new Headers({
    "Content-Type": res.headers.get("Content-Type") ?? "application/json",
  });
  // Ready rows are DB-cached server-side; let the browser reuse them briefly
  // so scrolling the same feed doesn't re-hit Django for every card remount.
  let ready = false;
  if (res.ok) {
    try {
      ready = (JSON.parse(body) as { status?: string }).status === "ready";
    } catch {
      ready = false;
    }
  }
  headers.set("Cache-Control", ready ? "private, max-age=300" : "no-store");
  return new NextResponse(body, {
    status: res.status,
    headers,
  });
}
