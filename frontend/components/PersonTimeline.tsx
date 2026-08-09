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
    <section className="mt-8">
      <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500">Timeline</h2>
      <div className="mt-3 flex flex-col gap-4">
        {bands.map((band, index) => {
          const start = toTime(band.started_on);
          const end = toTime(band.ended_on ?? today);
          const left = pct(start);
          const width = `${Math.max(((end - start) / axisSpan) * 100, 1).toFixed(2)}%`;

          return (
            <div key={`${band.org_name}-${band.started_on}-${index}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <p className="text-sm font-semibold text-zinc-800">
                  {band.org_slug ? (
                    <Link href={`/o/${band.org_slug}`} className="hover:underline">
                      {band.org_name}
                    </Link>
                  ) : (
                    band.org_name
                  )}
                  {band.role && <span className="ml-1.5 font-normal text-zinc-500">· {band.role}</span>}
                </p>
                <p className="shrink-0 text-xs text-zinc-400">
                  {formatDate(band.started_on)} – {band.ended_on ? formatDate(band.ended_on) : "Present"}
                </p>
              </div>
              <div className="relative mt-1.5 h-2.5 w-full rounded-full bg-zinc-100">
                <div
                  className={
                    band.verified
                      ? "absolute h-full rounded-full bg-beedero-black"
                      : "absolute h-full rounded-full border-2 border-dashed border-zinc-400 bg-zinc-200/50"
                  }
                  style={{ left, width }}
                  title={band.verified ? "Verified via Beedero" : "Self-declared"}
                />
                {band.milestones.map((milestone) => (
                  <span
                    key={milestone.id}
                    className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-beedero-yellow ring-2 ring-white"
                    style={{ left: pct(toTime(milestone.occurred_at)) }}
                    title={milestone.title}
                  />
                ))}
              </div>
              {band.skills.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {band.skills.map((skill) => (
                    <span
                      key={skill.skill}
                      className="rounded-full bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-600 ring-1 ring-beedero-border/60"
                    >
                      {skill.skill}
                      {skill.status === "org_confirmed" && (
                        <span className="ml-1 text-[10px] font-bold text-emerald-600">✓</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-zinc-400">
        Solid bars are verified via Beedero organizations. Dashed bars are self-declared.
      </p>
    </section>
  );
}
