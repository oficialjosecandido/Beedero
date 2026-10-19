"use client";

import Link from "next/link";
import { BarChart3, CalendarCheck, Check, ShieldCheck, SlidersHorizontal } from "lucide-react";

import { OpenSectionButton } from "@/components/profile/ProfileEditorContext";

import type {
  LadderRung,
  PostingCadence,
  ProfileCompletion,
  VerificationLadder,
} from "@/lib/person-vitality";

/** Completion keys (accounts/completeness.py) → the section that edits them. */
const SECTION_FOR: Record<string, string> = {
  full_name: "identity",
  headline: "identity",
  country: "identity",
  city: "identity",
  profile_picture: "identity",
  bio: "about",
  links: "about",
  skills: "skills",
};

const panelClass = "border border-white/10 bg-white/[0.025] p-5";
const hexClipClass = "[clip-path:polygon(25%_6%,75%_6%,100%_50%,75%_94%,25%_94%,0_50%)]";

function CardHeading({
  Icon,
  iconClass,
  title,
  note,
}: {
  Icon: typeof ShieldCheck;
  iconClass: string;
  title: string;
  note: string;
}) {
  return (
    <>
      <div className="flex items-center gap-2">
        <Icon size={16} className={iconClass} aria-hidden />
        <h2 className="text-xl font-black tracking-[-0.03em]">{title}</h2>
      </div>
      <p className="mt-2 text-xs leading-5 text-white/45">{note}</p>
    </>
  );
}

/* ---------------------------------------------------------------- 1. ladder */

function Rung({ rung, index }: { rung: LadderRung; index: number }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className={`grid size-5 shrink-0 place-items-center text-[9px] font-black ${hexClipClass} ${
          rung.done
            ? "bg-beedero-yellow text-beedero-black"
            : "border border-white/25 text-white/35"
        }`}
      >
        {rung.done ? <Check size={11} /> : index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <b className="block text-xs">{rung.label}</b>
        {rung.done ? (
          <small className="mt-0.5 block text-[10px] leading-4 text-white/40">
            {rung.detail ? `${rung.detail} · ` : ""}
            confirmed by {rung.attested_by.toLowerCase()}
          </small>
        ) : (
          <small className="mt-0.5 block text-[10px] leading-4 text-white/40">{rung.hint}</small>
        )}
        {rung.warning && (
          <small className="mt-1 block text-[10px] font-bold leading-4 text-amber-300">
            {rung.warning}
          </small>
        )}
      </div>
    </li>
  );
}

/**
 * Only rungs somebody else confirmed. Belonging to an organisation is one
 * route to "Role confirmed", never a requirement — a verified credential
 * climbs higher without any organisation at all.
 */
function VerificationLadderCard({ ladder }: { ladder: VerificationLadder }) {
  return (
    <section className={panelClass}>
      <CardHeading
        Icon={ShieldCheck}
        iconClass="text-beedero-yellow"
        title="Verification ladder"
        note="Each step is something somebody else confirmed. Private to you."
      />
      <ol className="mt-5 space-y-4">
        {ladder.rungs.map((rung, index) => (
          <Rung key={rung.key} rung={rung} index={index} />
        ))}
      </ol>
      <p className="mt-6 border-t border-white/10 pt-4 text-[10px] font-black uppercase tracking-[0.15em] text-beedero-yellow">
        Level {ladder.level} of {ladder.total_count}
        {ladder.done_count > ladder.level && (
          <span className="ml-2 font-bold normal-case tracking-normal text-white/40">
            ({ladder.done_count} done, {ladder.done_count - ladder.level} out of order)
          </span>
        )}
      </p>
    </section>
  );
}

/* --------------------------------------------------------------- 2. cadence */

/** Seven dots, oldest week first, the current one last. */
function StreakDots({ cadence }: { cadence: PostingCadence }) {
  const shown = 7;
  const filledFromEnd = cadence.posted_this_week ? cadence.streak_weeks : cadence.streak_weeks + 1;
  return (
    <div className="mt-4 flex gap-1.5" aria-hidden>
      {Array.from({ length: shown }, (_, index) => {
        const weeksAgo = shown - 1 - index;
        const isCurrent = weeksAgo === 0;
        const posted = weeksAgo < filledFromEnd && !(isCurrent && !cadence.posted_this_week);
        return (
          <span
            key={weeksAgo}
            className={`h-6 flex-1 ${
              posted
                ? "bg-emerald-400"
                : isCurrent
                  ? "border border-dashed border-beedero-yellow"
                  : "bg-white/10"
            }`}
          />
        );
      })}
    </div>
  );
}

