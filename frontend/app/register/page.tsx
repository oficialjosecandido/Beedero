import type { Metadata } from "next";
import Link from "next/link";

import { pageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = pageMetadata({
  title: "Create account",
  description: "Join Beedero as a founder, startup, or investor. Build structured profiles and discover verified opportunities.",
  path: "/register",
});

export default function RegisterPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-beedero-white px-6 py-12 text-beedero-black">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-3xl border border-beedero-black/10 bg-beedero-white p-8 shadow-sm">
        <div>
          <p className="inline-flex rounded-full bg-beedero-black px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-beedero-yellow">
            Beedero
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Create account
          </h1>
        </div>
        {/* New signups always go through Entra (Fase A of the auth migration —
            see docs/entra-migration.md §4). prompt=create skips straight to
            Entra's sign-up screen instead of its login screen. */}
        <a
          href="/api/auth/login?screen=signup"
          className="flex items-center justify-center rounded-full bg-beedero-black px-4 py-3 text-sm font-semibold text-beedero-yellow hover:bg-beedero-black/90"
        >
          Create account with Beedero ID
        </a>
        <p className="text-center text-sm text-zinc-600">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-beedero-black underline decoration-beedero-yellow decoration-2 underline-offset-4"
          >
            Log in
          </Link>
        </p>
        <p className="text-center text-xs text-zinc-500">
          By creating an account you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-2 hover:text-beedero-black">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-beedero-black">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
