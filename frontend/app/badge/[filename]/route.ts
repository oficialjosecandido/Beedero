import { NextRequest, NextResponse } from "next/server";

import { getBackendRoot } from "@/lib/backend-root";

type Params = { params: Promise<{ filename: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { filename } = await params;

  if (filename.endsWith(".svg")) {
    const slug = filename.slice(0, -".svg".length);
    const upstream = await fetch(`${getBackendRoot()}/api/public/badge/${encodeURIComponent(slug)}/svg/`, {
      next: { revalidate: 3600 },
    });
    if (!upstream.ok) {
      return new NextResponse(upstream.statusText, { status: upstream.status });
    }
    const svg = await upstream.text();
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  if (filename.endsWith(".json")) {
    const slug = filename.slice(0, -".json".length);
    const upstream = await fetch(`${getBackendRoot()}/api/public/badge/${encodeURIComponent(slug)}/json/`, {
      next: { revalidate: 3600 },
    });
    if (!upstream.ok) {
      return NextResponse.json({ detail: "Not found" }, { status: upstream.status });
    }
    const data = await upstream.json();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=3600" },
    });
  }

  return NextResponse.json({ detail: "Not found" }, { status: 404 });
}
