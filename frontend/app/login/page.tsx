import Link from "next/link";

import { LoginForm } from "@/components/LoginForm";

const ENTRA_ERROR_MESSAGES: Record<string, string> = {
  entra_not_configured: "Beedero ID sign-in isn't available yet. Please use your email and password.",
  entra_invalid_state: "That sign-in link expired or was already used. Please try again.",
  entra_token_exchange_failed: "Beedero ID sign-in failed. Please try again.",
  entra_unreachable: "Couldn't reach Beedero ID right now. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const errorMessage = error ? ENTRA_ERROR_MESSAGES[error] ?? "Sign-in failed. Please try again." : null;
  const entraLoginHref = next ? `/api/auth/login?next=${encodeURIComponent(next)}` : "/api/auth/login";

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-beedero-white px-6 py-12 text-beedero-black">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-3xl border border-beedero-black/10 bg-beedero-white p-8 shadow-sm">
        <div>
          <p className="inline-flex rounded-full bg-beedero-black px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-beedero-yellow">
            Beedero
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Log in</h1>
        </div>
        {errorMessage && (
          <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</p>
        )}
        <a
          href={entraLoginHref}
          className="flex items-center justify-center rounded-full border-2 border-beedero-black px-4 py-3 text-sm font-semibold text-beedero-black hover:bg-beedero-black hover:text-beedero-yellow"
        >
          Entrar com Beedero ID (novo)
        </a>
        <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-zinc-400">
          <span className="h-px flex-1 bg-beedero-black/10" />
          or
          <span className="h-px flex-1 bg-beedero-black/10" />
        </div>
        <LoginForm />
        <div className="flex flex-col gap-2 text-center text-sm text-zinc-600">
          <Link
            href="/forgot-password"
            className="font-medium text-beedero-black underline decoration-beedero-yellow decoration-2 underline-offset-4"
          >
            Forgot password?
          </Link>
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
          <Link href="/terms" className="underline underline-offset-2 hover:text-beedero-black">
            Terms
          </Link>{" "}
          ·{" "}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-beedero-black">
            Privacy Policy
          </Link>
        </p>
      </div>
    </main>
  );
}
