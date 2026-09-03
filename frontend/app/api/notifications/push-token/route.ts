import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const ACCESS_COOKIE = "beedero_access";

function backendUrl() {
  return (process.env.BACKEND_URL ?? "http://localhost:8000/api").replace(/\/$/, "");
}

async function proxy(method: "POST" | "DELETE", body?: string) {
  const jar = await cookies();
  const token = jar.get(ACCESS_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }
  let res: Response;
  try {
    res = await fetch(`${backendUrl()}/notifications/push-token/`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ detail: "Upstream service unavailable." }, { status: 502 });
  }
  const responseBody = await res.text();
  return new NextResponse(responseBody, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}

export async function POST(request: Request) {
  const payload = await request.text();
  return proxy("POST", payload);
}

export async function DELETE(request: Request) {
  const payload = await request.text();
  return proxy("DELETE", payload || "{}");
}
