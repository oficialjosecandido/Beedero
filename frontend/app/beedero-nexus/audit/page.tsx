import Link from "next/link";

import { Empty, PageHeader, Pager, SearchForm, When, tableClass, tdClass, thClass } from "@/components/nexus/ui";
import { nexusFetch } from "@/lib/nexus-server";
import { query, type AuditRow, type Paged } from "@/lib/nexus";

type AuditPage = Paged<AuditRow> & { actions: { key: string; label: string }[] };

function targetHref(row: AuditRow): string | null {
  if (row.target_type === "user") return `/beedero-nexus/users/${row.target_id}`;
  if (row.target_type === "org") return `/beedero-nexus/orgs/${row.target_id}`;
  if (row.target_type === "newsletter") return `/beedero-nexus/newsletter/${row.target_id}`;
  return null;
}

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string; action?: string; page?: string }> }) {
  const { q, action, page } = await searchParams;
  const data = await nexusFetch<AuditPage>(`/nexus/audit/${query({ q, action, page })}`);
  const groups = ["user.", "org.", "post.", "report.", "newsletter.", "promo.", "invoice."];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Audit log"
        title="Every staff action, and why."
        description="Written by the Nexus itself. Nothing here can be edited or deleted from the app."
      />
      <div className="flex flex-wrap items-center gap-3">
        <SearchForm action="/beedero-nexus/audit" value={q} placeholder="Name, email, reason" hidden={{ action }} />
        <nav className="flex flex-wrap gap-1" aria-label="Kind">
          {[undefined, ...groups].map((group) => (
            <Link
              key={group ?? "all"}
              href={`/beedero-nexus/audit${query({ q, action: group })}`}
              className={`border px-2.5 py-1.5 text-xs font-bold ${
                action === group ? "border-beedero-yellow bg-beedero-yellow text-beedero-black" : "border-app-border text-white/60 hover:text-white"
              }`}
            >
              {group ? group.replace(".", "") : "all"}
            </Link>
          ))}
        </nav>
      </div>
      {data.results.length === 0 ? (
        <Empty>Nothing recorded yet.</Empty>
      ) : (
        <div className="overflow-x-auto border border-app-border bg-app-surface">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>When</th>
                <th className={thClass}>Who</th>
                <th className={thClass}>What</th>
                <th className={thClass}>On</th>
                <th className={thClass}>Why</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((row) => {
                const href = targetHref(row);
                return (
                  <tr key={row.id}>
                    <td className={`${tdClass} whitespace-nowrap text-xs`}>
                      <When at={row.created_at} />
                    </td>
                    <td className={`${tdClass} text-xs`}>{row.actor}</td>
                    <td className={tdClass}>{row.action_label}</td>
                    <td className={tdClass}>
                      {href ? (
                        <Link href={href} className="underline">
                          {row.target_label || row.target_id}
                        </Link>
                      ) : (
                        row.target_label || row.target_id || "—"
                      )}
                    </td>
                    <td className={`${tdClass} text-xs text-white/60`}>{row.reason || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pager base="/beedero-nexus/audit" page={data.page} pages={data.pages} total={data.total} params={{ q, action }} />
    </div>
  );
}
