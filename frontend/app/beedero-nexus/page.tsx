import Link from "next/link";

import { Bars, Cohorts, Funnel } from "@/components/nexus/charts";
import { Kpi, PageHeader, Panel, When } from "@/components/nexus/ui";
import { apiFetch, safeFetch } from "@/lib/api";
import { nexusFetch } from "@/lib/nexus-server";
import type { Home, NexusMe, Overview } from "@/lib/nexus";

function djangoAdmin(path: string) {
  const api = (process.env.BACKEND_URL ?? "http://localhost:8000/api").replace(/\/$/, "");
  return `${api.replace(/\/api$/, "")}/admin/${path}`;
}

function Queue({
  label,
  value,
  note,
  href,
  external = false,
  urgent = false,
}: {
  label: string;
  value: number;
  note?: string;
  href: string;
  external?: boolean;
  urgent?: boolean;
}) {
  const body = (
    <>
      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">{label}</span>
      <span className={`mt-2 block text-4xl font-black tabular-nums tracking-[-0.04em] ${urgent && value ? "text-beedero-yellow" : "text-white"}`}>
        {value}
      </span>
      {note && <span className="mt-1 block text-[11px] text-white/40">{note}</span>}
    </>
  );
  const className = "block border border-app-border bg-app-surface p-4 transition hover:border-white/40";
  return external ? (
    <a href={href} className={className} target="_blank" rel="noreferrer">
      {body}
    </a>
  ) : (
    <Link href={href} className={className}>
      {body}
    </Link>
  );
}

const PARTS: { key: keyof Overview["north_star"]["parts"]; label: string }[] = [
  { key: "roles", label: "Roles confirmed by both sides" },
  { key: "connections", label: "Connections accepted" },
  { key: "registries", label: "Company registries verified" },
  { key: "investments", label: "Investments confirmed by both sides" },
];

export default async function NexusHome() {
  const me = await nexusFetch<NexusMe>("/nexus/me/");
  const isAdmin = me.capabilities.includes("overview");
  const [home, overview] = await Promise.all([
    apiFetch<Home>("/nexus/home/"),
    isAdmin ? safeFetch(apiFetch<Overview>("/nexus/overview/"), null) : Promise.resolve(null),
  ]);
  const q = home.queues;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={isAdmin ? "Overview" : "Home"}
        title={`Hello, ${me.name.split(" ")[0]}.`}
        description={
          isAdmin
            ? "What needs doing, then the numbers. People and money exclude staff and test accounts."
            : "What needs doing today."
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Queue
          label="Reports to review"
          value={q.reports_open}
          note={q.oldest_report_days !== null ? `Oldest: ${q.oldest_report_days} days` : "Nothing waiting"}
          href="/beedero-nexus/reports"
          urgent
        />
        <Queue
          label="Verifications waiting"
          value={q.verifications_pending}
          note={
            q.oldest_verification_days !== null
              ? `Oldest: ${q.oldest_verification_days} days · reviewed in Django admin`
              : "Nothing waiting"
          }
          href={djangoAdmin("credibility/verification/?status__exact=pending")}
          external
          urgent
        />
        <Queue label="Public posts (24h)" value={q.posts_24h} note="Read and moderate" href="/beedero-nexus/posts" />
        <Queue label="New organisations (24h)" value={q.orgs_24h} href="/beedero-nexus/orgs?filter=draft" />
      </section>

      {isAdmin && !overview && (
        <Panel title="Numbers">
          <p className="text-sm text-white/50">The numbers couldn&apos;t be loaded. Refresh in a moment.</p>
        </Panel>
      )}

      {overview && (
        <>
          <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <div className="border border-beedero-yellow bg-beedero-yellow p-5 text-beedero-black">
              <p className="text-[10px] font-black uppercase tracking-[0.2em]">North star</p>
              <p className="mt-1 text-sm font-bold">{overview.north_star.label}</p>
              <p className="mt-3 text-6xl font-black tabular-nums tracking-[-0.05em]">{overview.north_star.value}</p>
              <p className="mt-1 text-xs font-bold">
                {overview.north_star.previous} the week before
                {overview.north_star.previous
                  ? ` · ${overview.north_star.value >= overview.north_star.previous ? "+" : ""}${Math.round(
                      ((overview.north_star.value - overview.north_star.previous) / overview.north_star.previous) * 100
                    )}%`
                  : ""}
              </p>
              <p className="mt-4 text-[11px] leading-4 text-beedero-black/70">
                Facts somebody else confirmed: what Beedero is for. It only grows when the network is used for real.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {PARTS.map((part) => (
                <div key={part.key} className="border border-app-border bg-app-surface p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">{part.label}</p>
                  <p className="mt-2 text-3xl font-black tabular-nums text-white">
                    {part.key === "connections" && !overview.north_star.connections_known ? "—" : overview.north_star.parts[part.key]}
                  </p>
                  <p className="mt-1 text-[11px] text-white/35">Last 7 days</p>
                </div>
              ))}
            </div>
          </section>

          {!overview.rollup.fresh && (
            <p className="border border-beedero-yellow/40 px-4 py-3 text-xs text-beedero-yellow">
              The nightly count of connections, messages, reactions and posts{" "}
              {overview.rollup.date ? `last ran for ${overview.rollup.date}` : "hasn't run yet"}. Run the
              “Nightly Nexus numbers” workflow (or <code>manage.py nexus_rollup --days 90</code> once, to fill the
              history).
            </p>
          )}

          {overview.sections.map((section) => (
            <section key={section.key}>
              <h2 className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-white/50">{section.title}</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {section.cards.map((card) => (
                  <Kpi key={card.key} card={card} />
                ))}
              </div>
            </section>
          ))}

          <section>
            <h2 className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-white/50">Last 30 days</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <Bars title="New people" points={overview.series.signups} />
              <Bars title="Active people" points={overview.series.active} />
              <Bars title="Connections" points={overview.series.connections} note="From the nightly count." />
              <Bars title="Posts" points={overview.series.posts} note="All posts, from the nightly count." />
              <Bars title="Site visitors" points={overview.series.visitors} />
            </div>
          </section>

          <section className="grid gap-3 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <Panel title="Activation — joined in the last 30 days">
              <Funnel steps={overview.funnel} />
            </Panel>
            <Panel title="Retention — share active in each week after joining">
              <Cohorts rows={overview.cohorts} />
            </Panel>
          </section>

          <p className="text-[11px] text-white/35">
            Computed <When at={overview.generated_at} />. Nightly count: {overview.rollup.date ?? "never"}
            {overview.rollup.requests_pending !== null && ` · ${overview.rollup.requests_pending} connection requests waiting`}
            {overview.rollup.connections_total !== null && ` · ${overview.rollup.connections_total} connections in total`}.
          </p>
        </>
      )}

      {home.recent_actions.length > 0 && (
        <Panel title="Your recent actions">
          <ul className="divide-y divide-app-border text-sm">
            {home.recent_actions.map((row) => (
              <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span className="text-white/80">
                  {row.action_label} · <b className="text-white">{row.target_label}</b>
                  {row.reason && <span className="text-white/45"> — {row.reason}</span>}
                </span>
                <span className="text-xs text-white/40">
                  <When at={row.created_at} />
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
