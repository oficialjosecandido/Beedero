import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { noIndexMetadata, pageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Log in",
    description: "Sign in to your Beedero account to manage your startup profile, feed, and discovery.",
    path: "/login",
  }),
  ...noIndexMetadata,
};

const ENTRA_ERROR_MESSAGES: Record<string, string> = {
  entra_not_configured: "Beedero ID sign-in isn't available right now. Please try again shortly.",
  entra_invalid_state: "That sign-in link expired or was already used. Please try again.",
  entra_token_exchange_failed: "Beedero ID sign-in failed. Please try again.",
  entra_unreachable: "Couldn't reach Beedero ID right now. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const store = await cookies();
  if (store.get("beedero_signup_after_logout")?.value === "1") {
    redirect("/api/auth/login?screen=signup");
  }

  const { next, error } = await searchParams;
  const errorMessage = error ? ENTRA_ERROR_MESSAGES[error] ?? "Sign-in failed. Please try again." : null;
  const entraLoginHref = next ? `/api/auth/login?next=${encodeURIComponent(next)}` : "/api/auth/login";

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-beedero-white px-6 py-12 text-beedero-black">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-3xl border-2 border-beedero-border bg-beedero-white p-8 shadow-sm">
        <div>
          <p className="inline-flex rounded-full bg-beedero-black px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-beedero-yellow">
            Beedero
          </p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Log in</h1>
        </div>
        {errorMessage && (
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>
        )}
        <a
          href={entraLoginHref}
          className="flex items-center justify-center rounded-full border-2 border-beedero-black px-4 py-3 text-sm font-semibold text-beedero-black hover:bg-beedero-black hover:text-beedero-yellow"
        >
          Log in with Beedero ID
        </a>
        <div className="flex flex-col gap-2 text-center text-sm text-zinc-600">
          <p>
          Don&apos;t have an account yet?{" "}
          <Link
            href="/register"
            className="font-medium text-beedero-black underline decoration-beedero-yellow decoration-2 underline-offset-4"
          >
            Create account
          </Link>
          </p>
        </div>
        <p className="text-center text-xs text-zinc-500">
          <Link href="/termos" className="underline underline-offset-2 hover:text-beedero-black">
            Termos
          </Link>{" "}
          ·{" "}
          <Link href="/privacidade" className="underline underline-offset-2 hover:text-beedero-black">
            Privacidade
          </Link>
        </p>
      </div>
    </main>
  );
}
