import Link from "next/link";

import { ApiError, anonFetch } from "@/lib/api";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ uid?: string; token?: string }>;
}) {
  const { uid = "", token = "" } = await searchParams;
  const validLink = Boolean(uid && token);

  let success = false;
  let error = "";
  if (validLink) {
    try {
      await anonFetch("/auth/verify-email/confirm/", { uid, token });
      success = true;
    } catch (err) {
      const body = err instanceof ApiError ? (err.body as { detail?: string } | null) : null;
      error = body?.detail ?? "Could not verify your email.";
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-beedero-white px-6 py-12 text-beedero-black">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-3xl border border-beedero-black/10 bg-beedero-white p-8 shadow-sm">
        <div>
          <p className="inline-flex rounded-full bg-beedero-black px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-beedero-yellow">
            Beedero
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {success ? "Email verified" : "Verify your email"}
          </h1>
        </div>
        {!validLink ? (
          <p className="text-sm text-red-600">This verification link is invalid.</p>
        ) : success ? (
          <p className="text-sm text-zinc-600">
            Your email is verified. You can now publish your organization.
          </p>
        ) : (
          <p className="text-sm text-red-600">{error}</p>
        )}
        <p className="text-center text-sm text-zinc-600">
          <Link
            href="/dashboard"
            className="font-medium text-beedero-black underline decoration-beedero-yellow decoration-2 underline-offset-4"
          >
            Go to dashboard
          </Link>
        </p>
      </div>
    </main>
  );
}
