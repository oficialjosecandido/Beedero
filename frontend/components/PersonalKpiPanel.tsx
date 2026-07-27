"use client";

import { useCallback, useEffect, useState } from "react";

export type PersonalKpiStats = {
  range_days: number;
  new_followers: number;
  profile_views_count: number;
  posts_count: number;
  reactions_received: number;
  post_impressions_count: number;
};

const RANGE_OPTIONS = [
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
] as const;

type RangeId = (typeof RANGE_OPTIONS)[number]["id"];

async function loadStats(range: RangeId): Promise<PersonalKpiStats | null> {
  try {
    const res = await fetch(`/api/investors/me/stats?range=${range}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as PersonalKpiStats;
  } catch {
    return null;
  }
}

export function PersonalKpiPanel({ initialStats }: { initialStats: PersonalKpiStats | null }) {
  const [range, setRange] = useState<RangeId>("7d");
  const [stats, setStats] = useState<PersonalKpiStats | null>(initialStats);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async (nextRange: RangeId) => {
    setLoading(true);
    const data = await loadStats(nextRange);
    if (data) setStats(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (range === "7d") return;
    void refresh(range);
  }, [range, refresh]);

  function selectRange(nextRange: RangeId) {
    setRange(nextRange);
    if (nextRange === "7d" && initialStats) {
      setStats(initialStats);
      return;
    }
    if (nextRange !== "7d") {
      void refresh(nextRange);
    }
  }

  const metrics = stats
    ? [
        { label: "New followers", value: stats.new_followers },
        { label: "Profile views", value: stats.profile_views_count },
        { label: "Posts published", value: stats.posts_count },
        { label: "Reactions received", value: stats.reactions_received },
      ]
    : [];

  return (
    <section className="rounded-3xl border-2 border-beedero-border bg-beedero-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-beedero-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-zinc-900">Your KPIs</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-600">
            Activity on your personal profile in the selected period.
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-2xl border border-beedero-border bg-beedero-white p-1">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => selectRange(option.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                range === option.id
                  ? "bg-beedero-black text-beedero-yellow"
                  : "text-beedero-black/70 hover:bg-beedero-yellow hover:text-beedero-black"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !stats && <p className="mt-5 text-sm text-zinc-500">Loading KPIs…</p>}

      {!loading && !stats && <p className="mt-5 text-sm text-zinc-500">Could not load KPIs.</p>}

      {stats && (
        <div className={`mt-5 grid gap-3 sm:grid-cols-2 ${loading ? "opacity-60" : ""}`}>
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-2xl border-2 border-beedero-yellow bg-beedero-yellow p-4"
            >
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-zinc-500">
                {metric.label}
              </p>
              <p className="mt-2 text-3xl font-extrabold tabular-nums tracking-tight text-zinc-900">
                {metric.value}
              </p>
              <p className="mt-1 text-xs font-medium text-zinc-500">
                In the last {stats.range_days} days
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
