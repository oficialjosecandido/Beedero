"use client";

import { useActionState, useState } from "react";

import { deleteAccountAction } from "@/lib/auth-actions";
import { useActionToast } from "@/lib/use-action-toast";

export function DeleteAccountPanel() {
  const [confirming, setConfirming] = useState(false);
  const [error, formAction, pending] = useActionState(deleteAccountAction, null);
  useActionToast(error, pending);

  return (
    <section className="rounded-2xl border-2 border-red-200 bg-danger-surface/40 p-5">
      <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-danger-strong">Danger zone</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600">
        Deleting your account removes your profile, posts, and connections. Any organization you
        solely own is deleted with it; organizations with other owners are unaffected. This cannot
        be undone.
      </p>

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-4 rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-danger-strong hover:bg-red-100"
        >
          Delete account
        </button>
      ) : (
        <form action={formAction} className="mt-4 flex flex-col gap-3 sm:max-w-sm">
          <label className="text-xs font-medium text-zinc-600">
            Type <span className="font-bold text-danger-strong">DELETE</span> to confirm.
            <input
              type="text"
              name="confirmation"
              autoComplete="off"
              className="mt-1 w-full rounded-xl border border-red-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-red-500 focus:outline-none"
            />
          </label>
          {error && <p className="text-xs text-danger-strong">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
            >
              {pending ? "Deleting…" : "Permanently delete my account"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="rounded-xl border border-beedero-border px-4 py-2 text-sm font-medium text-beedero-black hover:bg-zinc-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
