"use client";

import { formatDate } from "@/lib/format";
import { SITE_URL } from "@/lib/site-metadata";

type PersonBadgeEmbed = {
  html: string;
  profile_url: string;
  badge_url: string;
  json_url: string;
};

type PersonBadge = {
  handle: string | null;
  name: string;
  verified: boolean;
  visual_status: "verified" | "unverified";
  as_of: string;
};

const STATUS_STYLES = {
  verified: "bg-beedero-yellow text-beedero-black",
  unverified: "bg-zinc-100 text-zinc-500",
} as const;

export function PersonBadgeEmbedPanel({
  embed,
  badge,
}: {
  embed: PersonBadgeEmbed;
  badge: PersonBadge;
}) {
  const handle = badge.handle;
  const previewSrc = handle ? personBadgePath(handle) : embed.badge_url;
  const profileUrl = handle ? personProfileUrl(handle) : embed.profile_url;

  if (!handle && !embed.badge_url) return null;

  return (
    <div className="rounded-2xl border-2 border-beedero-border bg-beedero-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-zinc-900">Your personal badge</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Your live badge links to your public Beedero profile.
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLES[badge.visual_status]}`}>
          Profile active
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewSrc} alt="Beedero personal badge" className="h-12 w-auto" />
        <div className="text-sm text-zinc-600">
          <a
            href={profileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex font-semibold text-beedero-black underline decoration-beedero-yellow decoration-2 underline-offset-4"
          >
            Preview public profile
          </a>
          <p className="mt-1 text-xs text-zinc-400">As of {formatDate(badge.as_of)}</p>
        </div>
      </div>
    </div>
  );
}

export function PersonPresenceSignalsPanel({
  presence,
}: {
  presence: {
    profile_views: number;
    since_days: number;
    has_signal: boolean;
  };
}) {
  if (!presence.has_signal) return null;

  return (
    <div className="rounded-2xl border-2 border-beedero-yellow bg-beedero-yellow p-6 shadow-sm">
      <h3 className="font-extrabold text-zinc-900">Who&apos;s looking this week</h3>
      <p className="mt-1 text-sm text-zinc-500">
        Aggregated signals from the last {presence.since_days} days — no names shown here.
      </p>
      <p className="mt-3 text-sm font-semibold text-beedero-black">
        {presence.profile_views} {presence.profile_views === 1 ? "person viewed" : "people viewed"} your profile
      </p>
    </div>
  );
}

export function ProfileStrengthPanel({
  checklist,
  doneCount,
  totalCount,
  completeness,
}: {
  checklist: { key: string; done: boolean; hint: string }[];
  doneCount: number;
  totalCount: number;
  completeness: number;
}) {
  const LABELS: Record<string, string> = {
    basics: "Basics complete",
    org_link: "Linked to an organization",
    first_post: "First post published",
  };

  return (
    <div className="rounded-2xl border-2 border-beedero-border bg-beedero-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-extrabold text-zinc-900">Profile strength</h3>
        <span className="text-sm font-medium text-zinc-500">
          {doneCount}/{totalCount}
        </span>
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        Private checklist — stronger profiles rank higher in discovery and matching.
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full bg-beedero-yellow transition-all"
          style={{ width: `${completeness}%` }}
        />
      </div>
      <ul className="mt-4 flex flex-col gap-2">
        {checklist.map((item) => (
          <li key={item.key} className="flex items-start gap-2 text-sm">
            <span>{item.done ? "✅" : "⬜"}</span>
            <div>
              <p className={item.done ? "text-zinc-500 line-through" : "font-medium text-zinc-800"}>
                {LABELS[item.key] ?? item.key}
              </p>
              {!item.done && <p className="text-xs text-zinc-400">{item.hint}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function personProfileUrl(handle: string) {
  return `${SITE_URL}/p/${handle}`;
}

export function personBadgePath(handle: string) {
  return `/pbadge/${handle}.svg`;
}

export function personBadgeUrl(handle: string) {
  return `${SITE_URL}${personBadgePath(handle)}`;
}
