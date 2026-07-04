import Link from "next/link";

import { ResetPasswordForm } from "@/components/ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ uid?: string; token?: string }>;
}) {
  const { uid = "", token = "" } = await searchParams;
  const validLink = Boolean(uid && token);

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-beedero-white px-6 py-12 text-beedero-black">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-3xl border border-beedero-black/10 bg-beedero-white p-8 shadow-sm">
        <div>
          <p className="inline-flex rounded-full bg-beedero-black px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-beedero-yellow">
            Beedero
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Choose a new password
          </h1>
        </div>
        {validLink ? (
          <ResetPasswordForm uid={uid} token={token} />
        ) : (
          <p className="text-sm text-red-600">This password reset link is invalid.</p>
        )}
        <p className="text-center text-sm text-zinc-600">
          <Link
            href="/login"
            className="font-medium text-beedero-black underline decoration-beedero-yellow decoration-2 underline-offset-4"
          >
            Back to login
          </Link>
        </p>
      </div>
    </main>
  );
}
