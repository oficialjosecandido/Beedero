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
  const res = await fetch(`${backendUrl()}/contacts/`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}
