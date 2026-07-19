import Link from "next/link";

export default function OrgDashboardNotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-extrabold text-zinc-900">Organization not found</h1>
      <p className="max-w-md text-sm leading-6 text-zinc-600">
        This organization is not available on the API your app is connected to. If you recently
        switched to a local backend, your production orgs (like WaveRent) only exist on{" "}
        <code className="rounded bg-zinc-100 px-1">api.beedero.com</code> — use that{" "}
        <code className="rounded bg-zinc-100 px-1">BACKEND_URL</code> in{" "}
        <code className="rounded bg-zinc-100 px-1">.env</code>, or create the org again locally.
      </p>
      <Link
        href="/dashboard"
        className="rounded-xl bg-beedero-yellow px-5 py-2.5 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white"
      >
        Back to dashboard
      </Link>
    </main>
  );
}
