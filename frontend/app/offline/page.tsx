import { noIndexMetadata } from "@/lib/site-metadata";

export const metadata = {
  title: "You're offline",
  ...noIndexMetadata,
};

export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-400">Offline</p>
      <h1 className="mt-3 text-3xl font-extrabold text-zinc-950">You&apos;re offline</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-zinc-600">
        Beedero needs a connection for this page. Check your network and try again.
      </p>
    </main>
  );
}
