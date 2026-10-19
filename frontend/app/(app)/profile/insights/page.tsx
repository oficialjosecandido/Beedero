import Link from "next/link";
import { redirect } from "next/navigation";

import { PageHeading } from "@/components/app-shell/ui";
import type { PersonalKpiStats } from "@/components/PersonalKpiPanel";
import { ApiError, apiFetch, safeFetch } from "@/lib/api";
import type { Vitality } from "@/lib/person-vitality";

import { InsightsTabs, type InsightsTabId } from "../InsightsTabs";

export const dynamic = "force-dynamic";

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const initialTab: InsightsTabId = tab === "posts" ? "posts" : "kpis";

  let stats: PersonalKpiStats | null;
  let vitality: Vitality | null;
  let posts: Parameters<typeof InsightsTabs>[0]["myPosts"];
  try {
    [stats, vitality, posts] = await Promise.all([
      safeFetch(apiFetch<PersonalKpiStats>("/investors/me/stats/?range=7d"), null),
      safeFetch(apiFetch<Vitality>("/investors/me/vitality/"), null),
      apiFetch<Parameters<typeof InsightsTabs>[0]["myPosts"]>("/investors/me/posts/"),
    ]);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading
        eyebrow="My profile"
        title="Insights."
        actions={
          <Link href="/profile" className="text-xs font-bold text-beedero-yellow hover:underline">
            ← Back to profile
          </Link>
        }
      />
      <InsightsTabs profileStats={stats} vitality={vitality} myPosts={posts} initialTab={initialTab} />
    </div>
  );
}
