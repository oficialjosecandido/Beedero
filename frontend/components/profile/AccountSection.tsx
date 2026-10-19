"use client";

import { useActionState, useState } from "react";

import { btnGhost, inputDark } from "@/components/app-shell/ui";
import { deleteAccountAction } from "@/lib/auth-actions";
import { useActionToast } from "@/lib/use-action-toast";

/**
 * The last thing on the page, quiet on purpose: the sign-in email and the
 * way out. Replaces the pink "Danger zone" card, whose grey-on-pink text
 * failed contrast on the dark background.
 */
export function AccountSection({ email }: { email: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, formAction, pending] = useActionState(deleteAccountAction, null);
  useActionToast(error, pending);

  return (
    <section id="account" aria-labelledby="account-title" className="scroll-mt-24 border border-white/10 p-5 sm:p-7">
      <h2 id="account-title" className="text-sm font-black uppercase tracking-[0.14em] text-white/55">
        Account
      </h2>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-[180px_1fr]">
        <dt className="text-white/45">Signs in with</dt>
        <dd>{email}</dd>
      </dl>

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-5 text-xs font-bold text-red-300 underline-offset-2 hover:underline"
        >
          Delete my account…
        </button>
      ) : (
        <form action={formAction} className="mt-5 flex flex-col gap-3 border border-red-400/40 p-4 sm:max-w-md">
          <p className="text-sm leading-6 text-white/75">
            This removes your profile, posts and connections. Organisations you own alone are deleted
            too; ones with other owners stay. It can&apos;t be undone.
          </p>
          <label className="text-xs text-white/60">
            Type <b className="text-red-300">DELETE</b> to confirm
            <input name="confirmation" autoComplete="off" className={`mt-2 ${inputDark} focus:border-red-400`} />
          </label>
          {error && (
            <p role="alert" className="text-xs text-red-300">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending}
              className="bg-red-500 px-4 py-2.5 text-xs font-black text-white transition hover:bg-red-600 disabled:opacity-50"
            >
              {pending ? "Deleting…" : "Delete permanently"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={pending} className={btnGhost}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
