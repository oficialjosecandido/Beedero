import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const ACCESS_COOKIE = "beedero_access";

function backendUrl() {
  return (process.env.BACKEND_URL ?? "http://localhost:8000/api").replace(/\/$/, "");
}

export async function GET() {
  const jar = await cookies();
  const token = jar.get(ACCESS_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const headers = { Authorization: `Bearer ${token}` };
  const [meRes, orgsRes] = await Promise.all([
    fetch(`${backendUrl()}/auth/me/`, { headers, cache: "no-store" }),
    fetch(`${backendUrl()}/orgs/`, { headers, cache: "no-store" }),
  ]);

  if (!meRes.ok) {
    const body = await meRes.text();
    return new NextResponse(body, {
      status: meRes.status,
      headers: { "Content-Type": meRes.headers.get("Content-Type") ?? "application/json" },
    });
  }

  const me = await meRes.json();
  const orgs = orgsRes.ok ? await orgsRes.json() : [];

  return NextResponse.json({ me, orgs });
}
