"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { useActionToast } from "@/lib/use-action-toast";
import { ReportInvite } from "./ReportInvite";
import { acceptTeamInviteAction, declineTeamInviteAction } from "./actions";

/**
 * Yes, no, or never again.
 *
 * The shape of this follows §9: the invite is prominent but refusing is a
 * first-class button rather than a link in small print, and refusing works
 * without an account — so the decline form is its own form, posting to the
 * public endpoint, and is reachable whether or not `signedIn`.
 */
export function TeamInviteAnswer({
  token,
  orgName,
  signedIn,
  signInUrl,
  startOnDecline,
}: {
  token: string;
  orgName: string;
  signedIn: boolean;
  signInUrl: string;
  /** The email's "not me" link lands here with the refusal already chosen. */
  startOnDecline: boolean;
}) {
  const [declining, setDeclining] = useState(startOnDecline);
  const [acceptError, acceptAction, accepting] = useActionState(acceptTeamInviteAction, null);
  const [declineError, declineAction, decliningNow] = useActionState(
    declineTeamInviteAction,
    null
  );
  useActionToast(acceptError, accepting);
  useActionToast(declineError, decliningNow);

  if (declining) {
    return (
      // The report form is a form of its own, so it is a sibling of this one
      // and never a child — nested forms don't submit.
      <div className="mt-6 flex flex-col gap-4">
      <form action={declineAction} className="flex flex-col gap-4">
        <input type="hidden" name="token" value={token} />
        <p className="text-sm font-semibold">Decline this invite?</p>
        <p className="text-sm text-zinc-600">
          Nothing is added to any profile. {orgName} is told the invite was declined, and the
          address it was sent to is deleted from it.
        </p>
        <label className="flex items-start gap-3 rounded-2xl border border-beedero-border p-3 text-sm">
          <input
            type="checkbox"
            name="block"
            className="mt-0.5 size-4 rounded border-beedero-border accent-beedero-black"
          />
          <span>
            And don&apos;t let {orgName} invite this address again.
          </span>
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={decliningNow}
            className="rounded-xl border-2 border-beedero-border px-5 py-2.5 text-sm font-bold hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
          >
            {decliningNow ? "Declining…" : "Decline"}
          </button>
          <button
            type="button"
            onClick={() => setDeclining(false)}
            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-zinc-600 hover:text-beedero-black"
          >
            Back
          </button>
        </div>
      </form>
      {/* Offered here too: someone who came to say no is the likeliest person
          to want the stronger version of it. */}
      <div className="text-xs text-zinc-500">
        <span className="mr-1">Shouldn&apos;t this invite have reached you at all?</span>
        <ReportInvite token={token} orgName={orgName} />
      </div>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      {signedIn ? (
        <form action={acceptAction}>
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            disabled={accepting}
            className="w-full rounded-xl bg-beedero-yellow px-5 py-3 text-sm font-bold text-beedero-black shadow-sm hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
          >
            {accepting ? "Confirming…" : "Yes, confirm this role"}
          </button>
        </form>
      ) : (
        <Link
          href={signInUrl}
          className="w-full rounded-xl bg-beedero-yellow px-5 py-3 text-center text-sm font-bold text-beedero-black shadow-sm hover:bg-beedero-black hover:text-beedero-white"
        >
          Sign in to confirm
        </Link>
      )}
      <button
        type="button"
        onClick={() => setDeclining(true)}
        className="w-full rounded-xl border-2 border-beedero-border px-5 py-3 text-sm font-bold hover:bg-beedero-black hover:text-beedero-white"
      >
        No, this wasn&apos;t me
      </button>
      {!signedIn && (
        <p className="text-center text-xs text-zinc-500">
          Declining needs no account. Confirming does — sign in with the address above.
        </p>
      )}
      <div className="text-center">
        <ReportInvite token={token} orgName={orgName} />
      </div>
    </div>
  );
}
