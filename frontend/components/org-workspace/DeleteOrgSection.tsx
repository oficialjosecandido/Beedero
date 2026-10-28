"use client";

import { useActionState, useState } from "react";

import { deleteOrgAction } from "@/app/(app)/dashboard/actions";
import { useActionToast } from "@/lib/use-action-toast";

/**
 * The last thing on the Settings tab, quiet on purpose — the same shape as
 * the one at the bottom of My profile (components/profile/AccountSection):
 * a small link that opens the confirmation, never a button sitting there
 * waiting to be hit.
 *
 * Owners only, and the confirmation is the organisation's name rather than a
 * fixed word: someone with several organisations in the switcher should not
 * be able to delete the wrong one from muscle memory. The backend checks the
 * name again (orgs/views.py::OrgProfileView.delete).
 */
export function DeleteOrgSection({ slug, name }: { slug: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, formAction, pending] = useActionState(deleteOrgAction, null);
  useActionToast(error, pending);

  return (
    <section aria-labelledby="delete-org-title" className="mt-2 border-t border-beedero-border pt-5">
      <h2 id="delete-org-title" className="text-xs font-bold uppercase tracking-[0.14em] text-subtle">
        Close this organisation
      </h2>

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-2 text-xs font-bold text-red-600 underline-offset-2 hover:underline"
        >
          Delete {name}…
        </button>
      ) : (
        <form
          action={formAction}
          className="mt-3 flex flex-col gap-3 rounded-2xl border-2 border-red-300 bg-white p-5 sm:max-w-lg"
        >
          <input type="hidden" name="slug" value={slug} />
          <p className="text-sm leading-6 text-beedero-black">
            This deletes the public profile, the team, updates, events, jobs, verifications and the
            data room. Everyone loses access immediately and the link stops working. It can&apos;t be
            undone.
          </p>
          <p className="text-sm leading-6 text-subtle">
            A plan paid by card is cancelled with Stripe at the same moment — the rest of the period
            isn&apos;t refunded. Invoices already paid are kept, for the accounting.
          </p>
          <label className="text-xs text-subtle">
            Type <b className="text-red-600">{name}</b> to confirm
            <input
              name="confirm"
              autoComplete="off"
              className="mt-2 w-full rounded-xl border border-beedero-border bg-white px-3 py-2.5 text-sm text-beedero-black outline-none transition-colors focus:border-red-400 focus:ring-2 focus:ring-red-200"
            />
          </label>
          {error && (
            <p role="alert" className="text-xs font-medium text-red-600">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-red-600 px-4 py-2.5 text-xs font-black text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {pending ? "Deleting…" : "Delete permanently"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="rounded-xl border border-beedero-border px-4 py-2.5 text-xs font-bold hover:bg-beedero-yellow disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
