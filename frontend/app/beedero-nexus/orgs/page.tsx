import Link from "next/link";

import {
  Badge,
  Empty,
  FilterTabs,
  PageHeader,
  Pager,
  PlanBadge,
  SearchForm,
  When,
  tableClass,
  tdClass,
  thClass,
} from "@/components/nexus/ui";
import { nexusFetch } from "@/lib/nexus-server";
import { query, type OrgRow, type Paged } from "@/lib/nexus";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "draft", label: "Drafts" },
  { key: "listed", label: "In Discover" },
  { key: "hidden", label: "Live, hidden" },
  { key: "paying", label: "Paying" },
  { key: "free_year", label: "Free year" },
  { key: "past_due", label: "Payment failing" },
  { key: "no_plan", label: "No plan" },
  { key: "verified", label: "Verified" },
];

export default async function OrgsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; page?: string }>;
}) {
  const { q, filter = "all", page } = await searchParams;
  const data = await nexusFetch<Paged<OrgRow>>(`/nexus/orgs/${query({ q, filter, page })}`);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Organisations"
        title="Every organisation."
        description="“Live, hidden” are published but out of Discover: below the 50% gate, or without a plan."
      />
      <SearchForm action="/beedero-nexus/orgs" value={q} placeholder="Name, slug or one-liner" hidden={{ filter }} />
      <FilterTabs base="/beedero-nexus/orgs" current={filter} options={FILTERS} keep={{ q }} />

      {data.results.length === 0 ? (
        <Empty>No organisation matches.</Empty>
      ) : (
        <div className="overflow-x-auto border border-app-border bg-app-surface">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Organisation</th>
                <th className={thClass}>Owner</th>
                <th className={thClass}>Created</th>
                <th className={thClass}>Team</th>
                <th className={thClass}>Plan</th>
                <th className={thClass}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((org) => (
                <tr key={org.slug} className="hover:bg-white/[0.03]">
                  <td className={tdClass}>
                    <Link href={`/beedero-nexus/orgs/${org.slug}`} className="block min-w-0 hover:opacity-80">
                      <span className="block font-bold text-white">{org.name}</span>
                      <span className="block max-w-[340px] truncate text-xs text-white/45">{org.one_liner || org.slug}</span>
                    </Link>
                  </td>
                  <td className={tdClass}>
                    {org.owner ? (
                      <Link href={`/beedero-nexus/users/${org.owner.id}`} className="text-xs hover:underline">
                        {org.owner.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={tdClass}>
                    <When at={org.created_at} relative={false} />
                  </td>
                  <td className={`${tdClass} tabular-nums`}>
                    {org.members} · {org.followers} followers
                  </td>
                  <td className={tdClass}>
                    <PlanBadge state={org.plan} />
                  </td>
                  <td className={tdClass}>
                    <span className="flex flex-wrap gap-1">
                      <Badge tone={org.status === "live" ? "good" : "neutral"}>{org.status}</Badge>
                      {org.listed && <Badge tone="good">In Discover</Badge>}
                      {org.is_verified && <Badge tone="good">Verified</Badge>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager base="/beedero-nexus/orgs" page={data.page} pages={data.pages} total={data.total} params={{ q, filter }} />
    </div>
  );
}
