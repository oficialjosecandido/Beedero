"use client";

import { useCallback, useState } from "react";
import { FaBullhorn, FaEye, FaFileAlt, FaThumbsUp, FaUserPlus } from "react-icons/fa";
import type { IconType } from "react-icons";

import { AppColumnSection } from "@/components/AppColumnSection";

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

type MetricDef = {
  key: string;
  label: string;
  value: number;
  icon: IconType;
  highlight: boolean;
  delta?: (value: number, rangeDays: number) => string;
  hint?: string;
};

function deltaTrendClass(value: number) {
  return value > 0 ? "text-emerald-600" : "text-red-600";
}

function valueClass(value: number, highlight: boolean) {
  if (!highlight) return "text-zinc-900";
  return value > 0 ? "text-emerald-600" : "text-red-600";
}

async function loadStats(range: RangeId): Promise<PersonalKpiStats | null> {
  try {
    const res = await fetch(`/api/investors/me/stats?range=${range}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as PersonalKpiStats;
  } catch {
    return null;
  }
}

function buildMetrics(stats: PersonalKpiStats): MetricDef[] {
  const days = stats.range_days;
  return [
    {
      key: "followers",
      label: "New followers",
      value: stats.new_followers,
      icon: FaUserPlus,
      highlight: true,
      delta: (value) => `+${value} in the last ${days} days`,
    },
    {
      key: "views",
      label: "Profile views",
      value: stats.profile_views_count,
      icon: FaEye,
      highlight: true,
      delta: (value) => `${value} views in the last ${days} days`,
      hint: "Distinct people who opened your profile.",
    },
    {
      key: "impressions",
      label: "Post impressions",
      value: stats.post_impressions_count,
      icon: FaBullhorn,
      highlight: true,
      delta: (value) => `${value} feed impressions in the last ${days} days`,
      hint: "Times your posts appeared in someone else's feed.",
    },
    {
      key: "posts",
      label: "Posts published",
      value: stats.posts_count,
      icon: FaFileAlt,
      highlight: false,
    },
    {
      key: "reactions",
      label: "Reactions received",
      value: stats.reactions_received,
      icon: FaThumbsUp,
      highlight: false,
    },
  ];
}

function KpiMetricCard({ metric, rangeDays }: { metric: MetricDef; rangeDays: number }) {
  const Icon = metric.icon;

  return (
    <article className="rounded-2xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-beedero-yellow/35 ring-1 ring-beedero-yellow/60">
          <Icon className="text-sm text-beedero-black" aria-hidden />
        </div>
      </div>
      <p className="mt-3 text-sm font-medium text-zinc-500">{metric.label}</p>
      <p
        className={`mt-1 text-3xl font-extrabold tabular-nums tracking-tight ${valueClass(metric.value, metric.highlight)}`}
      >
        {metric.value}
      </p>
      {metric.delta ? (
        <p className={`mt-1 text-xs font-semibold ${deltaTrendClass(metric.value)}`}>
          {metric.delta(metric.value, rangeDays)}
        </p>
      ) : (
        <p className="mt-1 text-xs font-medium text-zinc-400">In the last {rangeDays} days</p>
      )}
      {metric.hint && <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">{metric.hint}</p>}
    </article>
  );
}

function KpiSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-2xl border-2 border-beedero-border bg-beedero-white p-5"
        >
          <div className="size-10 rounded-xl bg-zinc-100" />
          <div className="mt-3 h-4 w-24 rounded bg-zinc-100" />
          <div className="mt-2 h-8 w-16 rounded bg-zinc-100" />
          <div className="mt-2 h-3 w-32 rounded bg-zinc-100" />
        </div>
      ))}
    </div>
  );
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

  const metrics = stats ? buildMetrics(stats) : [];
  const audienceMetrics = metrics.filter((metric) =>
    ["followers", "views", "impressions"].includes(metric.key)
  );
  const contentMetrics = metrics.filter((metric) => ["posts", "reactions"].includes(metric.key));

  return (
    <AppColumnSection label="Your KPIs" bodyClassName="p-5 sm:p-6">
      <div className="flex flex-col gap-4 border-b border-beedero-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-md text-sm leading-6 text-zinc-600">
          Activity on your personal profile in the selected period.
        </p>
        <div className="flex shrink-0 flex-wrap gap-1 rounded-2xl border border-beedero-border bg-zinc-50 p-1">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => selectRange(option.id)}
              disabled={loading}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
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

      {loading && !stats && <div className="mt-5"><KpiSkeleton /></div>}

      {!loading && !stats && (
        <p className="mt-5 rounded-xl border border-dashed border-beedero-border bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500">
          Could not load KPIs. Try again in a moment.
        </p>
      )}

      {stats && (
        <div className={`mt-5 flex flex-col gap-5 ${loading ? "opacity-60" : ""}`}>
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">
              Audience
            </p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {audienceMetrics.map((metric) => (
                <KpiMetricCard key={metric.key} metric={metric} rangeDays={stats.range_days} />
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">
              Content
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {contentMetrics.map((metric) => (
                <KpiMetricCard key={metric.key} metric={metric} rangeDays={stats.range_days} />
              ))}
            </div>
          </div>
        </div>
      )}
    </AppColumnSection>
  );
}
