"use client";

import { useEffect, useState } from "react";

import { extractFirstUrl } from "@/lib/richtext";

type PreviewReady = {
  status: "ready";
  url: string;
  title: string;
  description: string;
  image_url: string;
  site_name: string;
};

type PreviewState = { status: "loading" } | { status: "unavailable" } | PreviewReady;

/** `pending` means the unfurl is in flight server-side — poll, don't give up. */
type PreviewResult = PreviewReady | { status: "pending" } | { status: "unavailable" };
type ResolvedPreview = PreviewReady | { status: "unavailable" };

type PreviewPayload = {
  status?: string;
  url?: string;
  title?: string;
  description?: string;
  image_url?: string;
  site_name?: string;
};

/** Gaps between polls while the preview is pending. The unfurl happens off
 * the request thread (backend/social/unfurl.py) and the service gets up to
 * ten seconds to answer, so these start tight — a warm link is ready almost
 * at once — and spread out to cover that budget in six calls. */
const POLL_DELAYS_MS = [400, 800, 1500, 2500, 4000];

/** One in-flight poll loop per URL across every card on the page — without
 * this, ten posts linking the same article fire ten parallel proxy chains. */
const resolvedByUrl = new Map<string, ResolvedPreview>();
const inflightByUrl = new Map<string, Promise<ResolvedPreview>>();

async function fetchPreview(url: string): Promise<PreviewResult> {
  const res = await fetch(`/api/links/preview?url=${encodeURIComponent(url)}`);
  if (!res.ok) return { status: "unavailable" };
  const data = (await res.json()) as PreviewPayload;
  if (data.status === "pending") return { status: "pending" };
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

function resolvePreview(url: string): Promise<ResolvedPreview> {
  const cached = resolvedByUrl.get(url);
  if (cached) return Promise.resolve(cached);

  const existing = inflightByUrl.get(url);
  if (existing) return existing;

  const promise = (async (): Promise<ResolvedPreview> => {
    try {
      for (let attempt = 0; ; attempt += 1) {
        const next = await fetchPreview(url);
        if (next.status !== "pending") {
          resolvedByUrl.set(url, next);
          return next;
        }
        if (attempt >= POLL_DELAYS_MS.length) {
          // Out of patience for this mount. Don't cache: the next card can
          // retry once the background unfurl has finished.
          return { status: "unavailable" };
        }
        await new Promise((resolve) => setTimeout(resolve, POLL_DELAYS_MS[attempt]));
      }
    } finally {
      inflightByUrl.delete(url);
    }
  })();

  inflightByUrl.set(url, promise);
  return promise;
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
  if (!url) return null;
  // Remount when the URL changes so loading state resets without syncing in an effect.
  return <LinkPreviewCardInner key={url} url={url} tone={tone} />;
}

function LinkPreviewCardInner({ url, tone }: { url: string; tone: "light" | "dark" }) {
  const [state, setState] = useState<PreviewState>(() => resolvedByUrl.get(url) ?? { status: "loading" });

  useEffect(() => {
    let cancelled = false;
    const cached = resolvedByUrl.get(url);
    if (cached) {
      setState(cached);
      return;
    }

    void resolvePreview(url).then((next) => {
      if (!cancelled) setState(next);
    });

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (state.status === "unavailable") return null;

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

/** Warm the preview cache as soon as a URL is typed into the composer: this
 * queues the unfurl server-side, so by the time the post renders its card the
 * row is usually already ready. */
export function prefetchLinkPreview(body: string) {
  const url = extractFirstUrl(body);
  if (!url || typeof window === "undefined") return;
  void resolvePreview(url);
}
