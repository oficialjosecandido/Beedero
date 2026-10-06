import { Shimmer } from "@/components/app-shell/ui";

function RequestCardSkeleton() {
  return (
    <div className="mb-3 border border-white/10 bg-white/[0.025] p-5">
      <div className="flex gap-3">
        <Shimmer className="size-10 rounded-full" />
        <div className="flex-1 space-y-2 pt-1">
          <Shimmer className="h-3 w-2/5" />
          <Shimmer className="h-2.5 w-1/4" />
        </div>
      </div>
      <Shimmer className="mt-5 h-8 w-40" />
    </div>
  );
}

export default function NetworkLoading() {
  return (
    <div aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading your network…</span>

      <div className="mb-8">
        <Shimmer className="h-2.5 w-28" />
        <Shimmer className="mt-3 h-10 w-64" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="min-w-0">
          <Shimmer className="mb-3 h-4 w-44" />
          <RequestCardSkeleton />
          <RequestCardSkeleton />
          <Shimmer className="mb-3 mt-8 h-4 w-40" />
          <div className="divide-y divide-white/[0.07] border-y border-white/10">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="flex items-center gap-3 py-3">
                <Shimmer className="size-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Shimmer className="h-3 w-1/3" />
                  <Shimmer className="h-2.5 w-1/5" />
                </div>
                <Shimmer className="h-6 w-16" />
              </div>
            ))}
          </div>
        </div>
        <Shimmer className="h-96 border border-white/10" />
      </div>
    </div>
  );
}
