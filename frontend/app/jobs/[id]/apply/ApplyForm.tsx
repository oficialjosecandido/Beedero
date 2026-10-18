"use client";

import { useActionState } from "react";

import { useActionToast } from "@/lib/use-action-toast";
import { applyToJobAction } from "./actions";

/**
 * The application form — §3.5's minimum profile and the note, in one screen.
 *
 * `missing` is the subset of the three profile fields the person doesn't have
 * yet. Only those are asked for: showing someone their own name in a box to
 * re-type is how a two-field form becomes a profile editor, and the API
 * ignores a value where one already exists anyway.
 */

const fieldClass =
  "rounded-xl border-2 border-beedero-border bg-beedero-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-beedero-black";

export type MissingProfileFields = {
  full_name: boolean;
  headline: boolean;
  city: boolean;
};

export function ApplyForm({
  jobId,
  jobTitle,
  orgName,
  missing,
}: {
  jobId: number;
  jobTitle: string;
  orgName: string;
  missing: MissingProfileFields;
}) {
  const [error, action, pending] = useActionState(applyToJobAction, null);
  useActionToast(error, pending);

  const needsProfile = missing.full_name || missing.headline || missing.city;

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="job_id" value={jobId} />

      {needsProfile && (
        <fieldset className="flex flex-col gap-3 rounded-2xl border-2 border-beedero-border p-4">
          <legend className="px-1 text-xs font-bold uppercase tracking-[0.18em] text-beedero-black">
            About you
          </legend>
          <p className="text-xs text-zinc-600">
            {orgName} sees this with your application. You can fill in the rest of your profile
            afterwards — this is all that&apos;s needed now.
          </p>

          {missing.full_name && (
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
              Your name
              <input name="full_name" required maxLength={200} className={fieldClass} />
            </label>
          )}

          {missing.headline && (
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
              One-line title
              <input
                name="headline"
                maxLength={200}
                placeholder="Backend engineer · 4 years"
                className={fieldClass}
              />
            </label>
          )}

          {missing.city && (
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
              City
              <input name="city" maxLength={80} placeholder="Lisbon" className={fieldClass} />
            </label>
          )}
        </fieldset>
      )}

      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
        Why you&apos;re a fit for {jobTitle}
        <textarea
          name="note"
          rows={6}
          maxLength={1500}
          className={`${fieldClass} resize-y`}
          placeholder="A few lines are plenty. What have you done that's closest to this role?"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
        Link to your CV, portfolio or LinkedIn (optional)
        <input name="external_link" type="url" placeholder="https://" className={fieldClass} />
      </label>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-beedero-yellow px-5 py-2.5 text-sm font-bold text-beedero-black transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send application"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </form>
  );
}
