"use client";

import { useActionState } from "react";

import { resetPasswordAction } from "@/lib/auth-actions";

export function ResetPasswordForm({ uid, token }: { uid: string; token: string }) {
  const [error, formAction, pending] = useActionState(resetPasswordAction, null);

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      <input type="hidden" name="uid" value={uid} />
      <input type="hidden" name="token" value={token} />
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
        New password
        <input
          name="password"
          type="password"
          required
          disabled={pending}
          className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-beedero-black outline-none transition focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
        Confirm password
        <input
          name="confirm_password"
          type="password"
          required
          disabled={pending}
          className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-beedero-black outline-none transition focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-beedero-yellow px-5 py-2.5 text-sm font-bold text-beedero-black shadow-sm hover:bg-beedero-black hover:text-beedero-white disabled:cursor-wait disabled:opacity-70 disabled:hover:bg-beedero-yellow disabled:hover:text-beedero-black"
      >
        {pending && (
          <span className="size-4 animate-spin rounded-full border-2 border-beedero-black/25 border-t-beedero-black" />
        )}
        {pending ? "Saving..." : "Reset password"}
      </button>
    </form>
  );
}
