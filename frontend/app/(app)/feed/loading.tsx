import { Shimmer } from "@/components/app-shell/ui";

export default function FeedLoading() {
  return (
    <div
      className="mx-auto grid w-full max-w-[1440px] gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)_280px]"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading feed…</span>
      <div className="hidden lg:block">
        <Shimmer className="h-64 w-full" />
      </div>
      <div className="flex flex-col gap-4">
        <Shimmer className="h-12 w-72" />
        <Shimmer className="h-36 w-full" />
        <Shimmer className="h-48 w-full" />
        <Shimmer className="h-48 w-full" />
      </div>
      <div className="hidden lg:block">
        <Shimmer className="h-80 w-full" />
      </div>
    </div>
  );
}
