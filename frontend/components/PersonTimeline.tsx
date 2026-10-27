import Link from "next/link";

import { formatDate } from "@/lib/format";

type TimelineSkill = { skill: string; status: string };
type TimelineMilestone = { id: number; title: string; occurred_at: string };
export type TimelineBand = {
  org_name: string;
  org_slug: string | null;
  kind?: "work" | "education";
  role: string;
  title: string;
  description?: string;
  started_on: string;
  ended_on: string | null;
  verified: boolean;
  verified_via: string | null;
  skills: TimelineSkill[];
  milestones: TimelineMilestone[];
};

export const profileSkillPillClass =
  "border border-white/15 bg-white/[0.04] px-3 py-1 text-xs font-medium text-white/85";

export const profileSectionHeadingClass =
  "text-[10px] font-black uppercase tracking-[0.18em] text-beedero-yellow";

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
    <section className="border-t border-white/10 pt-8">
      {/* The tree above gives the shape; this is the record-by-record detail
          with milestones and the skills anchored to each one. */}
      <h2 className={profileSectionHeadingClass}>Record detail</h2>
      <div className="mt-5 flex flex-col gap-7">
        {bands.map((band, index) => {
          const start = toTime(band.started_on);
          const end = toTime(band.ended_on ?? today);
          const left = pct(start);
          const width = `${Math.max(((end - start) / axisSpan) * 100, 3).toFixed(2)}%`;

          return (
            <article key={`${band.org_name}-${band.started_on}-${index}`}>
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <p className="min-w-0 text-sm leading-snug text-white">
                  {band.org_slug ? (
                    <Link href={`/o/${band.org_slug}`} className="font-bold hover:text-beedero-yellow">
                      {band.org_name}
                    </Link>
                  ) : (
                    <span className="font-bold">{band.org_name}</span>
                  )}
                  {band.kind === "education" && (
                    <span className="ml-1.5 border border-white/15 bg-white/[0.04] px-2 py-0.5 align-middle text-[10px] font-black uppercase tracking-wide text-white/50">
                      Education
                    </span>
                  )}
                  {band.role && (
                    <>
                      <span className="mx-1.5 font-normal text-white/35">·</span>
                      <span className="font-normal text-white/55">{band.role}</span>
                    </>
                  )}
                </p>
                <div className="shrink-0 text-right">
                  <p className="text-xs tabular-nums text-white/40">
                    {formatDate(band.started_on)} –{" "}
                    {band.ended_on ? formatDate(band.ended_on) : "Present"}
                  </p>
                  <p
                    className={`mt-0.5 text-[10px] font-black uppercase tracking-[0.12em] ${
                      band.verified ? "text-emerald-400" : "text-white/40"
                    }`}
                  >
                    {band.verified
                      ? band.verified_via === "registry"
                        ? "Verified by registry"
                        : "Verified by organisation"
                      : "Self-declared"}
                  </p>
                </div>
              </div>

              <div className="relative mt-3 h-4 w-full bg-white/10" aria-hidden>
                <div
                  className={
                    band.verified
                      ? "absolute top-0.5 bottom-0.5 min-w-1.5 bg-beedero-yellow"
                      : "absolute top-0.5 bottom-0.5 min-w-1.5 border-2 border-dashed border-white/35 bg-transparent"
                  }
                  style={{ left, width }}
                  title={
                    band.verified
                      ? band.verified_via === "registry"
                        ? "Verified by registry"
                        : "Verified by organisation"
                      : "Self-declared"
                  }
                />
                {band.milestones.map((milestone) => (
                  <span
                    key={milestone.id}
                    className="absolute top-1/2 z-10 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-beedero-yellow ring-2 ring-app-surface"
                    style={{ left: pct(toTime(milestone.occurred_at)) }}
                    title={milestone.title}
                  />
                ))}
              </div>

              {band.description && (
                <p className="mt-2.5 max-w-2xl text-sm leading-6 text-white/60">{band.description}</p>
              )}

              {band.skills.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {band.skills.map((skill) => (
                    <span key={skill.skill} className={profileSkillPillClass}>
                      {skill.skill}
                      {skill.status === "org_confirmed" && (
                        <span className="ml-1 text-[10px] font-black text-emerald-400">✓</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
      <p className="mt-5 text-[11px] leading-relaxed text-white/40">
        Solid bars are verified by the organisation on Beedero. Dashed bars are self-declared.
      </p>
    </section>
  );
}
