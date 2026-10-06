"use client";

import { useCallback, useState } from "react";
import {
  BarChart3,
  Eye,
  FileText,
  Megaphone,
  ThumbsUp,
  UserCheck,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import { Shimmer } from "@/components/app-shell/ui";

export type PersonalKpiStats = {
  range_days: number;
  new_connections: number;
  profile_views_count: number;
  verified_investor_views_count: number;
  posts_count: number;
  reactions_received: number;
  post_impressions_count: number;
};

const RANGE_OPTIONS = [
  { id: "7d", label: "Last 7 days", shortLabel: "7d" },
  { id: "30d", label: "Last 30 days", shortLabel: "30d" },
  { id: "90d", label: "Last 90 days", shortLabel: "90d" },
] as const;

type RangeId = (typeof RANGE_OPTIONS)[number]["id"];

type MetricDef = {
  key: string;
  label: string;
  value: number;
  icon: LucideIcon;
  highlight: boolean;
  delta?: (value: number, rangeDays: number) => string;
  hint?: string;
};

function valueClass(value: number, highlight: boolean) {
  if (!highlight) return "text-white";
  return value > 0 ? "text-emerald-400" : "text-white/40";
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
      key: "connections",
      label: "New connections",
      value: stats.new_connections,
      icon: UserPlus,
      highlight: true,
      delta: (value) => `+${value} in the last ${days} days`,
    },
    {
      key: "views",
      label: "Profile views",
      value: stats.profile_views_count,
      icon: Eye,
      highlight: true,
      delta: (value) => `${value} views in the last ${days} days`,
      hint: "Distinct people who opened your profile.",
    },
    {
      key: "verified_investor_views",
      label: "Verified investors viewed you",
      value: stats.verified_investor_views_count,
      icon: UserCheck,
      highlight: true,
      delta: (value) => `${value} verified investors in the last ${days} days`,
      hint: "Distinct verified investors who opened your profile.",
    },
    {
      key: "impressions",
      label: "Post impressions",
      value: stats.post_impressions_count,
      icon: Megaphone,
      highlight: true,
      delta: (value) => `${value} feed impressions in the last ${days} days`,
      hint: "Times your posts appeared in someone else's feed.",
    },
    {
      key: "posts",
      label: "Posts published",
      value: stats.posts_count,
      icon: FileText,
      highlight: false,
    },
    {
      key: "reactions",
      label: "Reactions received",
      value: stats.reactions_received,
      icon: ThumbsUp,
      highlight: false,
    },
  ];
}

function KpiMetricCard({ metric, rangeDays }: { metric: MetricDef; rangeDays: number }) {
  const Icon = metric.icon;

  return (
    <article className="min-w-0 border border-white/10 p-4">
      <span
        aria-hidden
        className="grid size-8 place-items-center border border-beedero-yellow/35 bg-beedero-yellow/10 text-beedero-yellow"
      >
        <Icon size={14} />
      </span>
      <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.1em] text-white/45">
        {metric.label}
      </p>
      <p
        className={`mt-1 text-3xl font-black tabular-nums tracking-[-0.03em] ${valueClass(
          metric.value,
          metric.highlight
        )}`}
      >
        {metric.value}
      </p>
      <p className="mt-1 break-words text-[11px] text-white/35">
        {metric.delta
          ? metric.delta(metric.value, rangeDays)
          : `In the last ${rangeDays} days`}
      </p>
      {metric.hint && <p className="mt-1.5 text-[11px] leading-5 text-white/30">{metric.hint}</p>}
    </article>
  );
}

function KpiSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="border border-white/10 p-4">
          <Shimmer className="size-8" />
          <Shimmer className="mt-3 h-3 w-24" />
          <Shimmer className="mt-2 h-8 w-16" />
          <Shimmer className="mt-2 h-3 w-32" />
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
    ["connections", "views", "verified_investor_views", "impressions"].includes(metric.key)
  );
  const contentMetrics = metrics.filter((metric) => ["posts", "reactions"].includes(metric.key));

  return (
    <section className="min-w-0 border border-white/10 bg-white/[0.025] p-5 sm:p-7">
      <div className="flex min-w-0 flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-beedero-yellow">
            <BarChart3 size={13} aria-hidden /> Private metrics
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.045em]">Your KPIs.</h2>
          <p className="mt-2 max-w-md text-xs leading-5 text-white/45">
            Activity on your personal profile in the selected period.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => selectRange(option.id)}
              disabled={loading}
              className={`border px-3 py-1.5 text-[11px] font-bold transition disabled:opacity-60 ${
                range === option.id
                  ? "border-beedero-yellow bg-beedero-yellow text-beedero-black"
                  : "border-white/15 text-white/55 hover:border-white/30 hover:text-white"
              }`}
            >
              <span className="sm:hidden">{option.shortLabel}</span>
              <span className="hidden sm:inline">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {loading && !stats && (
        <div className="mt-5">
          <KpiSkeleton />
        </div>
      )}

      {!loading && !stats && (
        <p className="mt-5 border border-dashed border-white/15 p-8 text-center text-sm text-white/45">
          Could not load KPIs. Try again in a moment.
        </p>
      )}

      {stats && (
        <div className={`mt-5 flex min-w-0 flex-col gap-6 ${loading ? "opacity-60" : ""}`}>
          <div className="min-w-0">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.15em] text-white/35">
              Audience
            </p>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {audienceMetrics.map((metric) => (
                <KpiMetricCard key={metric.key} metric={metric} rangeDays={stats.range_days} />
              ))}
            </div>
          </div>

          <div className="min-w-0">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.15em] text-white/35">
              Content
            </p>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              {contentMetrics.map((metric) => (
                <KpiMetricCard key={metric.key} metric={metric} rangeDays={stats.range_days} />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
