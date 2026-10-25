"use client";

import { useState } from "react";

import { formatDate } from "@/lib/format";
import { SITE_URL } from "@/lib/site-metadata";

type BadgeEmbed = {
  html: string;
  verify_url: string;
  badge_url: string;
  json_url: string;
};

type VitalityBadge = {
  level: number;
  visual_status: "verified" | "expiring" | "expired" | "unverified";
  valid_until: string | null;
  days_until_expiry: number | null;
};

const STATUS_STYLES: Record<VitalityBadge["visual_status"], string> = {
  verified: "bg-beedero-yellow text-beedero-black",
  expiring: "bg-amber-100 text-amber-900",
  expired: "bg-zinc-200 text-zinc-600",
  unverified: "bg-zinc-100 text-zinc-500",
};

const STATUS_LABELS: Record<VitalityBadge["visual_status"], string> = {
  verified: "Verified",
  expiring: "Expiring soon",
  expired: "Expired",
  unverified: "Not verified",
};

export function BadgeEmbedPanel({
  embed,
  badge,
}: {
  embed: BadgeEmbed;
  badge: VitalityBadge;
}) {
  const [copied, setCopied] = useState(false);

  async function copySnippet() {
    await navigator.clipboard.writeText(embed.html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-2xl border-2 border-beedero-border bg-beedero-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-zinc-900">Your badge</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Embed a live badge on your site — it links to your public Beedero profile.
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLES[badge.visual_status]}`}>
          {badge.level > 0 ? STATUS_LABELS[badge.visual_status] : "Profile active"}
          {badge.level > 0 && ` · Level ${badge.level}`}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={embed.badge_url} alt="Beedero profile badge" className="h-12 w-auto" />
        <div className="text-sm text-zinc-600">
          <a
            href={embed.verify_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex font-semibold text-beedero-black underline decoration-beedero-yellow decoration-2 underline-offset-4"
          >
            Preview public profile
          </a>
          {badge.valid_until && badge.level > 0 && (
            <p className="mt-1 text-xs text-subtle">
              {badge.days_until_expiry != null && badge.days_until_expiry <= 30
                ? `Expires in ${badge.days_until_expiry} days`
                : `Valid until ${formatDate(badge.valid_until)}`}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-beedero-border bg-zinc-50 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Embed code</p>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all text-xs text-zinc-700">
          {embed.html}
        </pre>
        <button
          type="button"
          onClick={copySnippet}
          className="mt-3 rounded-lg bg-beedero-yellow px-3 py-1.5 text-xs font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-yellow"
        >
          {copied ? "Copied!" : "Copy embed code"}
        </button>
      </div>
    </div>
  );
}

export function PresenceSignalsPanel({
  presence,
}: {
  presence: {
    investor_views: number;
    new_followers: number;
    interest: number;
    since_days: number;
    has_signal: boolean;
  };
}) {
  if (!presence.has_signal) return null;

  const lines: string[] = [];
  if (presence.investor_views > 0) {
    lines.push(
      `${presence.investor_views} investor${presence.investor_views === 1 ? "" : "s"} viewed your profile`
    );
  }
  if (presence.new_followers > 0) {
    lines.push(`${presence.new_followers} new follower${presence.new_followers === 1 ? "" : "s"}`);
  }
  if (presence.interest > 0) {
    lines.push(`${presence.interest} interest signal${presence.interest === 1 ? "" : "s"}`);
  }

  return (
    <div className="rounded-2xl border-2 border-beedero-border bg-gradient-to-br from-beedero-yellow/20 to-beedero-white p-6 shadow-sm">
      <h3 className="font-extrabold text-zinc-900">Who&apos;s looking this week</h3>
      <p className="mt-1 text-sm text-zinc-500">
        Aggregated signals from the last {presence.since_days} days — no names shown here.
      </p>
      <ul className="mt-3 flex flex-col gap-1.5">
        {lines.map((line) => (
          <li key={line} className="text-sm font-semibold text-beedero-black">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function verifyPageUrl(slug: string) {
  return `${SITE_URL}/verify/${slug}`;
}
