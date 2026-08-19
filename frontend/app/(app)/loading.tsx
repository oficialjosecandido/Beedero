import { LoadingSpinner } from "@/components/LoadingSpinner";

export default function AppLoading() {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-3 py-24"
      aria-live="polite"
      aria-busy="true"
    >
      <LoadingSpinner className="size-10" label="Loading page" />
      <p className="text-sm font-semibold text-beedero-black">Loading…</p>
    </div>
  );
}
