"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, CalendarCheck, Check, ShieldCheck } from "lucide-react";

import { OpenSectionButton } from "@/components/profile/ProfileEditorContext";

import type {
  LadderAction,
  LadderBand,
  LadderRung,
  PostingCadence,
  VerificationLadder,
} from "@/lib/person-vitality";

/** Rung actions that open a section of this page (the rest are other pages). */
const SECTION_ACTIONS = new Set<LadderAction>(["identity", "about", "experience", "skills"]);

const PAGE_ACTIONS: Partial<Record<NonNullable<LadderAction>, { href: string; label: string }>> = {
  discover: { href: "/discovery?tab=people", label: "Find people" },
  post: { href: "/feed", label: "Post" },
};

/** Each band says who does the confirming — the whole point of the grouping. */
const BANDS: { key: LadderBand; label: string; note: string }[] = [
  { key: "you", label: "Foundation", note: "Confirmed by you" },
  { key: "others", label: "External proof", note: "Confirmed by others" },
  { key: "record", label: "Independent trust", note: "Confirmed by your history" },
];

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
        <h2 className="text-xl font-black tracking-[-0.02em]">{title}</h2>
      </div>
      <p className="mt-2 text-xs leading-5 text-white/45">{note}</p>
    </>
  );
}

/* ---------------------------------------------------------------- 1. ladder */

const ACTION_STRIP =
  "inline-flex min-h-11 shrink-0 items-center bg-beedero-yellow px-3 text-xs font-black text-beedero-black";
const ACTION_FOOTER =
  "group flex w-full items-center justify-between gap-3 bg-beedero-yellow p-4 text-left text-beedero-black";

function RungAction({ rung, className }: { rung: LadderRung; className: string }) {
  if (!rung.action) return null;
  if (SECTION_ACTIONS.has(rung.action)) {
    return (
      <OpenSectionButton section={rung.action} className={className}>
        Add
      </OpenSectionButton>
    );
  }
  const page = PAGE_ACTIONS[rung.action];
  return page ? (
    <Link href={page.href} className={className}>
      {page.label}
    </Link>
  ) : null;
}

/** Seven small squares for "a week on the record": days posted in a row. */
function DayDots({ progress }: { progress: number }) {
  return (
    <span className="mt-1 flex items-center gap-1" aria-label={`${progress} of 7 days`}>
      {Array.from({ length: 7 }, (_, index) => (
        <span
          key={index}
          aria-hidden
          className={`size-2 ${index < progress ? "bg-beedero-yellow" : "bg-white/10"}`}
        />
      ))}
      <span className="ml-1 text-xs tabular-nums text-white/45">{progress}/7</span>
    </span>
  );
}

/** The line under a step: who confirmed it and what, or who is going to. */
function confirmerLine(rung: LadderRung, isGate: boolean): string {
  // How the design marks where Discover opens, on the last rung of the band.
  const gate = isGate ? " · 50% gate" : "";
  if (!rung.done) return `${rung.attested_by}${gate}`;
  const who = rung.attested_by === "You" ? "added by you" : `by ${rung.attested_by.toLowerCase()}`;
  return `${rung.detail ? `${rung.detail} · ` : ""}${who}${gate}`;
}

/**
 * One row: the number (or a tick) in a hexagon, what the step is and who
 * confirms it, and on the right one word — Done, Next or Locked. No button per
 * row on purpose: the single yellow one at the foot of the card is the call to
 * action, and it points at whichever row says Next.
 */
function Rung({
  rung,
  index,
  isNext,
  isGate,
}: {
  rung: LadderRung;
  index: number;
  isNext: boolean;
  isGate: boolean;
}) {
  return (
    <li
      className={`-mx-2 grid grid-cols-[28px_1fr_auto] items-start gap-2.5 px-2 py-2.5 ${
        isNext ? "bg-beedero-yellow/[0.06]" : ""
      }`}
    >
      <span
        aria-hidden
        className={`mt-0.5 grid size-6 place-items-center text-[11px] font-black ${
          rung.done
            ? `bg-beedero-yellow text-beedero-black ${hexClipClass}`
            : isNext
              ? "border border-beedero-yellow text-beedero-yellow"
              : "border border-white/15 text-white/35"
        }`}
      >
        {rung.done ? <Check size={12} /> : index + 1}
      </span>

      <div className="min-w-0">
        <b className={`block text-sm leading-5 ${rung.done || isNext ? "" : "text-white/55"}`}>
          {rung.label}
        </b>
        <p className="mt-1 break-words text-xs leading-5 text-white/60">
          {confirmerLine(rung, isGate)}
        </p>
        {isNext && rung.hint && (
          <p className="mt-1.5 text-xs leading-5 text-white/70">{rung.hint}</p>
        )}
        {!rung.done && rung.progress ? <DayDots progress={rung.progress} /> : null}
        {rung.warning && (
          <p className="mt-1.5 text-xs font-bold leading-5 text-amber-300">{rung.warning}</p>
        )}
      </div>

      <span
        className={`mt-0.5 shrink-0 text-[10px] font-black uppercase tracking-[0.08em] ${
          rung.done ? "text-emerald-400" : isNext ? "text-beedero-yellow" : "text-white/35"
        }`}
      >
        {rung.done ? "Done" : isNext ? "Next" : "Locked"}
      </span>
    </li>
  );
}

