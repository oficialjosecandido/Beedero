import Link from "next/link";

import {
  Badge,
  Empty,
  FilterTabs,
  PageHeader,
  Pager,
  PersonCell,
  SearchForm,
  When,
  tableClass,
  tdClass,
  thClass,
} from "@/components/nexus/ui";
import { nexusFetch } from "@/lib/nexus-server";
import { query, type Paged, type UserRow } from "@/lib/nexus";

const FILTERS = [
  { key: "all", label: "Everyone" },
  { key: "new", label: "New (7d)" },
  { key: "active", label: "Active (7d)" },
  { key: "dormant", label: "Dormant (30d)" },
  { key: "discover", label: "In Discover" },
  { key: "founders", label: "Founders" },
  { key: "investors", label: "Investors" },
  { key: "suspended", label: "Suspended" },
  { key: "internal", label: "Internal" },
  { key: "staff", label: "Staff" },
];

const SORTS = [
  { key: "joined", label: "Newest" },
  { key: "seen", label: "Last seen" },
  { key: "name", label: "Name" },
];

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string; sort?: string; page?: string }>;
}) {
  const { q, filter = "all", sort = "joined", page } = await searchParams;
  const data = await nexusFetch<Paged<UserRow>>(`/nexus/users/${query({ q, filter, sort, page })}`);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Users"
        title="Everyone on Beedero."
        description="Search by name, email, @handle or id. Internal and staff accounts are listed here but never counted in the numbers."
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchForm action="/beedero-nexus/users" value={q} placeholder="ana@… · Ana Silva · @anasilva" hidden={{ filter, sort }} />
        <FilterTabs base="/beedero-nexus/users" current={sort} options={SORTS} keep={{ q, filter }} param="sort" />
      </div>
      <FilterTabs base="/beedero-nexus/users" current={filter} options={FILTERS} keep={{ q, sort }} />

      {data.results.length === 0 ? (
        <Empty>Nobody matches.</Empty>
      ) : (
        <div className="overflow-x-auto border border-app-border bg-app-surface">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Person</th>
                <th className={thClass}>Joined</th>
                <th className={thClass}>Last seen</th>
                <th className={thClass}>Orgs</th>
                <th className={thClass}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((user) => (
                <tr key={user.id} className="hover:bg-white/[0.03]">
                  <td className={tdClass}>
                    <PersonCell person={user} href={`/beedero-nexus/users/${user.id}`} />
                  </td>
                  <td className={tdClass}>
                    <When at={user.joined_at} relative={false} />
                    {user.signup_source && <span className="block text-[11px] text-white/35">via {user.signup_source}</span>}
                  </td>
                  <td className={tdClass}>
                    <When at={user.last_seen_at} />
                  </td>
                  <td className={`${tdClass} tabular-nums`}>{user.orgs || "—"}</td>
                  <td className={tdClass}>
                    <span className="flex flex-wrap gap-1">
                      {!user.is_active && <Badge tone="bad">Suspended</Badge>}
                      {user.is_staff && <Badge tone="accent">Staff</Badge>}
                      {user.is_internal && <Badge>Internal</Badge>}
                      {user.in_discover ? <Badge tone="good">In Discover</Badge> : <Badge>Below 50%</Badge>}
                      {user.beedero_verified && <Badge tone="good">Verified</Badge>}
                      {!user.email_verified && <Badge tone="warn">Email not confirmed</Badge>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager base="/beedero-nexus/users" page={data.page} pages={data.pages} total={data.total} params={{ q, filter, sort }} />
      <p className="text-[11px] text-white/35">
        Need someone&apos;s organisations? Open the person, or search <Link href="/beedero-nexus/orgs" className="underline">organisations</Link>.
      </p>
    </div>
  );
}
