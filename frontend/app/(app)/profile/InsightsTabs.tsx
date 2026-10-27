"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Eye, GlassWater, Lightbulb, ThumbsUp, type LucideIcon } from "lucide-react";

import { PersonPresenceSignalsPanel } from "@/components/PersonalProfilePanels";
import { PersonalKpiPanel, type PersonalKpiStats } from "@/components/PersonalKpiPanel";
import { EmptyPanel, btnPrimary } from "@/components/app-shell/ui";
import { formatDate, formatDateTime } from "@/lib/format";
import { RichText } from "@/components/RichText";
import type { ResolvedMention } from "@/lib/richtext";
import { SECTION_LABELS } from "@/lib/types";

const TABS = [
  { id: "kpis", label: "KPIs", shortLabel: "KPIs" },
  { id: "posts", label: "My posts", shortLabel: "Posts" },
] as const;

export type InsightsTabId = (typeof TABS)[number]["id"];

type ProfileStats = PersonalKpiStats;

type InvestorPost = {
  id: number;
  kind: string;
  title: string;
  body?: string;
  image?: string | null;
  occurred_at: string;
  ends_at?: string | null;
  created_at: string;
  reaction_count?: number;
  reaction_counts?: { like: number; insight: number; congrats: number };
  feed_impression_count?: number;
  mentions?: ResolvedMention[];
};

const REACTION_KINDS: {
  kind: keyof NonNullable<InvestorPost["reaction_counts"]>;
  icon: LucideIcon;
  label: string;
}[] = [
  { kind: "like", icon: ThumbsUp, label: "Like" },
  { kind: "insight", icon: Lightbulb, label: "Insight" },
  { kind: "congrats", icon: GlassWater, label: "Congrats" },
];

type Vitality = {
  presence: { profile_views: number; since_days: number; has_signal: boolean };
  badge: {
    handle: string | null;
    name: string;
    verified: boolean;
    visual_status: "verified" | "unverified";
    as_of: string;
  };
};

function PostEngagementMetrics({ post }: { post: InvestorPost }) {
  const feedViews = post.feed_impression_count ?? 0;
  const reactionCounts = {
    like: post.reaction_counts?.like ?? 0,
    insight: post.reaction_counts?.insight ?? 0,
    congrats: post.reaction_counts?.congrats ?? 0,
  };
  const feedViewsLabel =
    feedViews === 1 ? "1 person saw this in their feed" : `${feedViews} people saw this in their feed`;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/10 pt-3">
      <span className="inline-flex items-center gap-1.5 text-[11px] text-white/45">
        <Eye size={13} aria-hidden />
        {feedViewsLabel}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {REACTION_KINDS.map(({ kind, icon: Icon, label }) => (
          <span
            key={kind}
            title={label}
            className="inline-flex items-center gap-1.5 border border-white/10 px-2 py-0.5 text-[11px] font-bold text-white/55"
          >
            <Icon size={12} aria-hidden />
            <span className="tabular-nums">{reactionCounts[kind]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function MyPostCard({ post }: { post: InvestorPost }) {
  return (
    <article className="border border-white/10 bg-white/[0.025] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="border border-white/15 px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-white/55">
          {SECTION_LABELS[post.kind] ?? post.kind}
        </span>
        <p className="text-[11px] text-white/35">Published {formatDate(post.created_at)}</p>
      </div>
      {post.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img loading="lazy" src={post.image} alt="" className="mt-4 max-h-72 w-full object-cover" />
      )}
      <h3 className="mt-3 text-lg font-bold tracking-[-0.02em]">{post.title || "Update"}</h3>
      {post.body && (
        <p className="mt-2 border-l-2 border-beedero-yellow pl-3 text-sm leading-6 text-white/60">
          <RichText body={post.body} mentions={post.mentions} />
        </p>
      )}
      {post.kind === "events" && post.occurred_at && post.ends_at ? (
        <p className="mt-2 text-[11px] text-white/35">
          {formatDateTime(post.occurred_at)} – {formatDateTime(post.ends_at)}
        </p>
      ) : (
        post.occurred_at && (
          <p className="mt-2 text-[11px] text-white/35">{formatDate(post.occurred_at)}</p>
        )
      )}
      <PostEngagementMetrics post={post} />
    </article>
  );
}

/** /profile/insights — what happened to your profile and posts. Read-only:
 * editing lives on /profile. (Was PersonalDashboardTabs, minus "Saved",
 * which never had a feature behind it, and "Settings".) */
export function InsightsTabs({
  profileStats,
  vitality,
  myPosts: initialPosts,
  initialTab,
}: {
  profileStats: ProfileStats | null;
  vitality: Vitality | null;
  myPosts: InvestorPost[];
  initialTab?: InsightsTabId;
}) {
  const [active, setActive] = useState<InsightsTabId>(initialTab ?? "kpis");
  const [prevInitialPosts, setPrevInitialPosts] = useState(initialPosts);
  const [myPosts, setMyPosts] = useState(initialPosts);

  if (initialPosts !== prevInitialPosts) {
    setPrevInitialPosts(initialPosts);
    setMyPosts(initialPosts);
  }

  const refreshPosts = useCallback(async () => {
    try {
      const res = await fetch("/api/investors/me/posts", { cache: "no-store" });
      if (!res.ok) return;
      const posts = (await res.json()) as InvestorPost[];
      setMyPosts(posts);
    } catch {
      // Keep showing the last known data if refresh fails.
    }
  }, []);

  useEffect(() => {
    if (active !== "posts") return;
    const onFocus = () => void refreshPosts();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [active, refreshPosts]);

  function selectTab(tabId: InsightsTabId) {
    setActive(tabId);
    window.history.replaceState(null, "", `/profile/insights?tab=${tabId}`);
    if (tabId === "posts") {
      void refreshPosts();
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Profile sections">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => selectTab(tab.id)}
            className={`border px-3 py-1.5 text-[11px] font-bold transition ${
              active === tab.id
                ? "border-beedero-yellow bg-beedero-yellow text-beedero-black"
                : "border-white/15 text-white/55 hover:border-white/30 hover:text-white"
            }`}
          >
            <span className="sm:hidden">{tab.shortLabel}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {active === "kpis" && (
        <div className="flex flex-col gap-5">
          <PersonalKpiPanel initialStats={profileStats} />
          {vitality && <PersonPresenceSignalsPanel presence={vitality.presence} />}
          {!profileStats && !vitality?.presence.has_signal && (
            <EmptyPanel>KPI data will appear here as your profile gets activity.</EmptyPanel>
          )}
        </div>
      )}

      {active === "posts" && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-4 border border-white/10 bg-white/[0.025] p-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-beedero-yellow">
                What you published
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.02em]">Your posts.</h2>
              <p className="mt-2 max-w-md text-xs leading-5 text-white/45">
                Milestones, events and updates you&apos;ve shared on the feed.
              </p>
            </div>
            <Link href="/feed" className={btnPrimary}>
              Share on feed
            </Link>
          </div>
          {myPosts.length === 0 ? (
            <EmptyPanel>No posts yet. Head to the feed to share your first update.</EmptyPanel>
          ) : (
            myPosts.map((post) => <MyPostCard key={post.id} post={post} />)
          )}
        </div>
      )}

    </div>
  );
}