/** The one filled button on the card: the step that comes next. */
function NextStepFooter({ ladder }: { ladder: VerificationLadder }) {
  const next = nextStep(ladder);
  if (!next || !next.action) return null;
  const after = Math.floor((100 * (ladder.done_count + 1)) / ladder.total_count);
  const page = next.action && !SECTION_ACTIONS.has(next.action) ? PAGE_ACTIONS[next.action] : null;
  const inner = (
    <>
      <span className="min-w-0">
        <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-beedero-black/55">
          Next level · {after}%
        </span>
        <b className="mt-1 block text-sm">{next.label}</b>
      </span>
      <ArrowRight size={16} className="shrink-0 transition group-hover:translate-x-1" aria-hidden />
    </>
  );
  return page ? (
    <Link href={page.href} className={ACTION_FOOTER}>
      {inner}
    </Link>
  ) : (
    <OpenSectionButton section={next.action} className={ACTION_FOOTER}>
      {inner}
    </OpenSectionButton>
  );
}

/** Gate steps first; after that, the next step with something to press. */
function nextStep(ladder: VerificationLadder): LadderRung | undefined {
  return (
    ladder.rungs.find((rung) => ladder.unlock_missing.includes(rung.key)) ??
    ladder.rungs.find((rung) => !rung.done && rung.action)
  );
}

/**
 * Eight rungs in three bands. The first band is the gate: four things a person
 * does alone, in minutes, that together are 50% and put them in Discover with
 * permission to send connection requests. Above that, every rung needs
 * somebody else — or, for the last one, a week of showing up.
 */
