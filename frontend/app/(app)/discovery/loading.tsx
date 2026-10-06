import { Shimmer } from "@/components/app-shell/ui";

export default function DiscoveryLoading() {
  return (
    <div aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading discover…</span>

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Shimmer className="h-2.5 w-36" />
          <Shimmer className="mt-3 h-10 w-64" />
        </div>
        <Shimmer className="h-10 w-32" />
      </div>

      <div className="mb-7 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Shimmer key={i} className="h-14" />
        ))}
      </div>

      <Shimmer className="mb-4 h-4 w-56" />

      <div className="grid gap-3 md:grid-cols-2">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="flex items-start gap-4 border border-white/10 bg-white/[0.025] p-5">
            <Shimmer className="size-12 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <Shimmer className="h-3.5 w-2/5" />
              <Shimmer className="h-3 w-3/5" />
              <Shimmer className="mt-2 h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
