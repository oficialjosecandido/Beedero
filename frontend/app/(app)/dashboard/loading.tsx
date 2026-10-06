import { Shimmer } from "@/components/app-shell/ui";

function KpiCardSkeleton() {
  return (
    <div className="border border-white/10 p-4">
      <Shimmer className="size-8" />
      <Shimmer className="mt-3 h-3 w-24" />
      <Shimmer className="mt-2 h-8 w-16" />
      <Shimmer className="mt-2 h-3 w-32" />
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div aria-live="polite" aria-busy="true">
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

      <div className="mt-5 flex gap-2">
        {[0, 1, 2, 3].map((chip) => (
          <Shimmer key={chip} className="h-7 w-24" />
        ))}
      </div>

      <section className="mt-5 border border-white/10 bg-white/[0.025] p-5 sm:p-7">
        <div className="border-b border-white/10 pb-5">
          <Shimmer className="h-2.5 w-28" />
          <Shimmer className="mt-3 h-9 w-48" />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4].map((card) => (
            <KpiCardSkeleton key={card} />
          ))}
        </div>
      </section>
    </div>
  );
}
