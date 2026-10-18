"use client";

import { useActionState, useState } from "react";

import { useActionToast } from "@/lib/use-action-toast";
import { reportTeamInviteAction } from "./actions";

/**
 * "This shouldn't have been sent to me" — the complaint, not the refusal.
 *
 * Deliberately separate from declining. Declining is an answer to a question
 * that was fair to ask; this says the question itself was wrong, and it is the
 * only thing on this screen that puts a human at Beedero in the loop. Kept in
 * its own component because it has to be reachable from the open invite *and*
 * from an invite that is already declined or expired — someone may only read
 * the email weeks later, and the objection doesn't expire with the invite.
 *
 * Closed by default: a report form sitting open invites reports, and the three
 * effects it has are too blunt to trip over by accident.
 */

const REASONS = [
  { value: "not_me", label: "I never worked there" },
  { value: "unwanted", label: "I didn't ask to be contacted" },
  { value: "impersonation", label: "Someone is pretending to be me" },
  { value: "other", label: "Something else" },
];

export function ReportInvite({ token, orgName }: { token: string; orgName: string }) {
  const [open, setOpen] = useState(false);
  const [error, action, pending] = useActionState(reportTeamInviteAction, null);
  useActionToast(error, pending);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-zinc-500 underline underline-offset-2 hover:text-beedero-black"
      >
        Report this invite
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3 rounded-2xl border border-beedero-border p-4 text-left">
      <input type="hidden" name="token" value={token} />
      <p className="text-sm font-semibold">Report this invite</p>
      {/* All three effects, stated before the click rather than after it. */}
      <p className="text-xs text-zinc-600">
        We&apos;ll decline the invite, stop {orgName} from inviting this address again, and send
        your report to someone at Beedero to look into. You don&apos;t need an account.
      </p>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="sr-only">What went wrong</legend>
        {REASONS.map((reason, index) => (
          <label key={reason.value} className="flex items-start gap-2.5 text-sm">
            <input
              type="radio"
              name="reason"
              value={reason.value}
              defaultChecked={index === 0}
              className="mt-1 size-4 border-beedero-border accent-beedero-black"
            />
            <span>{reason.label}</span>
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
        Anything you want to add (optional)
        <textarea
          name="note"
          rows={3}
          maxLength={2000}
          className="rounded-lg border border-beedero-border bg-white px-2.5 py-1.5 text-sm text-beedero-black outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl border-2 border-beedero-border px-4 py-2 text-sm font-bold hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send report"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs font-semibold text-zinc-500 hover:text-beedero-black"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
