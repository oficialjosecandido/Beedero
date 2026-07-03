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
          className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
        Confirm password
        <input
          name="confirm_password"
          type="password"
          required
          className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
      >
        {pending ? "Saving..." : "Reset password"}
      </button>
    </form>
  );
}
