"use client";

import { useActionState } from "react";

import { resendVerificationEmailAction } from "@/app/(app)/dashboard/actions";

export function VerifyEmailBanner() {
  const [message, formAction, pending] = useActionState(resendVerificationEmailAction, null);

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-beedero-yellow bg-beedero-yellow/15 px-4 py-3 text-sm text-beedero-black sm:flex-row sm:items-center sm:justify-between">
      <p>Verify your email to publish an organization.</p>
      <div className="flex items-center gap-3">
        <form action={formAction}>
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-beedero-black px-3 py-1.5 text-xs font-bold text-beedero-yellow hover:bg-beedero-yellow hover:text-beedero-black disabled:opacity-50"
          >
            {pending ? "Sending..." : "Resend verification email"}
          </button>
        </form>
        {message && <p className="text-xs text-beedero-black">{message}</p>}
      </div>
    </div>
  );
}
