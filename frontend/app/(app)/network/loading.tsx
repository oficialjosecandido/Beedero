import { Skeleton, SkeletonListRow } from "@/components/Skeleton";

export default function NetworkLoading() {
  return (
    <main className="flex flex-1 justify-center px-4 py-4 lg:px-6 lg:py-8" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading network…</span>
      <div className="grid w-full max-w-7xl gap-4 lg:grid-cols-[240px_minmax(0,1fr)_320px] lg:gap-6">
        <div className="order-1 hidden lg:order-none lg:block">
          <Skeleton className="h-64 rounded-3xl" />
        </div>
        <div className="order-2 flex min-w-0 flex-col gap-4 lg:order-none lg:gap-6">
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-28 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
          <SkeletonListRow />
          <SkeletonListRow />
          <SkeletonListRow />
          <SkeletonListRow />
        </div>
        <div className="order-3 hidden lg:order-none lg:block">
          <Skeleton className="h-80 rounded-3xl" />
        </div>
      </div>
    </main>
  );
}
