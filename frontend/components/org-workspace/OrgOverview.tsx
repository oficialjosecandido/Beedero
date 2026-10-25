"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowUpRight, Check, Plus } from "lucide-react";

import { activateOrgAction } from "@/app/(app)/dashboard/actions";
import { formatCompactCurrency, formatRelativeTime } from "@/lib/format";
import type { OrgLadder, OrgLadderBand, OrgLadderRung } from "@/lib/org-ladder";
import { SECTION_LABELS } from "@/lib/types";
import { useActionToast } from "@/lib/use-action-toast";

import type { OrgTabId } from "./tabs";
import {
  OrgCard,
  OrgCardHeading,
  OrgMark,
  orgEyebrowClass,
  orgInkButtonClass,
  orgBrutalBorder,
} from "./ui";

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
  verification,
  confirmations,
  onOpenLadder,
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
  /** Verification ladder, 0–100 (lib/org-ladder.ts). */
  verification: number;
  /** Ladder rungs confirmed by someone outside the team. */
  confirmations: number;
  /** Draft CTA — switches to overview and scrolls to the verification ladder. */
  onOpenLadder?: () => void;
}) {
  const stats: { value: string; label: string }[] = [
    { value: String(teamCount), label: "Team members" },
    { value: formatCompactCurrency(capitalRaised), label: "Capital raised" },
    { value: `${verification}%`, label: "Verification" },
    { value: String(confirmations), label: "Confirmed by others" },
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
            <button
              type="button"
              onClick={onOpenLadder}
              className="border border-beedero-yellow bg-beedero-yellow px-4 py-2.5 text-xs font-black text-org-ink transition hover:bg-white"
            >
              Draft — see what&apos;s missing
            </button>
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

/* ------------------------------------------------------ verification ladder */

const BAND_TITLES: Record<OrgLadderBand, string> = {
  team: "The team · unlocks Discover",
  others: "Someone else confirms",
  record: "Your record",
};

/** Workspace tab each rung opens; `personal_profile` leaves the workspace. */
const ACTION_TAB: Partial<Record<NonNullable<OrgLadderRung["action"]>, OrgTabId>> = {
  profile: "profile",
  team: "affiliations",
  registry: "affiliations",
  activity: "activity",
};

const ACTION_LABEL: Record<NonNullable<OrgLadderRung["action"]>, string> = {
  profile: "Add",
  personal_profile: "Finish my profile",
  team: "Ask the team",
  registry: "Send code",
  activity: "Post",
};

/** Only owners and admins edit the organisation; anyone on the team can post
 *  or finish their own profile. */
const MANAGER_ACTIONS = new Set(["profile", "team", "registry"]);

// 44px tall on phones (touch target), compact from `sm` up.
const actionClass =
  "inline-flex min-h-11 shrink-0 items-center self-start border border-org-ink bg-white px-2.5 text-[10px] font-black text-org-ink transition hover:bg-org-ink hover:text-white sm:min-h-8";

function RungAction({
  rung,
  canManage,
  onSelect,
}: {
  rung: OrgLadderRung;
  canManage: boolean;
  onSelect: (tab: OrgTabId) => void;
}) {
  if (rung.done || rung.pending || !rung.action) return null;
  if (MANAGER_ACTIONS.has(rung.action) && !canManage) return null;
  if (rung.action === "personal_profile") {
    return (
      <Link href="/profile" className={actionClass}>
        {ACTION_LABEL.personal_profile}
      </Link>
    );
  }
  const tab = ACTION_TAB[rung.action];
  if (!tab) return null;
  return (
    <button type="button" onClick={() => onSelect(tab)} className={actionClass}>
      {ACTION_LABEL[rung.action]}
    </button>
  );
}

function OrgRung({
  rung,
  index,
  canManage,
  onSelect,
}: {
  rung: OrgLadderRung;
  index: number;
  canManage: boolean;
  onSelect: (tab: OrgTabId) => void;
}) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className={`grid size-6 shrink-0 place-items-center text-[10px] font-black ${
          rung.done ? "bg-org-ink text-white" : "border border-org-ink text-org-ink"
        }`}
      >
        {rung.done ? <Check size={12} /> : index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <b className="block text-xs">
          {rung.label}
          <span className="sr-only">
            {rung.done ? " — done" : rung.pending ? " — in review" : " — to do"}
          </span>
        </b>
        {rung.done ? (
          <small className="mt-0.5 block break-words text-[10px] leading-4 text-black/60">
            {rung.detail ? `${rung.detail} · ` : ""}
            {rung.attested_by === "The team" ? "added by the team" : `by ${rung.attested_by.toLowerCase()}`}
          </small>
        ) : (
          <small className="mt-0.5 block text-[10px] leading-4 text-black/60">{rung.hint}</small>
        )}
        {rung.pending && (
          <small className="mt-1 inline-block bg-org-ink px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-white">
            In review
          </small>
        )}
        {!rung.done && rung.progress !== null && (
          <span className="mt-1.5 flex items-center gap-1" aria-label={`${rung.progress} of 7 days`}>
            {Array.from({ length: 7 }, (_, day) => (
              <span
                key={day}
                aria-hidden
                className={`size-2 ${day < (rung.progress ?? 0) ? "bg-org-ink" : "bg-black/15"}`}
              />
            ))}
            <span className="ml-1 text-[10px] tabular-nums text-black/55">{rung.progress}/7</span>
          </span>
        )}
        {rung.warning && (
          <small className="mt-1 block text-[10px] font-bold leading-4 text-[#b3261e]">{rung.warning}</small>
        )}
      </div>
      <RungAction rung={rung} canManage={canManage} onSelect={onSelect} />
    </li>
  );
}

function PublishButton({ slug }: { slug: string }) {
  const [error, formAction, pending] = useActionState(activateOrgAction, null);
  useActionToast(error, pending, { successMessage: "Published. You're in Discover." });
  return (
    <form action={formAction}>
      <input type="hidden" name="slug" value={slug} />
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 bg-org-ink px-4 text-xs font-black text-white transition hover:bg-black disabled:opacity-60"
      >
        {pending ? "Publishing…" : "Publish"}
      </button>
    </form>
  );
}

function ladderStatus(name: string, ladder: OrgLadder): string {
  const left = ladder.unlock_missing.length;
  const steps = `${left} ${left === 1 ? "step" : "steps"}`;
  if (ladder.listed) return `${name} is live and listed in Discover.`;
  if (ladder.status === "live") {
    return `${name} is live, but hidden from Discover until ${steps} ${left === 1 ? "is" : "are"} done again.`;
  }
  if (ladder.can_publish) return `Ready to publish. Once live, ${name} is listed in Discover.`;
  return `${steps} before ${name} can be published and listed in Discover.`;
}

/**
 * Eight rungs in three bands. The first band is the gate: four things the
 * team does alone, in minutes, that together are 50% and make the
 * organisation publishable — and, once live, listed in Discover. Above that,
 * every rung needs somebody outside the team, or a week of showing up.
 */
export function OrgVerificationLadder({
  name,
  slug,
  ladder,
  canManage,
  onSelect,
}: {
  name: string;
  slug: string;
  ladder: OrgLadder;
  canManage: boolean;
  onSelect: (tab: OrgTabId) => void;
}) {
  const bands: OrgLadderBand[] = ["team", "others", "record"];
  return (
    <OrgCard tone="yellow" className="min-w-0" id="verification-ladder">
      <div className="flex items-start justify-between gap-4">
        <OrgCardHeading eyebrow="Verification ladder" title="Proof, not polish." />
        <span className="shrink-0 border border-black bg-org-ink px-2 py-1 text-[10px] font-black uppercase text-white">
          {ladder.done_count} / {ladder.total_count}
        </span>
      </div>

      <div className="mt-5 flex items-baseline justify-between gap-3">
        <b className="text-4xl font-black tabular-nums">{ladder.percent}%</b>
        <span className="text-[10px] font-black uppercase tracking-[0.12em] text-black/55">
          {ladder.done_count} of {ladder.total_count} steps
        </span>
      </div>
      <div
        className="relative mt-2 h-2 border border-org-ink bg-white"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={ladder.percent}
        aria-label="Verification"
      >
        <div className="h-full bg-org-ink" style={{ width: `${ladder.percent}%` }} />
        <span aria-hidden className="absolute -top-1.5 left-1/2 h-4 w-0.5 bg-org-ink" />
      </div>
      <p aria-hidden className="mt-1 text-center text-[9px] font-black uppercase tracking-[0.12em] text-black/55">
        50% · Discover
      </p>

      <div
        className={`mt-4 flex flex-wrap items-center gap-3 border border-org-ink p-3 ${
          ladder.listed ? "bg-white" : "bg-org-cream"
        }`}
      >
        <p className="min-w-0 flex-1 text-xs font-bold leading-5">{ladderStatus(name, ladder)}</p>
        {ladder.can_publish && canManage && <PublishButton slug={slug} />}
        {ladder.can_publish && !canManage && (
          <p className="text-[10px] text-black/55">An owner or admin can publish.</p>
        )}
      </div>

      {bands.map((band) => {
        const rungs = ladder.rungs
          .map((rung, index) => ({ rung, index }))
          .filter(({ rung }) => rung.band === band);
        return (
          <div key={band} className="mt-5">
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-black/50">
              {BAND_TITLES[band]}
            </p>
            <ol className="mt-3 space-y-3.5">
              {rungs.map(({ rung, index }) => (
                <OrgRung
                  key={rung.key}
                  rung={rung}
                  index={index}
                  canManage={canManage}
                  onSelect={onSelect}
                />
              ))}
            </ol>
          </div>
        );
      })}

      <p className="mt-5 border-t border-black/20 pt-3 text-[10px] leading-4 text-black/55">
        Each step names who vouches for it. Visible to the team only.
      </p>
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
    <OrgCard className="min-w-0">
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
