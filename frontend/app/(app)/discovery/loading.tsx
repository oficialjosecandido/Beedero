import { Skeleton } from "@/components/Skeleton";

export default function DiscoveryLoading() {
  return (
    <main
      className="flex flex-1 flex-col items-center px-4 py-10 sm:px-6 sm:py-14"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading discover…</span>
      <div className="flex w-full max-w-5xl flex-col gap-8">
        <div className="max-w-2xl space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-4/5" />
          <Skeleton className="h-4 w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-3xl" />
          ))}
        </div>
      </div>
    </main>
  );
}
