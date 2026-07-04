"use client";

import { useActionState } from "react";

import { acceptInviteAction } from "./actions";

export function AcceptInviteForm({ token }: { token: string }) {
  const [error, formAction, pending] = useActionState(acceptInviteAction, null);

  return (
    <form action={formAction} className="mt-6 flex flex-col items-center gap-3">
      <input type="hidden" name="token" value={token} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
      >
        {pending ? "Joining..." : "Accept invite"}
      </button>
    </form>
  );
}
