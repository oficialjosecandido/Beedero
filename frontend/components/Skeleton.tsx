/** Base pulsing placeholder block. Respects prefers-reduced-motion globally
 * (see app/globals.css) — the pulse animation is stilled, not hidden, so the
 * content-shaped layout still communicates what's loading. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-zinc-100 ${className}`} />;
}

export function SkeletonText({ className = "h-3 w-full" }: { className?: string }) {
  return <Skeleton className={className} />;
}

export function SkeletonAvatar({ className = "size-11" }: { className?: string }) {
  return <Skeleton className={`shrink-0 rounded-full ${className}`} />;
}

/** Shaped like a feed/timeline post: avatar + name line + a couple of body
 * lines. Used wherever the real content is a list of post-like cards. */
export function SkeletonPostCard() {
  return (
    <div className="rounded-3xl bg-beedero-white p-5" aria-hidden="true">
      <div className="flex items-center gap-3">
        <SkeletonAvatar />
        <div className="flex-1 space-y-2">
          <SkeletonText className="h-3.5 w-1/3" />
          <SkeletonText className="h-2.5 w-1/5" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <SkeletonText className="h-3 w-full" />
        <SkeletonText className="h-3 w-5/6" />
        <SkeletonText className="h-3 w-2/3" />
      </div>
    </div>
  );
}

/** Shaped like a compact list row (connections, following, requests). */
export function SkeletonListRow() {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-beedero-white p-4" aria-hidden="true">
      <SkeletonAvatar className="size-10" />
      <div className="flex-1 space-y-2">
        <SkeletonText className="h-3 w-2/5" />
        <SkeletonText className="h-2.5 w-1/4" />
      </div>
      <Skeleton className="h-8 w-20 rounded-full" />
    </div>
  );
}

/** Shaped like a bento-style metric card (dashboard KPI grid). */
export function SkeletonMetricCard() {
  return (
    <div className="rounded-2xl border border-beedero-border bg-beedero-white p-4" aria-hidden="true">
      <SkeletonText className="h-2.5 w-2/3" />
      <Skeleton className="mt-3 h-7 w-1/2" />
    </div>
  );
}
