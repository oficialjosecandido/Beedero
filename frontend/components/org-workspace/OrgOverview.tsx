"use client";

import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";

import { formatCompactCurrency, formatRelativeTime } from "@/lib/format";
import { SECTION_LABELS } from "@/lib/types";

import type { OrgTabId } from "./tabs";
import {
  OrgCard,
  OrgCardHeading,
  OrgMark,
  orgEyebrowClass,
  orgInkButtonClass,
  orgBrutalBorder,
} from "./ui";

export type LadderRung = { key: string; label: string; hint: string; done: boolean };
export type SignalItem = {
  id: number;
  kind: string;
  title: string;
  detail: string;
  at: string;
};
export type NarrativeContent = {
  mission: string;
  summary: string;
  focus: string;
  nextEvent: { title: string; at: string } | null;
};

/* ------------------------------------------------------------------ hero */

export function OrgHero({
  name,
  logo,
  oneLiner,
  slug,
  isVerified,
  isDraft,
  isFundraising,
  meta,
  teamCount,
  capitalRaised,
  recordScore,
  verifiedSignals,
}: {
  name: string;
  logo: string | null;
  oneLiner: string;
  slug: string;
  isVerified: boolean;
  isDraft: boolean;
  isFundraising: boolean;
  meta: string[];
  teamCount: number;
  capitalRaised: number | null;
  recordScore: number;
  verifiedSignals: number;
}) {
  const stats: { value: string; label: string }[] = [
    { value: String(teamCount), label: "Team members" },
    { value: formatCompactCurrency(capitalRaised), label: "Capital raised" },
    { value: String(recordScore), label: "Record score" },
    { value: String(verifiedSignals), label: "Verified signals" },
  ];

  return (
    <div className={`${orgBrutalBorder} bg-org-ink p-5 text-white sm:p-8`}>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex min-w-0 items-start gap-4">
          <OrgMark name={name} logo={logo} className="size-16 text-3xl" inverted />
          <div className="min-w-0">
            <p className={`${orgEyebrowClass} text-beedero-yellow`}>
              {isVerified ? "Verified organisation" : isDraft ? "Draft organisation" : "Organisation"}
            </p>
            <h1 className="mt-1 text-4xl font-black tracking-[-0.055em] sm:text-5xl">{name}</h1>
            {oneLiner && <p className="mt-2 max-w-xl text-sm text-white/65">{oneLiner}</p>}
            {meta.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-white/45">
                {meta.map((entry, index) => (
                  <span key={entry} className="flex items-center gap-3">
                    {index > 0 && <span aria-hidden>•</span>}
                    {entry}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {isDraft ? (
            <span className="border border-white/25 px-4 py-2.5 text-xs font-black text-white/70">
              Not published yet
            </span>
          ) : (
            <span className="border border-beedero-yellow bg-beedero-yellow px-4 py-2.5 text-xs font-black text-org-ink">
              Live
            </span>
          )}
          {isFundraising && (
            <span className="border border-white/25 px-4 py-2.5 text-xs font-black text-white">
              Fundraising
            </span>
          )}
          <Link
            href={`/o/${slug}`}
            className="flex items-center gap-2 border border-white/25 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-white hover:text-black"
          >
            <ArrowUpRight size={14} aria-hidden /> View public profile
          </Link>
        </div>
      </div>

      <div className="mt-8 grid border-t border-white/15 pt-5 sm:grid-cols-4">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className={`border-white/15 py-3 sm:px-5 ${
              index === 0 ? "sm:border-r sm:pl-0" : index === 3 ? "sm:pl-5" : "sm:border-r"
            }`}
          >
            <b className="text-3xl font-black tabular-nums">{stat.value}</b>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- narrative */

function NarrativeTile({
  eyebrow,
  eyebrowClass,
  title,
  detail,
  onEdit,
  editLabel,
}: {
  eyebrow: string;
  eyebrowClass: string;
  title: string;
  detail: string;
  onEdit?: () => void;
  editLabel?: string;
}) {
  return (
    <article className="border border-org-ink bg-org-cream p-4">
      <p className={`text-[9px] font-black uppercase tracking-[0.14em] ${eyebrowClass}`}>
        {eyebrow}
      </p>
      <h3 className="mt-2 text-sm font-bold">{title}</h3>
      {detail && <p className="mt-2 text-xs leading-5 text-black/55">{detail}</p>}
      {onEdit && editLabel && (
        <button
          type="button"
          onClick={onEdit}
          className="mt-3 text-[11px] font-bold text-org-gold underline underline-offset-2 hover:text-org-ink"
        >
          {editLabel}
        </button>
      )}
    </article>
  );
}

export function OrgNarrative({
  name,
  content,
  canManage,
  onSelect,
}: {
  name: string;
  content: NarrativeContent;
  canManage: boolean;
  onSelect: (tab: OrgTabId) => void;
}) {
  return (
    <OrgCard className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <OrgCardHeading
          eyebrow="Organisation narrative"
          title={content.mission || "Tell your story."}
        />
        {canManage && (
          <button type="button" onClick={() => onSelect("activity")} className={orgInkButtonClass}>
            <Plus size={14} aria-hidden /> Add update
          </button>
        )}
      </div>

      <p className="mt-5 max-w-2xl text-sm leading-7 text-black/65">
        {content.summary ||
          `There is no About text for ${name} yet. It is the first thing a partner reads on the public profile.`}
      </p>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        <NarrativeTile
          eyebrow="Current focus"
          eyebrowClass="text-org-ink"
          title={content.focus || "No products described"}
          detail={
            content.focus
              ? ""
              : "Say what you sell or offer, so partners know what they are looking at."
          }
          onEdit={canManage && !content.focus ? () => onSelect("profile") : undefined}
          editLabel="Add products"
        />
        <NarrativeTile
          eyebrow="Next event"
          eyebrowClass="text-[#e4573d]"
          title={content.nextEvent?.title ?? "Nothing scheduled"}
          detail={
            content.nextEvent
              ? content.nextEvent.at
              : "Events are the clearest sign an organisation is active."
          }
          onEdit={canManage && !content.nextEvent ? () => onSelect("calendar") : undefined}
          editLabel="Create an event"
        />
      </div>
    </OrgCard>
  );
}

/* ------------------------------------------------------- credibility ladder */

export function OrgCredibilityLadder({
  name,
  rungs,
  onSelect,
}: {
  name: string;
  rungs: LadderRung[];
  onSelect: (tab: OrgTabId) => void;
}) {
  const done = rungs.filter((rung) => rung.done).length;

  return (
    <OrgCard tone="yellow" className="min-w-0">
      <div className="flex items-start justify-between gap-4">
        <OrgCardHeading eyebrow="Credibility ladder" title="Proof, not polish." />
        <span className="shrink-0 border border-black bg-org-ink px-2 py-1 text-[10px] font-black uppercase text-white">
          {done} / {rungs.length} verified
        </span>
      </div>
      <p className="mt-3 max-w-sm text-xs leading-5 text-black/65">
        A visible record of the evidence behind {name}.
      </p>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {rungs.map((rung, index) => (
          <div
            key={rung.key}
            className={`flex min-h-20 gap-3 border p-3 ${
              rung.done ? "border-black bg-white" : "border-black/30 bg-beedero-yellow"
            } text-black`}
          >
            <span
              className={`grid size-7 shrink-0 place-items-center text-xs font-black ${
                rung.done ? "bg-org-ink text-white" : "border border-black text-black"
              }`}
              aria-hidden
            >
              {rung.done ? "✓" : index + 1}
            </span>
            <div className="min-w-0">
              <b className="block text-xs">{rung.label}</b>
              <small className="mt-1 block text-[10px] leading-4 text-black/60">{rung.hint}</small>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onSelect("insights")}
        className="mt-5 flex w-full items-center justify-between bg-org-ink px-4 py-3 text-xs font-black text-white transition hover:bg-white hover:text-black"
      >
        View organisation insights <ArrowUpRight size={14} aria-hidden />
      </button>
    </OrgCard>
  );
}

/* ------------------------------------------------------------- signal log */

/** Milestones read as progress, events as scheduled, everything else as news. */
function signalTone(kind: string) {
  if (kind === "milestone") return "bg-beedero-yellow";
  if (kind === "events") return "bg-org-ink";
  return "bg-[#7c5cc4]";
}

export function OrgSignalLog({
  signals,
  onSelect,
}: {
  signals: SignalItem[];
  onSelect: (tab: OrgTabId) => void;
}) {
  return (
    <OrgCard className="mt-6 min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <OrgCardHeading eyebrow="Signal log" title="What is moving." />
        <button
          type="button"
          onClick={() => onSelect("activity")}
          className="text-xs font-bold text-black/55 transition hover:text-org-ink hover:underline"
        >
          See all activity
        </button>
      </div>

      {signals.length === 0 ? (
        <p className="mt-6 border border-dashed border-black/25 p-4 text-sm text-black/55">
          No posts yet. An organisation that posts weekly keeps its record alive.
        </p>
      ) : (
        <div className="mt-6 divide-y divide-black/10">
          {signals.map((signal) => (
            <article
              key={signal.id}
              className="grid gap-3 py-4 first:pt-0 sm:grid-cols-[12px_1fr_auto]"
            >
              <span className={`mt-1.5 size-3 ${signalTone(signal.kind)}`} aria-hidden />
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-black/40">
                  {SECTION_LABELS[signal.kind] ?? signal.kind}
                </p>
                <h3 className="mt-1 text-sm font-bold">{signal.title}</h3>
                {signal.detail && (
                  <p className="mt-1 text-xs leading-5 text-black/55">{signal.detail}</p>
                )}
              </div>
              <span className="text-xs text-black/40 sm:text-right">
                {formatRelativeTime(signal.at)}
              </span>
            </article>
          ))}
        </div>
      )}
    </OrgCard>
  );
}
