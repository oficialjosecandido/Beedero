import { Shimmer } from "@/components/app-shell/ui";

export default function JobsLoading() {
  return (
    <div aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading opportunities…</span>

      <Shimmer className="h-2.5 w-36" />
      <Shimmer className="mt-3 h-10 w-72" />
      <Shimmer className="mt-7 h-12 max-w-2xl" />

      <div className="mt-4 mb-6 flex flex-wrap gap-2">
        {["w-32", "w-20", "w-20", "w-20", "w-20", "w-28", "w-40"].map((width, index) => (
          <Shimmer key={index} className={`h-9 ${width}`} />
        ))}
      </div>

      <div className="grid gap-3">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="border border-white/10 bg-white/[0.025] p-5">
            <div className="flex flex-wrap items-center gap-5">
              <Shimmer className="size-5 shrink-0" />
              <div className="min-w-[200px] flex-1 space-y-2">
                <Shimmer className="h-3.5 w-2/5" />
                <Shimmer className="h-3 w-1/4" />
              </div>
              <Shimmer className="h-8 w-32" />
            </div>
            <Shimmer className="mt-4 h-10 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
