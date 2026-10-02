"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import { createInvestorPostAction } from "@/app/(app)/dashboard/actions";
import { MentionTextarea } from "@/components/MentionTextarea";
import { useActionToast } from "@/lib/use-action-toast";

const POST_KIND_OPTIONS = [
  { value: "milestone", label: "Milestone" },
  { value: "update", label: "Update" },
];

type ChecklistItem = { key: string; done: boolean; hint: string; weight: number };

type FeedComposerProps = {
  name: string;
  profilePicture?: string | null;
  profileComplete: boolean;
  hasPostedToday: boolean;
  completeness?: number;
  checklist?: ChecklistItem[];
};

const REQUIRED_KEYS = ["full_name", "headline", "country"];
const FIELD_LABELS: Record<string, string> = {
  full_name: "your name",
  headline: "a headline",
  country: "your country",
};

function formatMissingList(keys: string[]): string {
  const labels = keys.map((key) => FIELD_LABELS[key] ?? key);
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

function Avatar({ name, profilePicture }: { name: string; profilePicture?: string | null }) {
  if (profilePicture) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={profilePicture} alt="" className="size-9 shrink-0 rounded-full object-cover" />
    );
  }
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#68738a] text-xs font-black text-white">
      {initials || name.charAt(0).toUpperCase()}
    </span>
  );
}

export function FeedComposer({
  name,
  profilePicture,
  profileComplete,
  hasPostedToday,
  completeness = 0,
  checklist = [],
}: FeedComposerProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [error, formAction, pending] = useActionState(createInvestorPostAction, null);
  const [kind, setKind] = useState(POST_KIND_OPTIONS[0].value);
  const prevPending = useRef(false);
  const allowsPhoto = kind === "update";
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
    const missingRequired = checklist
      .filter((item) => REQUIRED_KEYS.includes(item.key) && !item.done)
      .map((item) => item.key);
    const headline =
      missingRequired.length > 0
        ? `Add ${formatMissingList(missingRequired)} before sharing updates.`
        : "Finish the steps below before sharing updates.";

    return (
      <div className="border border-white/10 bg-white/[0.035] p-5">
        <div className="flex items-center gap-3">
          <Avatar name={name} profilePicture={profilePicture} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">Complete your profile to post</p>
            <p className="mt-0.5 text-sm text-white/45">{headline}</p>
          </div>
        </div>
        {checklist.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs font-semibold text-white/45">
              <span>Profile strength</span>
              <span>{completeness}%</span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden bg-white/10">
              <div className="h-full bg-beedero-yellow transition-all" style={{ width: `${completeness}%` }} />
            </div>
          </div>
        )}
        <Link
          href="/dashboard"
          className="mt-4 inline-flex bg-beedero-yellow px-3 py-1.5 text-sm font-bold text-beedero-black hover:opacity-90"
        >
          Go to dashboard
        </Link>
      </div>
    );
  }

  if (hasPostedToday) {
    return (
      <div className="border border-white/10 bg-white/[0.035] p-5">
        <div className="flex items-start gap-3">
          <Avatar name={name} profilePicture={profilePicture} />
          <div>
            <p className="text-sm font-semibold text-white">You have already posted today.</p>
            <p className="mt-1 text-sm text-white/45">
              Each profile can publish one update per day. Come back tomorrow.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-full items-center gap-4 border border-white/10 bg-white/[0.035] p-4 text-left text-sm text-white/45 transition hover:border-beedero-yellow/60"
      >
        <Avatar name={name} profilePicture={profilePicture} />
        Share an update with the people who matter…
      </button>
    );
  }

  return (
    <div className="border border-white/15 bg-app-surface">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <h2 className="text-xl font-black tracking-[-0.045em]">Make it useful.</h2>
          <p className="mt-0.5 text-xs text-white/40">Share an update with the people who matter.</p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-white/45 hover:text-white"
          aria-label="Close composer"
        >
          ✕
        </button>
      </div>
      <form action={formAction} className="flex flex-col gap-3 p-5">
        <div className="mb-1 flex items-center gap-2">
          <Avatar name={name} profilePicture={profilePicture} />
          <span className="text-sm font-bold">{name}</span>
          <span className="border border-white/20 bg-white/8 px-2 py-0.5 text-[10px] font-black text-white/55">
            UPDATE
          </span>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-white/55">
            Type
            <select
              name="kind"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
              className="border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-white outline-none focus:border-beedero-yellow"
            >
              {POST_KIND_OPTIONS.map((k) => (
                <option key={k.value} value={k.value} className="bg-app-surface text-white">
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
            className="min-w-[12rem] flex-1 border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-beedero-yellow"
          />
        </div>
        <MentionTextarea
          name="body"
          placeholder="What is worth sharing today? Links go here too."
          rows={4}
          className="border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-beedero-yellow"
        />
        {allowsPhoto ? (
          <label className="flex flex-col gap-1 text-xs font-medium text-white/55">
            Photo (optional)
            <input
              type="file"
              name="image"
              accept="image/*"
              className="text-sm text-white/70 file:mr-3 file:border-0 file:bg-beedero-yellow file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-beedero-black"
            />
          </label>
        ) : (
          <p className="text-xs text-white/40">Milestones are text-only and cannot include photos.</p>
        )}
        <div className="mt-2 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="text-xs text-white/40 hover:text-white/60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="bg-beedero-yellow px-5 py-2.5 text-xs font-black text-beedero-black disabled:opacity-40"
          >
            {pending ? "Publishing…" : "Publish"}
          </button>
        </div>
      </form>
    </div>
  );
}
