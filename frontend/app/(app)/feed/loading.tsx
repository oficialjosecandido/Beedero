import { Skeleton, SkeletonPostCard } from "@/components/Skeleton";

export default function FeedLoading() {
  return (
    <main className="flex flex-1 justify-center px-4 py-4 lg:px-6 lg:py-8" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading feed…</span>
      <div className="grid w-full max-w-7xl gap-4 lg:grid-cols-[240px_minmax(0,1fr)_320px] lg:gap-6">
        <div className="order-1 hidden lg:order-none lg:block">
          <Skeleton className="h-64 rounded-3xl" />
        </div>
        <div className="order-2 flex flex-col gap-4 lg:order-none lg:gap-6">
          <Skeleton className="h-28 rounded-3xl" />
          <SkeletonPostCard />
          <SkeletonPostCard />
          <SkeletonPostCard />
        </div>
        <div className="order-3 hidden lg:order-none lg:block">
          <Skeleton className="h-80 rounded-3xl" />
        </div>
      </div>
    </main>
  );
}
