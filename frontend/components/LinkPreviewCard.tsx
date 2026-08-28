"use client";

import { useEffect, useState } from "react";

import { extractFirstUrl } from "@/lib/richtext";

type PreviewState =
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

/** Lazily unfurls the first http(s) link in a post/comment body into a rich
 * preview card (spec §A2). Fetched via a same-origin proxy backed by a
 * third-party unfurl service — Beedero's frontend/backend never fetch the
 * arbitrary user-supplied URL directly. Renders nothing on failure or while
 * there's no link, so it never disrupts the surrounding layout. */
export function LinkPreviewCard({ body }: { body?: string | null }) {
  const url = extractFirstUrl(body);
  const [state, setState] = useState<PreviewState>({ status: "loading" });

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    fetch(`/api/links/preview?url=${encodeURIComponent(url)}`)
      .then((res) => (res.ok ? res.json() : { status: "unavailable" }))
      .then((data) => {
        if (!cancelled) setState(data);
      })
      .catch(() => {
        if (!cancelled) setState({ status: "unavailable" });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!url || state.status !== "ready") return null;

  return (
    <a
      href={state.url}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="mt-2 flex gap-3 overflow-hidden rounded-xl border border-beedero-border bg-zinc-50 transition hover:bg-zinc-100"
    >
      {state.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img loading="lazy"
          src={state.image_url}
          alt=""
          className="h-24 w-24 shrink-0 object-cover"
        />
      )}
      <div className="min-w-0 flex-1 py-2 pr-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-subtle">
          {state.site_name || "External link"}
        </p>
        {state.title && (
          <p className="mt-0.5 truncate text-sm font-semibold text-beedero-black">{state.title}</p>
        )}
        {state.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">{state.description}</p>
        )}
      </div>
    </a>
  );
}
