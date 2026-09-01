import Link from "next/link";

import { formatDate } from "@/lib/format";

type TimelineSkill = { skill: string; status: string };
type TimelineMilestone = { id: number; title: string; occurred_at: string };
export type TimelineBand = {
  org_name: string;
  org_slug: string | null;
  role: string;
  title: string;
  started_on: string;
  ended_on: string | null;
  verified: boolean;
  verified_via: string | null;
  skills: TimelineSkill[];
  milestones: TimelineMilestone[];
};

export const profileSkillPillClass =
  "rounded-full border border-beedero-border bg-white px-3 py-1 text-xs font-medium text-zinc-800";

export const profileSectionHeadingClass =
  "text-xs font-bold uppercase tracking-[0.14em] text-zinc-400";

function toTime(value: string) {
  return new Date(value).getTime();
}

export function PersonTimeline({ bands }: { bands: TimelineBand[] }) {
  if (bands.length === 0) return null;

  const today = new Date().toISOString().slice(0, 10);
  const starts = bands.map((band) => toTime(band.started_on));
  const ends = bands.map((band) => toTime(band.ended_on ?? today));
  const axisStart = Math.min(...starts);
  const axisEnd = Math.max(...ends, toTime(today));
  const axisSpan = Math.max(axisEnd - axisStart, 1);

  function pct(value: number) {
    return `${(((value - axisStart) / axisSpan) * 100).toFixed(2)}%`;
  }

  return (
    <section className="border-t border-zinc-100 pt-8">
      <h2 className={profileSectionHeadingClass}>Timeline</h2>
      <div className="mt-5 flex flex-col gap-7">
        {bands.map((band, index) => {
          const start = toTime(band.started_on);
          const end = toTime(band.ended_on ?? today);
          const left = pct(start);
          const width = `${Math.max(((end - start) / axisSpan) * 100, 3).toFixed(2)}%`;

          return (
            <article key={`${band.org_name}-${band.started_on}-${index}`}>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <p className="min-w-0 text-sm leading-snug text-zinc-900">
                  {band.org_slug ? (
                    <Link href={`/o/${band.org_slug}`} className="font-bold hover:underline">
                      {band.org_name}
                    </Link>
                  ) : (
                    <span className="font-bold">{band.org_name}</span>
                  )}
                  {band.role && (
                    <>
                      <span className="mx-1.5 font-normal text-zinc-400">·</span>
                      <span className="font-normal text-zinc-500">{band.role}</span>
                    </>
                  )}
                </p>
                <p className="shrink-0 text-xs tabular-nums text-zinc-400 sm:text-right">
                  {formatDate(band.started_on)} –{" "}
                  {band.ended_on ? formatDate(band.ended_on) : "Present"}
                </p>
              </div>

              <div className="relative mt-3 h-4 w-full rounded-full bg-zinc-200/90" aria-hidden>
                <div
                  className={
                    band.verified
                      ? "absolute top-0.5 bottom-0.5 min-w-1.5 rounded-[6px] bg-beedero-black"
                      : "absolute top-0.5 bottom-0.5 min-w-1.5 rounded-[6px] border-2 border-dashed border-zinc-400 bg-white"
                  }
                  style={{ left, width }}
                  title={band.verified ? "Verified via Beedero" : "Self-declared"}
                />
                {band.milestones.map((milestone) => (
                  <span
                    key={milestone.id}
                    className="absolute top-1/2 z-10 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-beedero-yellow ring-2 ring-white"
                    style={{ left: pct(toTime(milestone.occurred_at)) }}
                    title={milestone.title}
                  />
                ))}
              </div>

              {band.skills.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {band.skills.map((skill) => (
                    <span key={skill.skill} className={profileSkillPillClass}>
                      {skill.skill}
                      {skill.status === "org_confirmed" && (
                        <span className="ml-1 text-[10px] font-bold text-emerald-600">✓</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
      <p className="mt-5 text-[11px] leading-relaxed text-zinc-400">
        Solid bars are verified via Beedero organizations. Dashed bars are self-declared.
      </p>
    </section>
  );
}
