"use client";

import { useEffect, useState } from "react";

import { extractFirstUrl } from "@/lib/richtext";

type PreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "unavailable" }
  | {
      status: "ready";
      url: string;
      title: string;
      description: string;
      image_url: string;
      site_name: string;
    };

type PreviewPayload = {
  status?: string;
  url?: string;
  title?: string;
  description?: string;
  image_url?: string;
  site_name?: string;
};

async function fetchPreview(url: string): Promise<PreviewState> {
  const res = await fetch(`/api/links/preview?url=${encodeURIComponent(url)}`);
  if (!res.ok) return { status: "unavailable" };
  const data = (await res.json()) as PreviewPayload;
  if (data.status !== "ready" || !data.url) return { status: "unavailable" };
  return {
    status: "ready",
    url: data.url,
    title: data.title ?? "",
    description: data.description ?? "",
    image_url: data.image_url ?? "",
    site_name: data.site_name ?? "",
  };
}

/** Lazily unfurls the first http(s) link in a post/comment body into a rich
 * preview card (spec §A2). Fetched via a same-origin proxy backed by a
 * third-party unfurl service — Beedero's frontend/backend never fetch the
 * arbitrary user-supplied URL directly. Shows a short skeleton while loading
 * so the card doesn't appear to "pop in" only after a hard refresh. */
export function LinkPreviewCard({
  body,
  tone = "light",
}: {
  body?: string | null;
  tone?: "light" | "dark";
}) {
  const url = extractFirstUrl(body);
  const [state, setState] = useState<PreviewState>(url ? { status: "loading" } : { status: "idle" });

  useEffect(() => {
    if (!url) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });

    void (async () => {
      try {
        let next = await fetchPreview(url);
        // One quiet retry — first hit often races Microlink on cold URLs.
        if (!cancelled && next.status === "unavailable") {
          await new Promise((resolve) => setTimeout(resolve, 600));
          next = await fetchPreview(url);
        }
        if (!cancelled) setState(next);
      } catch {
        if (!cancelled) setState({ status: "unavailable" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!url || state.status === "idle" || state.status === "unavailable") return null;

  if (state.status === "loading") {
    return (
      <div
        className={`mt-2 flex animate-pulse gap-3 overflow-hidden rounded-xl border ${
          tone === "dark" ? "border-white/10 bg-white/[0.04]" : "border-beedero-border bg-zinc-50"
        }`}
        aria-hidden
      >
        <div className={`h-24 w-24 shrink-0 ${tone === "dark" ? "bg-white/10" : "bg-zinc-200"}`} />
        <div className="min-w-0 flex-1 space-y-2 py-3 pr-3">
          <div className={`h-2.5 w-24 ${tone === "dark" ? "bg-white/10" : "bg-zinc-200"}`} />
          <div className={`h-3.5 w-4/5 ${tone === "dark" ? "bg-white/15" : "bg-zinc-300"}`} />
          <div className={`h-2.5 w-3/5 ${tone === "dark" ? "bg-white/10" : "bg-zinc-200"}`} />
        </div>
      </div>
    );
  }

  return (
    <a
      href={state.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className={`mt-2 flex gap-3 overflow-hidden rounded-xl border transition ${
        tone === "dark"
          ? "border-white/15 bg-white/[0.06] hover:bg-white/[0.1]"
          : "border-beedero-border bg-zinc-50 hover:bg-zinc-100"
      }`}
    >
      {state.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          loading="lazy"
          src={state.image_url}
          alt=""
          className="h-24 w-24 shrink-0 object-cover"
        />
      )}
      <div className="min-w-0 flex-1 py-2 pr-3">
        <p
          className={`text-[11px] font-semibold uppercase tracking-wide ${
            tone === "dark" ? "text-white/40" : "text-subtle"
          }`}
        >
          {state.site_name || "External link"}
        </p>
        {state.title && (
          <p
            className={`mt-0.5 truncate text-sm font-semibold ${
              tone === "dark" ? "text-white" : "text-beedero-black"
            }`}
          >
            {state.title}
          </p>
        )}
        {state.description && (
          <p
            className={`mt-0.5 line-clamp-2 text-xs ${
              tone === "dark" ? "text-white/50" : "text-zinc-500"
            }`}
          >
            {state.description}
          </p>
        )}
      </div>
    </a>
  );
}

/** Warm the preview cache as soon as a URL is typed into the composer. */
export function prefetchLinkPreview(body: string) {
  const url = extractFirstUrl(body);
  if (!url || typeof window === "undefined") return;
  void fetch(`/api/links/preview?url=${encodeURIComponent(url)}`).catch(() => undefined);
}
