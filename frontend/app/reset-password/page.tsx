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
    <main className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-12 text-zinc-950">
      <div className="flex w-full max-w-md flex-col gap-6 rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700">
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
          <Link href="/login" className="font-medium text-emerald-700 underline">
            Back to login
          </Link>
        </p>
      </div>
    </main>
  );
}
