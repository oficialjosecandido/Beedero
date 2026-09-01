import { NextResponse } from "next/server";

function backendUrl() {
  return (process.env.BACKEND_URL ?? "http://localhost:8000/api").replace(/\/$/, "");
}

export async function POST(request: Request) {
  let path = "/";
  try {
    const body = (await request.json()) as { path?: string };
    if (typeof body.path === "string" && body.path.startsWith("/")) {
      path = body.path;
    }
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const forwardedFor = request.headers.get("x-forwarded-for");
  const userAgent = request.headers.get("user-agent");
  if (forwardedFor) headers["X-Forwarded-For"] = forwardedFor;
  if (userAgent) headers["User-Agent"] = userAgent;

  try {
    const res = await fetch(`${backendUrl()}/analytics/pageview/`, {
      method: "POST",
      headers,
      body: JSON.stringify({ path }),
      cache: "no-store",
    });
    return new NextResponse(null, { status: res.status === 204 ? 204 : res.status });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