function PostingCadenceCard({ cadence }: { cadence: PostingCadence }) {
  const weekLabel = cadence.streak_weeks === 1 ? "week" : "weeks";
  return (
    <section className={panelClass}>
      <CardHeading
        Icon={CalendarCheck}
        iconClass="text-emerald-400"
        title="Weekly cadence"
        note="One post a week, every week. This is the one thing the record asks of you."
      />

      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <b className="text-3xl font-black tabular-nums">{cadence.streak_weeks}</b>
          <span className="ml-1.5 text-xs text-white/45">{weekLabel} running</span>
        </div>
        {cadence.posted_this_week ? (
          <span className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-400">
            This week done
          </span>
        ) : (
          <Link
            href="/feed"
            className="bg-beedero-yellow px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-beedero-black"
          >
            Post now
          </Link>
        )}
      </div>

      <StreakDots cadence={cadence} />

      <p className="mt-3 text-[10px] leading-4 text-white/40">
        {cadence.posted_this_week
          ? `Next week opens in ${cadence.days_left} ${cadence.days_left === 1 ? "day" : "days"}.`
          : cadence.streak_weeks > 0
            ? `${cadence.days_left} ${cadence.days_left === 1 ? "day" : "days"} left to keep a ${cadence.streak_weeks}-${weekLabel} run alive.`
            : `${cadence.days_left} ${cadence.days_left === 1 ? "day" : "days"} left in this week.`}
      </p>

      {cadence.best_streak_weeks > cadence.streak_weeks && (
        <p className="mt-4 border-t border-white/10 pt-4 text-[10px] font-black uppercase tracking-[0.15em] text-white/35">
          Best run {cadence.best_streak_weeks} weeks · {cadence.weeks_posted} weeks posted
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------ 3. completion */

/**
 * Self-declared fields. Not a ladder and not a duty — nothing here is
 * confirmed by anybody, so it stays visually quieter than the two above.
 */
function ProfileCompletionCard({ completion }: { completion: ProfileCompletion }) {
  const missing = completion.items.filter((item) => !item.done);
  return (
    <section className={panelClass}>
      <CardHeading
        Icon={SlidersHorizontal}
        iconClass="text-white/40"
        title="Complete your profile"
        note="Self-declared — it decides how you turn up in search, not how trusted you are."
      />

      <div className="mt-4 flex items-center gap-3">
        <div className="h-1.5 flex-1 bg-white/10">
          <div className="h-full bg-white/50" style={{ width: `${completion.percent}%` }} />
        </div>
        <span className="text-[10px] font-black tabular-nums text-white/45">
          {completion.percent}%
        </span>
      </div>

      {missing.length === 0 ? (
        <p className="mt-4 text-xs text-white/45">Every field is filled in.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {missing.map((item) => (
            <li key={item.key} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0">
                <b className="block text-xs">{item.label}</b>
                <small className="mt-0.5 block text-[10px] leading-4 text-white/40">
                  {item.hint}
                </small>
              </span>
              <OpenSectionButton
                section={SECTION_FOR[item.key] ?? "identity"}
                className="shrink-0 px-2 py-1 text-[10px] font-bold text-beedero-yellow hover:underline"
              >
                Add
              </OpenSectionButton>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------- aside */

/**
 * Phones get the one most useful missing thing at the top of the page
 * instead of four cards at the bottom (the aside sits below the content
 * under the `xl` breakpoint).
 */
export function NextStepStrip({ completion }: { completion: ProfileCompletion | null }) {
  const next = completion?.items.find((item) => !item.done);
  if (!completion || !next) return null;
  return (
    <div className="flex items-center gap-3 border border-beedero-yellow/40 bg-beedero-yellow/[0.06] px-4 py-3 xl:hidden">
      <span className="text-[10px] font-black tabular-nums text-beedero-yellow">{completion.percent}%</span>
      <span className="min-w-0 flex-1 text-xs">
        <b className="block">{next.label}</b>
        <span className="text-white/50">{next.hint}</span>
      </span>
      <OpenSectionButton
        section={SECTION_FOR[next.key] ?? "identity"}
        className="min-h-11 shrink-0 bg-beedero-yellow px-3 text-xs font-black text-beedero-black"
      >
        Add
      </OpenSectionButton>
    </div>
  );
}

/**
 * The aside of the one-page profile: insights link, what others confirmed,
 * the weekly cadence, and what's left to fill in. "Who sees what" is gone —
 * every section now carries its own audience pill.
 */
export function ProfileAside({
  ladder,
  cadence,
  completion,
}: {
  ladder: VerificationLadder | null;
  cadence: PostingCadence | null;
  completion: ProfileCompletion | null;
}) {
  return (
    <aside className="h-fit space-y-5">
      <Link
        href="/profile/insights"
        className="flex items-center justify-between gap-3 border border-white/10 bg-white/[0.025] p-5 text-sm font-bold transition hover:border-beedero-yellow"
      >
        <span className="flex items-center gap-2">
          <BarChart3 size={16} className="text-beedero-yellow" aria-hidden /> Insights
        </span>
        <span className="text-xs font-normal text-white/45">Views, posts →</span>
      </Link>
      {completion && <ProfileCompletionCard completion={completion} />}
      {ladder && <VerificationLadderCard ladder={ladder} />}
      {cadence && <PostingCadenceCard cadence={cadence} />}
    </aside>
  );
}
