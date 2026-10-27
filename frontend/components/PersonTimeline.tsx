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

function yearOf(value: string) {
  return new Date(value).getUTCFullYear();
}

/** Year ticks across the shared axis, newest roles sit to the right. */
function axisYears(axisStart: number, axisEnd: number): number[] {
  const startYear = new Date(axisStart).getUTCFullYear();
  const endYear = new Date(axisEnd).getUTCFullYear();
  const span = endYear - startYear;
  if (span <= 0) return [endYear];
  const step = span <= 4 ? 1 : span <= 10 ? 2 : Math.ceil(span / 5);
  const years: number[] = [];
  for (let year = startYear; year < endYear; year += step) {
    years.push(year);
  }
  if (years[years.length - 1] !== endYear) years.push(endYear);
  return years;
}

export function PersonTimeline({ bands }: { bands: TimelineBand[] }) {
  if (bands.length === 0) return null;

  const today = new Date().toISOString().slice(0, 10);
  const starts = bands.map((band) => toTime(band.started_on));
  const ends = bands.map((band) => toTime(band.ended_on ?? today));
  const axisStart = Math.min(...starts);
  const axisEnd = Math.max(...ends, toTime(today));
  const axisSpan = Math.max(axisEnd - axisStart, 1);
  const years = axisYears(axisStart, axisEnd);

  function pct(value: number) {
    return `${(((value - axisStart) / axisSpan) * 100).toFixed(2)}%`;
  }

  return (
    <section className="border-t border-white/10 pt-8">
      {/* The tree above gives the shape; this is the record-by-record detail
          with milestones and the skills anchored to each one. */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className={profileSectionHeadingClass}>Record detail</h2>
        <p className="text-[11px] text-white/40">
          <span className="mr-3 inline-flex items-center gap-1.5">
            <span className="size-2 bg-beedero-yellow" aria-hidden />
            Verified
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 border border-dashed border-beedero-yellow/70 bg-beedero-yellow/20" aria-hidden />
            Self-declared
          </span>
        </p>
      </div>

      {/* Shared year axis — same scale for every row below. */}
      <div className="relative mt-5 h-5 border-b border-white/10" aria-hidden>
        {years.map((year) => {
          const left = pct(Date.UTC(year, 0, 1));
          return (
            <span
              key={year}
              className="absolute bottom-1 -translate-x-1/2 text-[10px] font-black tabular-nums text-white/35"
              style={{ left }}
            >
              {year}
            </span>
          );
        })}
        <span className="absolute bottom-1 right-0 text-[10px] font-black uppercase tracking-[0.12em] text-beedero-yellow">
          Now
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-6">
        {bands.map((band, index) => {
          const start = toTime(band.started_on);
          const end = toTime(band.ended_on ?? today);
          const left = pct(start);
          const width = `${Math.max(((end - start) / axisSpan) * 100, 2.5).toFixed(2)}%`;
          const ongoing = !band.ended_on;
          const yearsHeld = Math.max(1, yearOf(band.ended_on ?? today) - yearOf(band.started_on) + 1);
          const statusLabel = band.verified
            ? band.verified_via === "registry"
              ? "Verified by registry"
              : "Verified by organisation"
            : "Self-declared";

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
                    {statusLabel}
                  </p>
                </div>
              </div>

              <div
                className="relative mt-3 h-3 w-full overflow-hidden bg-white/[0.06] ring-1 ring-inset ring-white/10"
                role="img"
                aria-label={`${statusLabel} · ${yearsHeld} year${yearsHeld === 1 ? "" : "s"} on the record`}
              >
                {/* Span on the shared career axis */}
                <div
                  className={
                    band.verified
                      ? "absolute inset-y-0 min-w-[10px] bg-beedero-yellow"
                      : "absolute inset-y-0 min-w-[10px] border border-dashed border-beedero-yellow/55 bg-beedero-yellow/20"
                  }
                  style={{ left, width }}
                  title={statusLabel}
                >
                  {/* Start / end caps */}
                  <span
                    className={`absolute top-1/2 left-0 size-1.5 -translate-y-1/2 ${
                      band.verified ? "bg-beedero-black" : "bg-beedero-yellow"
                    }`}
                    aria-hidden
                  />
                  <span
                    className={`absolute top-1/2 right-0 size-1.5 -translate-y-1/2 ${
                      ongoing
                        ? "bg-beedero-yellow shadow-[0_0_8px_rgba(249,222,74,0.7)]"
                        : band.verified
                          ? "bg-beedero-black"
                          : "bg-beedero-yellow"
                    }`}
                    aria-hidden
                  />
                </div>

                {band.milestones.map((milestone) => (
                  <span
                    key={milestone.id}
                    className="absolute top-1/2 z-10 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white ring-2 ring-beedero-yellow"
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
    </section>
  );
}
