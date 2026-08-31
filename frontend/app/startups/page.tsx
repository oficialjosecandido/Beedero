import Link from "next/link";
import type { Metadata } from "next";

import { StartupDirectory } from "@/components/StartupDirectory";
import { StartupDirectoryJsonLd } from "@/components/StartupDirectoryJsonLd";
import { publicFetch } from "@/lib/api";
import { pageMetadata } from "@/lib/site-metadata";
import type { OrgSummary } from "@/lib/types";

const PAGE_SIZE = 24;

type DiscoveryResponse = {
  items: OrgSummary[];
  total: number;
  offset: number;
  limit: number;
};

function startupsPath(params: Record<string, string | undefined>, page: number) {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  for (const key of ["stage", "sector", "geo", "fundraising"]) {
    if (params[key]) qs.set(key, params[key]!);
  }
  if (page > 1) qs.set("page", String(page));
  const query = qs.toString();
  return query ? `/startups?${query}` : "/startups";
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}): Promise<Metadata> {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const query = params.q?.trim();

  const title = query
    ? `Startups matching “${query}”`
    : page > 1
      ? `Startup directory — page ${page}`
      : "Startup directory";

  const description = query
    ? `Search results for “${query}” in the Beedero startup directory — verified company profiles for investors and researchers.`
    : "Browse verified startup profiles on Beedero — structured company records for founders, investors, and researchers.";

  return pageMetadata({
    title,
    description,
    path: startupsPath(params, page),
    keywords: [
      "startup directory",
      "startup profiles",
      "verified startups",
      "Beedero",
      ...(query ? [query] : []),
    ],
  });
}

export default async function StartupsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const filterQuery = new URLSearchParams();
  if (params.q) filterQuery.set("q", params.q);
  for (const key of ["stage", "sector", "geo", "fundraising"]) {
    if (params[key]) filterQuery.set(key, params[key]!);
  }

  const query = new URLSearchParams(filterQuery);
  query.set("limit", String(PAGE_SIZE));
  query.set("offset", String(offset));

  const data = await publicFetch<DiscoveryResponse>(`/public/discovery/?${query.toString()}`);
  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  return (
    <>
      <StartupDirectoryJsonLd items={data.items} />
      <main className="flex flex-1 flex-col items-center px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex w-full max-w-5xl flex-col gap-8">
          <div className="max-w-2xl">
            <p className="mb-2 text-sm font-bold uppercase tracking-[0.2em] text-beedero-black">
              Startup directory
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-950 sm:text-4xl">
              Explore startups on Beedero
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Structured, verifiable company profiles — free to browse. Create an account to follow
              updates and connect with founders.
            </p>
          </div>

          <StartupDirectory
            items={data.items}
            page={safePage}
            totalPages={totalPages}
            queryString={filterQuery.toString()}
          />

          <div className="rounded-2xl border border-beedero-border bg-zinc-50 px-5 py-4 text-sm text-zinc-600">
            Want filters, people search, and your personalised feed?{" "}
            <Link href="/register" className="font-semibold text-beedero-black underline">
              Join Beedero
            </Link>{" "}
            or{" "}
            <Link href="/login" className="font-semibold text-beedero-black underline">
              sign in
            </Link>
            .
          </div>
        </div>
      </main>
    </>
  );
}
