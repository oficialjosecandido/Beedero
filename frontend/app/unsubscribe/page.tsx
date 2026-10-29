import Link from "next/link";

import { noIndexMetadata } from "@/lib/site-metadata";

import { UnsubscribeButton } from "./UnsubscribeButton";

export const metadata = { ...noIndexMetadata, title: "Unsubscribe — Beedero" };

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center bg-[#070806] px-5 text-white">
      <div className="w-full max-w-lg py-16">
        <Link href="/" className="text-lg font-black uppercase tracking-[-0.07em]">
          Beedero
        </Link>
        <h1 className="mt-10 text-4xl font-black tracking-[-0.04em]">The Beedero newsletter</h1>
        <div className="mt-6">
          {token ? (
            <UnsubscribeButton token={token} />
          ) : (
            <p className="text-white/60">This link is missing its code. Use the link from the email.</p>
          )}
        </div>
      </div>
    </main>
  );
}
