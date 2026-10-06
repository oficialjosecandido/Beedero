"use client";

import { Eye } from "lucide-react";

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
  verified: "border-beedero-yellow/50 text-beedero-yellow",
  unverified: "border-white/20 text-white/55",
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
    <section className="border border-white/10 bg-white/[0.025] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black tracking-[-0.03em]">Your personal badge</h2>
          <p className="mt-1 text-xs leading-5 text-white/45">
            Your live badge links to your public Beedero profile.
          </p>
        </div>
        <span
          className={`border px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] ${
            STATUS_STYLES[badge.visual_status]
          }`}
        >
          Profile active
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewSrc} alt="Beedero personal badge" className="h-12 w-auto" />
        <div>
          <a
            href={profileUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-bold text-beedero-yellow transition hover:opacity-80"
          >
            Preview public profile →
          </a>
          <p className="mt-1 text-[11px] text-white/35">As of {formatDate(badge.as_of)}</p>
        </div>
      </div>
    </section>
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
    <section className="border border-white/10 bg-white/[0.025] p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Eye size={16} className="text-beedero-yellow" aria-hidden />
        <h2 className="text-xl font-black tracking-[-0.03em]">Who&apos;s looking this week</h2>
      </div>
      <p className="mt-2 text-xs leading-5 text-white/45">
        Aggregated signals from the last {presence.since_days} days — no names shown here.
      </p>
      <p className="mt-4 border-l-2 border-beedero-yellow pl-3 text-sm text-white/75">
        <b className="font-black tabular-nums">{presence.profile_views}</b>{" "}
        {presence.profile_views === 1 ? "person viewed" : "people viewed"} your profile
      </p>
    </section>
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
