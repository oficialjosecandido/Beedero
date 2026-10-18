import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ApiError, publicFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { isAuthenticated } from "@/lib/session";
import { noIndexMetadata } from "@/lib/site-metadata";
import { refFor, registerUrl } from "@/lib/signup-ref";
import { ReportInvite } from "./ReportInvite";
import { TeamInviteAnswer } from "./TeamInviteAnswer";

// Never indexed, and never cached: a page that said "open" after the person
// declined would be a page that invites them twice.
export const metadata: Metadata = { title: "Team invite", ...noIndexMetadata };

type TeamInvitePublic = {
  org: { slug: string; name: string; one_liner: string; logo: string | null };
  name: string;
  role: string;
  role_label: string;
  title: string;
  started_on: string | null;
  invited_by: string;
  email_hint: string;
  answer: "open" | "accepted" | "declined" | "expired";
  expires_at: string;
};

const CLOSED_COPY: Record<string, { heading: string; body: string }> = {
  accepted: {
    heading: "You already accepted this",
    body: "This role is on your profile, confirmed by the organisation.",
  },
  declined: {
    heading: "You declined this invite",
    body: "Nothing was added to any profile, and nobody was told who you are.",
  },
  expired: {
    heading: "This invite has expired",
    body: "Invites last 30 days. Ask whoever sent it to invite you again if you still want it.",
  },
};

export default async function TeamInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ answer?: string; reported?: string }>;
}) {
  const [{ token }, { answer, reported }] = await Promise.all([params, searchParams]);

  let invite: TeamInvitePublic;
  try {
    invite = await publicFetch<TeamInvitePublic>(`/public/team-invites/${token}/`, 0);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const { org } = invite;
  const signedIn = await isAuthenticated();
  // A filed report is the one state that outranks the invite's own: it was
  // just declined, but "you declined this" is not what the person came to do.
  const wasReported = reported === "1";
  const closed = invite.answer !== "open" ? CLOSED_COPY[invite.answer] : null;

  return (
    <main className="flex flex-1 items-center justify-center bg-beedero-white px-6 py-12 text-beedero-black">
      <div className="w-full max-w-lg rounded-3xl border-2 border-beedero-border bg-beedero-white p-8 shadow-sm">
        <div className="flex items-start gap-4">
          {org.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={org.logo}
              alt={`${org.name} logo`}
              className="size-12 shrink-0 rounded-2xl object-cover"
            />
          ) : (
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-beedero-yellow/30 text-lg font-extrabold">
              {org.name.charAt(0)}
            </span>
          )}
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
              Team invite
            </p>
            <h1 className="mt-1 text-2xl font-extrabold leading-tight tracking-tight">
              {wasReported
                ? "Report received"
                : closed
                  ? closed.heading
                  : `${org.name} says you were part of the team`}
            </h1>
          </div>
        </div>

        {wasReported ? (
          // The whole of what we can honestly promise: a person will read it.
          // No case number and no ETA — neither of those exists.
          <p className="mt-5 text-sm text-zinc-600">
            The invite is declined, {org.name} can&apos;t invite this address again, and someone
            at Beedero will review what you sent us. You don&apos;t need to do anything else.
          </p>
        ) : closed ? (
          <>
            <p className="mt-5 text-sm text-zinc-600">{closed.body}</p>
            {/* An objection outlives the invite: the email can be opened weeks
                after it expired, and "you already declined" is not an answer
                to "this should never have been sent". */}
            <div className="mt-5">
              <ReportInvite token={token} orgName={org.name} />
            </div>
          </>
        ) : (
          <>
            <dl className="mt-6 flex flex-col gap-3 rounded-2xl border border-beedero-border bg-beedero-yellow/10 p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Role</dt>
                <dd className="text-right font-semibold">
                  {invite.title || invite.role_label}
                  {invite.title && (
                    <span className="font-normal text-zinc-500"> · {invite.role_label}</span>
                  )}
                </dd>
              </div>
              {invite.started_on && (
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Started</dt>
                  <dd className="text-right font-semibold">{formatDate(invite.started_on)}</dd>
                </div>
              )}
              {invite.invited_by && (
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Invited by</dt>
                  <dd className="text-right font-semibold">{invite.invited_by}</dd>
                </div>
              )}
              {invite.email_hint && (
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Sent to</dt>
                  <dd className="text-right font-semibold">{invite.email_hint}</dd>
                </div>
              )}
            </dl>

            {/* The two things people actually want to know before clicking: what
                this puts on their profile, and what it does not give the org. */}
            <p className="mt-5 text-sm text-zinc-600">
              Accepting adds this role to your Beedero profile as{" "}
              <strong className="font-semibold text-beedero-black">confirmed by {org.name}</strong>
              {" "}— the strongest kind of verification there is, because they said it, not you.
            </p>
            <p className="mt-2 text-sm text-zinc-600">
              It does not give {org.name} access to your account, your profile drafts, or anything
              you haven&apos;t published.
            </p>

            <TeamInviteAnswer
              token={token}
              orgName={org.name}
              signedIn={signedIn}
              signInUrl={registerUrl(refFor("invite", org.slug), `/invite/team/${token}`)}
              startOnDecline={answer === "no"}
            />

            <p className="mt-6 text-xs text-zinc-500">
              This invite expires {formatDate(invite.expires_at)}. Ignoring it is an answer too —
              we send one reminder and then stop.
            </p>
          </>
        )}

        <p className="mt-6 border-t border-beedero-border pt-4 text-center text-xs text-zinc-500">
          <Link href={`/o/${org.slug}`} className="underline underline-offset-2 hover:text-beedero-black">
            See {org.name} on Beedero
          </Link>
        </p>
      </div>
    </main>
  );
}
