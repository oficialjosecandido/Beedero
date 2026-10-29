import Link from "next/link";
import { notFound } from "next/navigation";

import { ReasonAction } from "@/components/nexus/actions";
import { History, LadderList } from "@/components/nexus/detail";
import { Avatar, Badge, PageHeader, Panel, PlanBadge, Row, When, tdClass, thClass } from "@/components/nexus/ui";
import { ApiError, apiFetch } from "@/lib/api";
import { euros, type OrgDetail } from "@/lib/nexus";

export default async function OrgPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let org: OrgDetail;
  try {
    org = await apiFetch<OrgDetail>(`/nexus/orgs/${slug}/`);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) notFound();
    throw err;
  }
  const base = `/nexus/orgs/${org.slug}`;
  const isComp = org.billing.state === "comp";

  return (
    <div className="flex flex-col gap-5">
      <Link href="/beedero-nexus/orgs" className="text-xs font-bold text-white/45 hover:text-white">
        ← Organisations
      </Link>
      <PageHeader
        eyebrow={`/${org.slug}`}
        title={org.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {org.one_liner || "No one-liner"}
            <Badge tone={org.status === "live" ? "good" : "neutral"}>{org.status}</Badge>
            {org.listed ? <Badge tone="good">In Discover</Badge> : <Badge>Not in Discover</Badge>}
            {org.is_verified && <Badge tone="good">Verified by Beedero</Badge>}
            <PlanBadge state={org.billing.state} />
          </span>
        }
        actions={
          <>
            {org.public_url && (
              <a href={org.public_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-white/60 underline">
                Public page ↗
              </a>
            )}
            {org.can_manage && (
              <>
                <ReasonAction
                  label={org.is_verified ? "Remove verification" : "Verify"}
                  title={org.is_verified ? "Remove Beedero's verification" : "Verify this organisation"}
                  description="The “Verified by Beedero” step of its ladder. Say what you checked."
                  path={`${base}/verify/`}
                  body={{ value: !org.is_verified }}
                  confirmLabel={org.is_verified ? "Remove" : "Verify"}
                  done="Saved."
                />
                {!org.billing.managed_by_stripe && !isComp && (
                  <ReasonAction
                    label="Extend free period"
                    title="Extend the free period"
                    description="Adds days to the free period running now, or starts one. A plan paid through Stripe is changed in Stripe."
                    path={`${base}/extend/`}
                    extraNumber={{ field: "days", label: "Days", min: 1, max: 365, initial: 30 }}
                    confirmLabel="Extend"
                    done="Extended."
                  />
                )}
                <ReasonAction
                  label={isComp ? "End complimentary plan" : "Make complimentary"}
                  title={isComp ? "End the complimentary plan" : "Give a complimentary plan"}
                  description={
                    isComp
                      ? "Without another plan, the organisation pauses: out of Discover, no posts or jobs."
                      : "Free with no end — partners, Beedero's own organisation."
                  }
                  path={`${base}/comp/`}
                  body={{ value: !isComp }}
                  confirmLabel={isComp ? "End it" : "Give it"}
                  tone={isComp ? "danger" : "default"}
                  done="Saved."
                />
              </>
            )}
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {[
          ["Followers", org.stats.followers],
          ["Profile views (30d)", org.stats.profile_views_30d],
          ["Posts", org.stats.posts],
          ["Posts removed", org.stats.posts_removed],
          ["Open jobs", org.stats.jobs_open],
        ].map(([label, value]) => (
          <div key={label} className="border border-app-border bg-app-surface p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">{label}</p>
            <p className="mt-2 text-2xl font-black tabular-nums">{value}</p>
          </div>
        ))}
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title={`Team (${org.members.length})`}>
            <ul className="divide-y divide-app-border">
              {org.members.map((member) => (
                <li key={member.id} className="flex items-center justify-between gap-3 py-2">
                  <Link href={`/beedero-nexus/users/${member.id}`} className="flex min-w-0 items-center gap-2.5 hover:opacity-80">
                    <Avatar person={member} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{member.name}</span>
                      <span className="block truncate text-xs text-white/45">{member.title || member.email}</span>
                    </span>
                  </Link>
                  <Badge>{member.role}</Badge>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Plan and payments">
            <dl>
              <Row label="Now">
                <PlanBadge state={org.billing.state} />
                {org.billing.until && (
                  <span className="ml-2 text-xs text-white/50">
                    until <When at={org.billing.until} relative={false} />
                  </span>
                )}
              </Row>
            </dl>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead>
                  <tr>
                    <th className={thClass}>Plan</th>
                    <th className={thClass}>Status</th>
                    <th className={thClass}>Source</th>
                    <th className={thClass}>Free until / renews</th>
                  </tr>
                </thead>
                <tbody>
                  {org.subscriptions.map((sub, index) => (
                    <tr key={index}>
                      <td className={tdClass}>{sub.plan.replace("org_", "")}</td>
                      <td className={tdClass}>
                        {sub.status}
                        {sub.cancel_at_period_end && " (ends)"}
                      </td>
                      <td className={tdClass}>
                        {sub.managed_by_stripe ? "Stripe" : sub.source}
                        {sub.promo_code && ` · ${sub.promo_code}`}
                      </td>
                      <td className={tdClass}>
                        <When at={sub.trial_end ?? sub.current_period_end} relative={false} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {org.subscriptions.length === 0 && <p className="py-3 text-sm text-white/40">Never had a plan.</p>}
            </div>
            {org.invoices.length > 0 && (
              <ul className="mt-4 space-y-1 text-xs text-white/60">
                {org.invoices.map((invoice, index) => (
                  <li key={index}>
                    {invoice.number || "Invoice"} · {euros(invoice.amount_cents)} · <When at={invoice.paid_at} relative={false} /> ·{" "}
                    {invoice.fatura_reference ? `fatura ${invoice.fatura_reference}` : <span className="text-beedero-yellow">fatura to issue</span>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Verifications">
            {org.verifications.length === 0 ? (
              <p className="text-sm text-white/40">None submitted.</p>
            ) : (
              <ul className="divide-y divide-app-border text-sm">
                {org.verifications.map((v, index) => (
                  <li key={index} className="flex flex-wrap justify-between gap-2 py-2">
                    <span>{v.type.replaceAll("_", " ")}</span>
                    <span className="flex items-center gap-2 text-xs text-white/50">
                      <Badge tone={v.status === "verified" ? "good" : v.status === "pending" ? "warn" : "bad"}>{v.status}</Badge>
                      sent <When at={v.submitted_at} />
                      {v.valid_until && (
                        <>
                          · valid until <When at={v.valid_until} relative={false} />
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11px] text-white/35">
              What was submitted (registry codes) is never shown here. Reviews happen in the Django admin.
            </p>
          </Panel>

          <Panel title="Staff history">
            <History rows={org.history} />
          </Panel>
        </div>

        <aside className="flex flex-col gap-5">
          <Panel title="Verification ladder">
            <LadderList ladder={org.ladder} />
          </Panel>
          <Panel title="Details">
            <dl>
              <Row label="Created">
                <When at={org.created_at} relative={false} />
              </Row>
              <Row label="In Discover since">
                <When at={org.discoverable_since} relative={false} />
              </Row>
              <Row label="Stage">{org.stage || "—"}</Row>
              <Row label="Sector">{org.sector || "—"}</Row>
              <Row label="Based in">{org.geo || "—"}</Row>
            </dl>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
