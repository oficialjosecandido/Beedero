/**
 * Time-in-practice for skills. The design shows every skill with the span of
 * the experience it was developed in ("Strategy · 4 yrs"), and an aggregate
 * chip row where the same skill across several records adds up.
 *
 * Mirrors the backend's `aggregate_anchored_skills` (accounts/timeline.py):
 * the calendar time the records carrying a skill cover, expressed as years.
 * Calendar time, not the sum of the rows — two roles held at once are two
 * records but one stretch of time, and adding them is how a profile ends up
 * claiming four years of a skill the person has had for two.
 */

const DAY_MS = 86_400_000;

export type SkillRecord = {
  skills?: string[] | null;
  started_on: string;
  ended_on?: string | null;
};

/** Whole days between the two dates; an open end counts up to today. */
export function recordDays(startedOn: string, endedOn?: string | null): number {
  const start = new Date(startedOn).getTime();
  if (Number.isNaN(start)) return 0;
  const end = endedOn ? new Date(endedOn).getTime() : Date.now();
  if (Number.isNaN(end)) return 0;
  return Math.max(Math.round((end - start) / DAY_MS), 0);
}

/**
 * The design's compact label: whole years once there is at least one, months
 * below that. A record shorter than a month still reads "1 mo" rather than
 * "0 mos", since zero would look like missing data.
 */
export function formatDuration(days: number): string {
  const years = Math.floor(days / 365);
  if (years >= 1) return `${years} ${years === 1 ? "yr" : "yrs"}`;
  const months = Math.max(Math.round(days / 30), 1);
  return `${months} ${months === 1 ? "mo" : "mos"}`;
}

export function recordDuration(startedOn: string, endedOn?: string | null): string {
  return formatDuration(recordDays(startedOn, endedOn));
}

/**
 * Same wording for a span the backend already reduced to years — the public
 * profile's aggregated skills arrive as `years: 4.1`, not as a day count.
 */
export function formatYears(years: number): string {
  return formatDuration(Math.round(years * 365));
}

export type AggregatedSkillTime = { skill: string; days: number; duration: string };

type Period = [start: number, end: number];

/** Days these periods cover between them, counting an overlap once. */
export function mergedDays(periods: Period[]): number {
  if (periods.length === 0) return 0;
  const sorted = [...periods].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [currentStart, currentEnd] = sorted[0];
  for (const [start, end] of sorted.slice(1)) {
    if (start <= currentEnd) {
      currentEnd = Math.max(currentEnd, end);
    } else {
      total += currentEnd - currentStart;
      [currentStart, currentEnd] = [start, end];
    }
  }
  total += currentEnd - currentStart;
  return Math.max(Math.round(total / DAY_MS), 0);
}

/**
 * One chip per distinct skill, longest-practised first. Case-insensitive on
 * the key but the first spelling seen is the one displayed, so "React" and
 * "react" collapse into a single chip instead of two.
 *
 * Concurrent records count once (see `mergedDays`), so the aggregate is never
 * larger than the span from the earliest record to today — which is what a
 * reader takes "4 yrs" to mean.
 */
export function aggregateSkillTime(records: SkillRecord[]): AggregatedSkillTime[] {
  const bySkill = new Map<string, { skill: string; periods: Period[] }>();

  for (const record of records) {
    // A record whose dates don't parse, or that ends before it starts, is
    // skipped rather than counted as zero: `formatDuration(0)` reads "1 mo",
    // and inventing a month for a broken row is worse than leaving it out.
    const start = new Date(record.started_on).getTime();
    if (Number.isNaN(start)) continue;
    const end = record.ended_on ? new Date(record.ended_on).getTime() : Date.now();
    if (Number.isNaN(end) || end < start) continue;

    for (const skill of record.skills ?? []) {
      const name = skill.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const entry = bySkill.get(key) ?? { skill: name, periods: [] };
      entry.periods.push([start, end]);
      bySkill.set(key, entry);
    }
  }

  return [...bySkill.values()]
    .map((entry) => ({ skill: entry.skill, days: mergedDays(entry.periods) }))
    .sort((a, b) => b.days - a.days || a.skill.localeCompare(b.skill))
    .map((entry) => ({ ...entry, duration: formatDuration(entry.days) }));
}
