import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const ACCESS_COOKIE = "beedero_access";

function backendUrl() {
  return (process.env.BACKEND_URL ?? "http://localhost:8000/api").replace(/\/$/, "");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const jar = await cookies();
  const token = jar.get(ACCESS_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }
  const search = new URL(request.url).search;
  let res: Response;
  try {
    res = await fetch(`${backendUrl()}/conversations/${id}/messages/${search}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ detail: "Upstream service unavailable." }, { status: 502 });
  }
  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const jar = await cookies();
  const token = jar.get(ACCESS_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }
  const payload = await request.text();
  let res: Response;
  try {
    res = await fetch(`${backendUrl()}/conversations/${id}/messages/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: payload,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ detail: "Upstream service unavailable." }, { status: 502 });
  }
  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}
