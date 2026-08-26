"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import { postFeedAction } from "@/app/(app)/dashboard/actions";
import { MentionTextarea } from "@/components/MentionTextarea";
import { formatDateTime } from "@/lib/format";
import { useActionToast } from "@/lib/use-action-toast";

export type PostingStatus = {
  can_post: boolean;
  next_slot_at: string | null;
  allowed_kinds: string[];
  locked_kinds: { kind: string; unlocks_at_level: number; reason: string }[];
  credibility_level: number;
  freshness: string | null;
};

const POST_KIND_OPTIONS = [
  { value: "update", label: "Update" },
  { value: "milestone", label: "Milestone" },
  { value: "event", label: "Event" },
] as const;

const MILESTONE_CATEGORIES = [
  { value: "traction", label: "Traction" },
  { value: "product", label: "Product" },
  { value: "team", label: "Team" },
  { value: "funding", label: "Funding" },
  { value: "award", label: "Award" },
  { value: "other", label: "Other" },
];

const EVENT_FORMATS = [
  { value: "in_person", label: "In person" },
  { value: "online", label: "Online" },
  { value: "hybrid", label: "Hybrid" },
];

function slotLabel(nextSlotAt: string | null) {
  if (!nextSlotAt) return "Next slot: tomorrow";
  return `Next slot: ${formatDateTime(nextSlotAt)}`;
}

export function OrgPostComposer({
  slug,
  postingStatus,
  suggestedTitle,
  suggestedBody,
  defaultKind = "update",
  compactCreateButton = false,
}: {
  slug: string;
  postingStatus: PostingStatus;
  suggestedTitle?: string;
  suggestedBody?: string;
  defaultKind?: (typeof POST_KIND_OPTIONS)[number]["value"];
  compactCreateButton?: boolean;
}) {
  const [error, formAction, pending] = useActionState(postFeedAction, null);
  const [expanded, setExpanded] = useState(!compactCreateButton);
  const [kind, setKind] = useState<(typeof POST_KIND_OPTIONS)[number]["value"]>(
    suggestedTitle ? "milestone" : defaultKind
  );
  const [bodyResetKey, setBodyResetKey] = useState(0);
  const prevPending = useRef(false);
  useActionToast(error, pending, {
    successMessage: kind === "event" ? "Event created!" : "Update posted!",
  });

  useEffect(() => {
    const justFinished = prevPending.current && !pending;
    prevPending.current = pending;
    // MentionTextarea is controlled, so it doesn't participate in the native
    // form-reset the other (uncontrolled) fields get for free on submit —
    // remount it on a successful post so the composer clears the same way.
    if (justFinished && error === null) {
      setBodyResetKey((key) => key + 1);
    }
  }, [pending, error]);

  const lockedByKind = Object.fromEntries(
    postingStatus.locked_kinds.map((item) => [item.kind, item])
  );
  const canPost = postingStatus.can_post;
  const isEvent = kind === "event";
  const isMilestone = kind === "milestone";
  const allowsPhoto = kind === "event" || kind === "update";

  if (compactCreateButton && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        disabled={!postingStatus.allowed_kinds.includes("event")}
        title={
          !postingStatus.allowed_kinds.includes("event")
            ? lockedByKind.event?.reason
            : undefined
        }
        className="self-start rounded-xl bg-beedero-black px-5 py-2.5 text-sm font-bold text-beedero-yellow shadow-sm hover:bg-beedero-yellow hover:text-beedero-black disabled:cursor-not-allowed disabled:opacity-40"
      >
        + Create event
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-2xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm"
    >
      <input type="hidden" name="slug" value={slug} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-extrabold text-zinc-900">
          {compactCreateButton ? "Create event" : "Share an update"}
        </h3>
        {compactCreateButton && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="text-xs font-medium text-zinc-500 hover:text-beedero-black"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-beedero-border bg-beedero-yellow/10 px-4 py-3 text-sm">
        {canPost ? (
          <p className="font-semibold text-beedero-black">1 post available today</p>
        ) : (
          <p className="font-semibold text-beedero-black">{slotLabel(postingStatus.next_slot_at)}</p>
        )}
        {postingStatus.freshness && (
          <p className="mt-1 text-xs text-zinc-600">Profile: {postingStatus.freshness}</p>
        )}
      </div>

      {!compactCreateButton && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
            Type
            <select
              name="kind"
              value={kind}
              onChange={(event) =>
                setKind(event.target.value as (typeof POST_KIND_OPTIONS)[number]["value"])
              }
              className="rounded-lg border border-beedero-border px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
            >
              {POST_KIND_OPTIONS.map((option) => {
                const locked = lockedByKind[option.value];
                const allowed = postingStatus.allowed_kinds.includes(option.value);
                return (
                  <option key={option.value} value={option.value} disabled={!allowed}>
                    {option.label}
                    {!allowed && locked ? ` (level ${locked.unlocks_at_level})` : ""}
                  </option>
                );
              })}
            </select>
          </label>
          {!postingStatus.allowed_kinds.includes(kind) && lockedByKind[kind] && (
            <p className="text-xs text-amber-800">
              {lockedByKind[kind].reason}{" "}
              <Link href={`/dashboard/${slug}?tab=credibility`} className="font-semibold underline">
                View credibility ladder
              </Link>
            </p>
          )}
        </div>
      )}

      {compactCreateButton && <input type="hidden" name="kind" value="event" />}

      {(kind === "update" || isEvent || isMilestone) && (
        <input
          name="title"
          placeholder={isEvent ? "Event title" : "Title"}
          defaultValue={suggestedTitle}
          required={!compactCreateButton || isEvent}
          className="rounded-lg border border-beedero-border px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
        />
      )}

      {isEvent && (
        <>
          <div className="flex flex-wrap gap-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
              Start
              <input
                type="datetime-local"
                name="starts_at"
                required
                className="rounded-lg border border-beedero-border px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
              End
              <input
                type="datetime-local"
                name="ends_at"
                required
                className="rounded-lg border border-beedero-border px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
              Format
              <select
                name="format"
                defaultValue="online"
                className="rounded-lg border border-beedero-border px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
              >
                {EVENT_FORMATS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <input
            name="location"
            placeholder="Location or meeting link (optional)"
            className="rounded-lg border border-beedero-border px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
          />
          <input
            name="registration_url"
            type="url"
            placeholder="Registration URL (optional)"
            className="rounded-lg border border-beedero-border px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
          />
        </>
      )}

      {isMilestone && (
        <div className="flex flex-wrap gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
            Category
            <select
              name="category"
              defaultValue="traction"
              className="rounded-lg border border-beedero-border px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
            >
              {MILESTONE_CATEGORIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
            When it happened (optional)
            <input
              type="date"
              name="occurred_at"
              className="rounded-lg border border-beedero-border px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
            />
          </label>
        </div>
      )}

      <MentionTextarea
        key={bodyResetKey}
        name="body"
        placeholder={kind === "update" ? "Say more..." : "Description (optional)"}
        rows={3}
        defaultValue={suggestedBody}
        required={kind === "update"}
        className="rounded-lg border border-beedero-border px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
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
        isMilestone && (
          <p className="text-xs text-zinc-500">Milestones are text-only and cannot include photos.</p>
        )
      )}

      <button
        disabled={
          !canPost ||
          pending ||
          (!compactCreateButton && !postingStatus.allowed_kinds.includes(kind))
        }
        className="self-start rounded-xl bg-beedero-yellow px-4 py-2 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Publishing..." : compactCreateButton ? "Create event" : "Publish"}
      </button>
    </form>
  );
}
