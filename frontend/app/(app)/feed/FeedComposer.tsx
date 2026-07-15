"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import { createInvestorPostAction } from "@/app/(app)/dashboard/actions";
import { useActionToast } from "@/lib/use-action-toast";

const POST_KIND_OPTIONS = [
  { value: "milestone", label: "Milestone" },
  { value: "event", label: "Event" },
  { value: "update", label: "Update" },
];

type FeedComposerProps = {
  name: string;
  profilePicture?: string | null;
  profileComplete: boolean;
  hasPostedToday: boolean;
};

function Avatar({ name, profilePicture }: { name: string; profilePicture?: string | null }) {
  if (profilePicture) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={profilePicture} alt="" className="size-11 shrink-0 rounded-full object-cover" />
    );
  }
  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-500">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export function FeedComposer({
  name,
  profilePicture,
  profileComplete,
  hasPostedToday,
}: FeedComposerProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [error, formAction, pending] = useActionState(createInvestorPostAction, null);
  const [kind, setKind] = useState(POST_KIND_OPTIONS[0].value);
  const prevPending = useRef(false);
  const allowsPhoto = kind === "event" || kind === "update";
  useActionToast(error, pending, { successMessage: "Post published!" });

  useEffect(() => {
    const justFinished = prevPending.current && !pending;
    prevPending.current = pending;
    if (justFinished && error === null) {
      setExpanded(false);
      router.refresh();
    }
  }, [pending, error, router]);

  if (!profileComplete) {
    return (
      <div className="rounded-3xl border border-beedero-black/10 bg-beedero-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <Avatar name={name} profilePicture={profilePicture} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-beedero-black">Complete your profile to post</p>
            <p className="mt-0.5 text-sm text-zinc-500">
              Add your name, headline, and country before sharing updates.
            </p>
            <Link
              href="/dashboard"
              className="mt-2 inline-flex rounded-xl bg-beedero-yellow px-3 py-1.5 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white"
            >
              Go to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (hasPostedToday) {
    return (
      <div className="rounded-3xl border border-beedero-black/10 bg-beedero-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <Avatar name={name} profilePicture={profilePicture} />
          <div>
            <p className="text-sm font-semibold text-beedero-black">You have already posted today.</p>
            <p className="mt-1 text-sm text-zinc-500">
              Each profile can publish one update per day. Come back tomorrow.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-beedero-black/10 bg-beedero-white p-5 shadow-sm">
      <div className="flex gap-3">
        <Avatar name={name} profilePicture={profilePicture} />
        <div className="min-w-0 flex-1">
          {!expanded ? (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="w-full rounded-full border border-beedero-black/15 px-4 py-3 text-left text-sm text-zinc-500 transition hover:border-beedero-black/30 hover:bg-zinc-50"
            >
              Share an update…
            </button>
          ) : (
            <form action={formAction} className="flex flex-col gap-3">
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
                  Type
                  <select
                    name="kind"
                    value={kind}
                    onChange={(event) => setKind(event.target.value)}
                    className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
                  >
                    {POST_KIND_OPTIONS.map((k) => (
                      <option key={k.value} value={k.value}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                </label>
                <input
                  name="title"
                  placeholder="Title"
                  required
                  autoFocus
                  className="min-w-[12rem] flex-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
                />
              </div>
              <textarea
                name="body"
                placeholder="Say more…"
                rows={3}
                className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
              />
              {allowsPhoto ? (
                <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
                  Photo (optional, max 1)
                  <input
                    type="file"
                    name="image"
                    accept="image/*"
                    className="text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-beedero-yellow file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-beedero-black hover:file:bg-beedero-black hover:file:text-beedero-white"
                  />
                </label>
              ) : (
                <p className="text-xs text-zinc-500">
                  Milestones are text-only and cannot include photos.
                </p>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-xl bg-beedero-yellow px-4 py-2 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
                >
                  {pending ? "Publishing…" : "Publish"}
                </button>
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="rounded-xl px-3 py-2 text-sm font-medium text-zinc-500 hover:text-beedero-black"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
