import { Shimmer } from "@/components/app-shell/ui";

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-5xl" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading your profile…</span>

      <section className="border border-white/10 bg-white/[0.025] p-5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-4">
            <Shimmer className="size-16 rounded-full" />
            <div className="space-y-3 pt-1">
              <Shimmer className="h-2.5 w-20" />
              <Shimmer className="h-9 w-56" />
              <Shimmer className="h-3 w-40" />
            </div>
          </div>
          <div className="flex gap-2">
            <Shimmer className="h-10 w-40" />
            <Shimmer className="h-10 w-28" />
          </div>
        </div>
        <Shimmer className="mt-6 h-12 max-w-2xl" />
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
        <section className="border border-white/10 bg-white/[0.025] p-5 sm:p-7">
          <Shimmer className="h-2.5 w-36" />
          <Shimmer className="mt-3 h-9 w-48" />
          <div className="mt-6 flex gap-2">
            {[0, 1, 2, 3, 4].map((chip) => (
              <Shimmer key={chip} className="h-7 w-20" />
            ))}
          </div>
          <div className="mt-7 space-y-8">
            {[0, 1].map((row) => (
              <div key={row} className="grid grid-cols-[28px_1fr] gap-4">
                <Shimmer className="size-7" />
                <div className="space-y-2">
                  <Shimmer className="h-3 w-40" />
                  <Shimmer className="h-4 w-56" />
                  <Shimmer className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        </section>
        <aside className="space-y-5">
          <div className="border border-white/10 bg-white/[0.025] p-5">
            <Shimmer className="h-5 w-40" />
            <Shimmer className="mt-3 h-3 w-full" />
            <div className="mt-5 space-y-4">
              {[0, 1, 2].map((i) => (
                <Shimmer key={i} className="h-8 w-full" />
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
