import Link from "next/link";
import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PublicJobCard } from "@/components/jobs/PublicJobCard";
import { WelcomeNudge } from "@/components/onboarding/WelcomeNudge";
import { PublicJobFilters } from "@/components/jobs/PublicJobFilters";
import { publicFetch } from "@/lib/api";
import { engagementTypeLabel, locationTypeLabel } from "@/lib/job-options";
import { pageMetadata, SITE_URL } from "@/lib/site-metadata";
import type { PublicJobsPage } from "@/lib/types";

/**
 * The public board — doc §3.2. Outside the `(app)` group, server-rendered, and
 * readable with no account: "Hoje, uma vaga só é vista por quem já tem conta."
 *
 * The members' board lives at /opportunities and is a different page with a
 * different job: it searches, it counts, and it lets you apply in place. This
 * one exists to be found.
 */

const FILTER_KEYS = ["type", "location", "city", "area"] as const;

type SearchParams = Record<string, string | undefined>;

/** The filters as the API wants them, with the cursor deliberately left out. */
function filterQuery(params: SearchParams) {
  const query = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = params[key]?.trim();
    if (value) query.set(key, value);
  }
  return query;
}

function jobsPath(params: SearchParams, cursor?: string | null) {
  const query = filterQuery(params);
  if (cursor) query.set("cursor", cursor);
  const qs = query.toString();
  return qs ? `/jobs?${qs}` : "/jobs";
}

/** "Design roles in Lisbon", from whichever filters are set. */
function describeFilters(params: SearchParams): string {
  const parts: string[] = [];
  if (params.area?.trim()) parts.push(params.area.trim());
  if (params.type) parts.push(engagementTypeLabel(params.type).toLowerCase());
  if (params.location) parts.push(locationTypeLabel(params.location).toLowerCase());
  if (params.city?.trim()) parts.push(`in ${params.city.trim()}`);
  return parts.join(" ");
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const params = await searchParams;
  const described = describeFilters(params);

  return pageMetadata({
    title: described ? `Open roles — ${described}` : "Open startup roles",
    description: described
      ? `Open ${described} at verified startups on Beedero. Apply with a minimal profile — no CV upload required.`
      : "Browse open roles at verified startups on Beedero — engineering, design, growth and co-founder positions. Free to browse, quick to apply.",
    // Canonical to the filtered path, never to the cursor: page two of a keyset
    // walk is the same list a bit further down, and a cursor is not an address
    // anyone should be linked to.
    path: jobsPath(params),
    // Deep pages are crawl budget spent on duplicates. `follow` stays on, so
    // the crawler still walks through to every job page it hasn't seen.
    index: !params.cursor,
    follow: true,
    keywords: [
      "startup jobs",
      "startup careers Portugal",
      "remote startup jobs",
      "Beedero",
      ...(params.city?.trim() ? [params.city.trim()] : []),
      ...(params.area?.trim() ? [params.area.trim()] : []),
    ],
  });
}

function JobsListJsonLd({ page }: { page: PublicJobsPage }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Open roles at startups on Beedero",
    url: `${SITE_URL}/jobs`,
    numberOfItems: page.items.length,
    itemListElement: page.items.map((job, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${SITE_URL}/jobs/${job.id}`,
      name: `${job.title} · ${job.org.name}`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
    />
  );
}

export default async function PublicJobsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const query = filterQuery(params);
  if (params.cursor) query.set("cursor", params.cursor);

  const qs = query.toString();
  const page = await publicFetch<PublicJobsPage>(`/public/jobs/${qs ? `?${qs}` : ""}`);
  const described = describeFilters(params);

  return (
    <>
      <JobsListJsonLd page={page} />
      <main className="flex flex-1 flex-col items-center px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex w-full max-w-5xl flex-col gap-8">
          {/* The "procurar emprego" row of §6.4 lands here, and this page is
              outside the (app) group that mounts the nudge for the others. */}
          <WelcomeNudge tone="light" spacing="" />
          <div className="max-w-2xl">
            <Breadcrumbs items={[{ label: "Open roles" }]} />
            <p className="mb-2 mt-6 text-sm font-bold uppercase tracking-[0.2em] text-beedero-black">
              Open roles
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-950 sm:text-4xl">
              Work at a startup you can check
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Every role here is posted by a live organisation with a public profile, so you can see
              who is hiring before you apply. Browsing needs no account.
            </p>
          </div>

          <PublicJobFilters
            values={{
              type: params.type,
              location: params.location,
              city: params.city,
              area: params.area,
            }}
          />

          {page.items.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-beedero-border bg-beedero-white p-8 text-sm text-zinc-500">
              {described ? (
                <>
                  No open roles match {described}.{" "}
                  <Link href="/jobs" className="font-semibold text-beedero-black underline">
                    See everything open
                  </Link>
                  .
                </>
              ) : (
                "No open roles right now. Postings last seven days, so this page changes often — check back soon."
              )}
            </div>
          ) : (
            <div className="grid w-full gap-3">
              {page.items.map((job) => (
                <PublicJobCard key={job.id} job={job} />
              ))}
            </div>
          )}

          {page.next_cursor && (
            <nav aria-label="More open roles" className="flex justify-center">
              <Link
                href={jobsPath(params, page.next_cursor)}
                rel="next"
                className="rounded-full border-2 border-beedero-border px-6 py-2.5 text-sm font-semibold text-beedero-black transition hover:bg-beedero-yellow/20"
              >
                More roles
              </Link>
            </nav>
          )}

          <div className="rounded-2xl border border-beedero-border bg-zinc-50 px-5 py-4 text-sm text-zinc-600">
            Hiring instead?{" "}
            <Link href="/register" className="font-semibold text-beedero-black underline">
              Create your organisation
            </Link>{" "}
            and publish a role in a couple of minutes.
          </div>
        </div>
      </main>
    </>
  );
}
