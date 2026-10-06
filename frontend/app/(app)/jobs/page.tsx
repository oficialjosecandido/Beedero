import { redirect } from "next/navigation";

import { PageHeading } from "@/components/app-shell/ui";
import { JobFilters } from "@/components/jobs/JobFilters";
import { ApiError, apiFetch } from "@/lib/api";
import type { JobSummary } from "@/lib/types";

import { JobsList } from "./JobsList";

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  for (const key of ["type", "location", "skills"]) {
    if (params[key]) query.set(key, params[key]!);
  }
  if (params.verified === "true") query.set("verified", "true");

  let results: { items: JobSummary[]; next_offset: number | null; total: number };
  try {
    results = await apiFetch<{
      items: JobSummary[];
      next_offset: number | null;
      total: number;
    }>(`/jobs/?${query.toString()}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  const hasFilters = Boolean(
    params.q?.trim() || params.type || params.location || params.skills?.trim() || params.verified
  );

  return (
    <>
      {/* No bottom margin: the search bar below carries the design's mt-7. */}
      <PageHeading eyebrow="Verified startup roles" title="Opportunities." className="" />
      <JobFilters total={results.total} />
      <JobsList
        initialItems={results.items}
        initialNextOffset={results.next_offset}
        query={query.toString()}
        hasFilters={hasFilters}
      />
    </>
  );
}
