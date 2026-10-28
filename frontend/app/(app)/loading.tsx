import { Shimmer } from "@/components/app-shell/ui";

export default function AppLoading() {
  return (
    <div
      className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-4 px-4 py-8 sm:px-6"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading…</span>
      <Shimmer className="h-10 w-64" />
      <Shimmer className="h-40 w-full" />
      <Shimmer className="h-28 w-full" />
      <Shimmer className="h-28 w-full" />
    </div>
  );
}