function VerificationLadderCard({ ladder }: { ladder: VerificationLadder }) {
  const next = nextStep(ladder);
  const stepsLeft = ladder.unlock_missing.length;
  const gateKey = ladder.rungs.filter((rung) => rung.band === "you").at(-1)?.key;

  return (
    <section
      className={`border bg-white/[0.025] ${
        ladder.unlocked ? "border-white/10" : "border-beedero-yellow/40"
      }`}
      aria-labelledby="ladder-title"
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-beedero-yellow" aria-hidden />
              <h2 id="ladder-title" className="text-xl font-black tracking-[-0.02em]">
                Verification ladder
              </h2>
            </div>
            <p className="mt-2 text-xs leading-5 text-white/55">
              Eight steps. Each one shows who confirms it.
            </p>
          </div>
          <span className="shrink-0 border border-beedero-yellow/40 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-beedero-yellow">
            Level {ladder.level}
          </span>
        </div>

        <div
          className="mt-5 grid grid-cols-8 gap-1"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={ladder.percent}
          aria-label="Verification"
        >
          {ladder.rungs.map((rung, index) => (
            <span
              key={rung.key}
              aria-hidden
              className={`h-1.5 ${index < ladder.done_count ? "bg-beedero-yellow" : "bg-white/10"}`}
            />
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-[10px] font-black uppercase tracking-[0.1em]">
          <span className={ladder.unlocked ? "text-beedero-yellow" : "text-white/50"}>
            {ladder.percent}% · {ladder.unlocked ? "In Discover" : "Discover at 50%"}
          </span>
          <span className="text-white/50">
            {ladder.done_count} of {ladder.total_count}
          </span>
        </div>

        <p
          className={`mt-3 text-xs leading-5 ${ladder.unlocked ? "text-emerald-400" : "text-white/70"}`}
        >
          {ladder.unlocked
            ? "You're in Discover. People can find you, and you can ask to connect."
            : `${stepsLeft} ${stepsLeft === 1 ? "step" : "steps"} to Discover — then people can find you and you can ask to connect.`}
        </p>
      </div>

      <div className="border-t border-white/10">
        {BANDS.map((band) => (
          <div key={band.key} className="border-b border-white/[0.07] p-5 last:border-0">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/50">
                {band.label}
              </p>
              <p className="text-[10px] text-white/40">{band.note}</p>
            </div>
            <ol className="space-y-1.5">
              {ladder.rungs
                .map((rung, index) => ({ rung, index }))
                .filter(({ rung }) => rung.band === band.key)
                .map(({ rung, index }) => (
                  <Rung
                    key={rung.key}
                    rung={rung}
                    index={index}
                    isNext={rung.key === next?.key}
                    isGate={rung.key === gateKey}
                  />
                ))}
            </ol>
          </div>
        ))}
      </div>

      <NextStepFooter ladder={ladder} />
    </section>
  );
}

/* --------------------------------------------------------------- 2. cadence */

const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

/** Seven slots for the current Lisbon week (Mon → Sun). */
function WeekDayDots({ cadence }: { cadence: PostingCadence }) {
  const todayIndex = Math.min(6, Math.max(0, cadence.today_index ?? 0));
  const days = cadence.week_days?.length === 7 ? cadence.week_days : Array(7).fill(false);

  return (
    <div className="mt-4 grid grid-cols-7 gap-1.5" aria-hidden>
      {days.map((posted, index) => {
        const isToday = index === todayIndex;
        return (
          <div key={index} className="flex flex-col items-center gap-1">
            <span
              className={`h-6 w-full ${
                posted
                  ? "bg-beedero-yellow"
                  : isToday
                    ? "border border-dashed border-beedero-yellow"
                    : "bg-white/10"
              }`}
            />
            <span className={`text-[9px] font-black ${isToday ? "text-beedero-yellow" : "text-white/30"}`}>
              {WEEKDAY_LABELS[index]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PostingCadenceCard({ cadence }: { cadence: PostingCadence }) {
  const dayLabel = cadence.streak_days === 1 ? "day" : "days";
  return (
    <section className={panelClass}>
      <CardHeading
        Icon={CalendarCheck}
        iconClass="text-beedero-yellow"
        title="Week cadence"
        note="One post a day, every day. This is the one thing the record asks of you."
      />

      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <b className="text-3xl font-black tabular-nums">{cadence.streak_days}</b>
          <span className="ml-1.5 text-xs text-white/45">{dayLabel} running</span>
        </div>
        {cadence.posted_today ? (
          <span className="text-[10px] font-black uppercase tracking-[0.12em] text-beedero-yellow">
            Today done
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

      <WeekDayDots cadence={cadence} />

      <p className="mt-3 text-[10px] leading-4 text-white/40">
        {cadence.posted_today
          ? cadence.hours_left <= 1
            ? "Tomorrow opens in under an hour."
            : `Tomorrow opens in ${cadence.hours_left} hours.`
          : cadence.streak_days > 0
            ? `Post today to keep a ${cadence.streak_days}-${dayLabel} run alive.`
            : "Post today to start the run."}
      </p>

      {cadence.best_streak_days > cadence.streak_days && (
        <p className="mt-4 border-t border-white/10 pt-4 text-[10px] font-black uppercase tracking-[0.15em] text-white/35">
          Best run {cadence.best_streak_days} days · {cadence.days_posted} days posted
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------- aside */

/**
 * Phones get the one most useful open step at the top of the page instead of
 * the ladder at the bottom (the aside sits below the content under the `xl`
 * breakpoint). Gate steps first; after that, the next step with something to
 * press.
 */
export function NextStepStrip({ ladder }: { ladder: VerificationLadder | null }) {
  if (!ladder) return null;
  const next = nextStep(ladder);
  if (!next) return null;
  return (
    <div className="flex items-center gap-3 border border-beedero-yellow/40 bg-beedero-yellow/[0.06] px-4 py-3 xl:hidden">
      <span className="text-[10px] font-black tabular-nums text-beedero-yellow">
        {ladder.percent}%
      </span>
      <span className="min-w-0 flex-1 text-xs">
        <b className="block">{next.label}</b>
        <span className="text-white/50">
          {ladder.unlocked
            ? next.hint
            : `${ladder.unlock_missing.length} ${ladder.unlock_missing.length === 1 ? "step" : "steps"} to Discover. ${next.hint}`}
        </span>
      </span>
      <RungAction rung={next} className={ACTION_STRIP} />
    </div>
  );
}

/**
 * The aside of the one-page profile: insights link, the verification ladder
 * (which now also holds what "Complete your profile" used to ask for — its
 * first band is those fields) and the week cadence.
 */
export function ProfileAside({
  ladder,
  cadence,
}: {
  ladder: VerificationLadder | null;
  cadence: PostingCadence | null;
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
      {ladder && <VerificationLadderCard ladder={ladder} />}
      {cadence && <PostingCadenceCard cadence={cadence} />}
    </aside>
  );
}
