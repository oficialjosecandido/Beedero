"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FaEye, FaGlassCheers, FaLightbulb, FaThumbsUp } from "react-icons/fa";
import type { IconType } from "react-icons";

import {
  PersonBadgeEmbedPanel,
  PersonPresenceSignalsPanel,
} from "@/components/PersonalProfilePanels";
import { PersonalKpiPanel, type PersonalKpiStats } from "@/components/PersonalKpiPanel";
import { ProfileForm } from "@/components/ProfileForm";
import { AdvisoryProfileForm, type AdvisorProfile } from "@/components/AdvisoryProfileForm";
import { DeleteAccountPanel } from "@/components/DeleteAccountPanel";
import { EmptyState } from "@/components/EmptyState";
import { ExperienceManager, type Experience } from "@/components/ExperienceManager";
import {
  MembershipSkillsManager,
  type PersonMembershipWithSkills,
} from "@/components/MembershipSkillsManager";
import { formatDate, formatDateTime } from "@/lib/format";
import { RichText } from "@/components/RichText";
import type { ResolvedMention } from "@/lib/richtext";
import { SECTION_LABELS } from "@/lib/types";

const TABS = [
  { id: "kpis", label: "KPIs" },
  { id: "posts", label: "My Posts" },
  { id: "saved", label: "Saved Posts" },
  { id: "settings", label: "Profile Settings" },
] as const;

export type PersonalTabId = (typeof TABS)[number]["id"];

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

const REACTION_KINDS: { kind: keyof NonNullable<InvestorPost["reaction_counts"]>; icon: IconType; label: string }[] =
  [
    { kind: "like", icon: FaThumbsUp, label: "Like" },
    { kind: "insight", icon: FaLightbulb, label: "Insight" },
    { kind: "congrats", icon: FaGlassCheers, label: "Congrats" },
  ];

type InvestorProfile = {
  full_name?: string;
  headline?: string;
  bio?: string;
  country?: string;
  profile_picture?: string | null;
  handle?: string | null;
  visibility?: Record<string, string>;
  attestation_prefs?: Record<string, boolean>;
};

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

type BadgeEmbed = {
  html: string;
  profile_url: string;
  badge_url: string;
  json_url: string;
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
    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-beedero-yellow pt-3">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500">
        <FaEye className="text-sm" aria-hidden />
        {feedViewsLabel}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {REACTION_KINDS.map(({ kind, icon: Icon, label }) => (
          <span
            key={kind}
            title={label}
            className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600"
          >
            <Icon className="text-sm" aria-hidden />
            <span className="tabular-nums">{reactionCounts[kind]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function MyPostCard({ post }: { post: InvestorPost }) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500">
          {SECTION_LABELS[post.kind] ?? post.kind}
        </span>
        <p className="text-xs text-subtle">Published {formatDate(post.created_at)}</p>
      </div>
      {post.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img loading="lazy" src={post.image} alt="" className="max-h-72 w-full rounded-xl object-cover" />
      )}
      <h3 className="text-lg font-extrabold text-zinc-900">{post.title || "Update"}</h3>
      {post.body && (
        <p className="text-sm leading-6 text-zinc-600">
          <RichText body={post.body} mentions={post.mentions} />
        </p>
      )}
      {post.kind === "events" && post.occurred_at && post.ends_at ? (
        <p className="text-xs text-subtle">
          {formatDateTime(post.occurred_at)} – {formatDateTime(post.ends_at)}
        </p>
      ) : (
        post.occurred_at && <p className="text-xs text-subtle">{formatDate(post.occurred_at)}</p>
      )}
      <PostEngagementMetrics post={post} />
    </article>
  );
}

export function PersonalDashboardTabs({
  profile,
  profileStats,
  vitality,
  badgeEmbed,
  advisorProfile,
  experiences,
  memberships,
  myPosts: initialPosts,
  initialTab,
}: {
  profile: InvestorProfile | null;
  profileStats: ProfileStats | null;
  vitality: Vitality | null;
  badgeEmbed: BadgeEmbed | null;
  advisorProfile: AdvisorProfile | null;
  experiences: Experience[];
  memberships: PersonMembershipWithSkills[];
  myPosts: InvestorPost[];
  initialTab?: PersonalTabId;
}) {
  const [active, setActive] = useState<PersonalTabId>(initialTab ?? "kpis");
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

  function selectTab(tabId: PersonalTabId) {
    setActive(tabId);
    window.history.replaceState(null, "", `/dashboard?tab=${tabId}`);
    if (tabId === "posts") {
      void refreshPosts();
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 overflow-x-auto rounded-2xl border-2 border-beedero-border bg-beedero-white p-1.5 shadow-sm">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => selectTab(tab.id)}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              active === tab.id
                ? "bg-beedero-black text-beedero-yellow"
                : "text-beedero-black/65 hover:bg-beedero-yellow hover:text-beedero-black"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === "kpis" && (
        <div className="flex flex-col gap-5">
          <PersonalKpiPanel initialStats={profileStats} />
          {vitality && <PersonPresenceSignalsPanel presence={vitality.presence} />}
          {!profileStats && !vitality?.presence.has_signal && (
            <p className="rounded-2xl border-2 border-beedero-border bg-beedero-white p-4 text-sm text-zinc-500">
              KPI data will appear here as your profile gets activity.
            </p>
          )}
        </div>
      )}

      {active === "posts" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-beedero-border bg-beedero-white px-5 py-4 shadow-sm">
            <div>
              <h2 className="font-extrabold text-zinc-900">Your posts</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Milestones, events, and updates you&apos;ve shared on the feed.
              </p>
            </div>
            <Link
              href="/feed"
              className="rounded-xl bg-beedero-yellow px-4 py-2 text-sm font-semibold text-beedero-black transition hover:bg-beedero-black hover:text-beedero-yellow"
            >
              Share on feed
            </Link>
          </div>
          {myPosts.length === 0 ? (
            <p className="rounded-2xl border-2 border-beedero-border bg-beedero-white p-4 text-sm text-zinc-500">
              No posts yet. Head to the feed to share your first update.
            </p>
          ) : (
            myPosts.map((post) => <MyPostCard key={post.id} post={post} />)
          )}
        </div>
      )}

      {active === "saved" && (
        <div className="rounded-2xl border-2 border-beedero-border bg-beedero-white p-6 shadow-sm">
          <h2 className="font-extrabold text-zinc-900">Saved posts</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Posts you bookmark from the feed will show up here.
          </p>
          <div className="mt-4">
            <EmptyState
              title="You haven't saved any posts yet"
              description="Bookmark a post from the feed to keep it handy here."
              action={{ href: "/feed", label: "Browse the feed" }}
            />
          </div>
        </div>
      )}

      {active === "settings" && (
        <div className="flex flex-col gap-5">
          {badgeEmbed && vitality && (
            <PersonBadgeEmbedPanel embed={badgeEmbed} badge={vitality.badge} />
          )}
          <ProfileForm profile={profile} />
          <ExperienceManager experiences={experiences} />
          <MembershipSkillsManager memberships={memberships} />
          <AdvisoryProfileForm profile={advisorProfile} />
          <DeleteAccountPanel />
        </div>
      )}
    </div>
  );
}
