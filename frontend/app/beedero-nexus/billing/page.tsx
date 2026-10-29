import Link from "next/link";

import { QuickAction } from "@/components/nexus/actions";
import { IssueFatura, NewPromoCode } from "@/components/nexus/BillingForms";
import { Badge, Empty, PageHeader, Panel, PlanBadge, When, tableClass, tdClass, thClass } from "@/components/nexus/ui";
import { nexusFetch } from "@/lib/nexus-server";
import { euros, type Billing, type BillingOrg } from "@/lib/nexus";

function OrgList({ rows, empty }: { rows: BillingOrg[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-white/40">{empty}</p>;
  return (
    <ul className="divide-y divide-app-border text-sm">
      {rows.map((row) => (
        <li key={row.slug} className="flex items-center justify-between gap-2 py-2">
          <Link href={`/beedero-nexus/orgs/${row.slug}`} className="truncate font-bold text-white hover:underline">
            {row.name}
          </Link>
          <span className="flex shrink-0 items-center gap-2 text-xs text-white/50">
            <PlanBadge state={row.state} />
            {row.until && <When at={row.until} relative={false} />}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default async function BillingPage() {
  const data = await nexusFetch<Billing>("/nexus/billing/");
  const s = data.summary;
  const cards: [string, string, string?][] = [
    ["MRR", euros(s.mrr_cents), `${euros(s.mrr_net_cents)} without VAT`],
    ["ARR", euros(s.arr_cents), "MRR × 12"],
    ["Paying", String(s.paying_orgs), `${s.paying_yearly} yearly · ${s.paying_monthly} monthly`],
    ["Free year", String(s.free_periods_active), `${s.free_periods_ending_30d} end in 30 days · ${s.card_on_file_in_free_year} with a card`],
    ["Free year → paid", s.conversion_pct === null ? "—" : `${s.conversion_pct}%`, `${s.free_periods_converted_12m} of ${s.free_periods_ended_12m} that ended (12 months)`],
    ["Without a plan", String(s.orgs_without_plan), `${s.past_due} with a failing payment`],
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Billing"
        title="Plans, revenue and faturas."
        description="MRR counts what is paid now (active and retrying). A card added during a free year isn't revenue until the year ends. Prices include VAT."
      />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value, note]) => (
          <div key={label} className="border border-app-border bg-app-surface p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">{label}</p>
            <p className="mt-2 text-3xl font-black tabular-nums">{value}</p>
            {note && <p className="mt-1 text-[11px] text-white/40">{note}</p>}
          </div>
        ))}
      </section>

      <Panel title={`Faturas to issue (${data.invoices_to_issue.length})`}>
        {data.invoices_to_issue.length === 0 ? (
          <Empty>Every payment has its fatura.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Paid</th>
                  <th className={thClass}>Organisation</th>
                  <th className={thClass}>Customer · VAT number</th>
                  <th className={thClass}>Amount</th>
                  <th className={thClass}>Fatura</th>
                </tr>
              </thead>
              <tbody>
                {data.invoices_to_issue.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className={tdClass}>
                      <When at={invoice.paid_at} relative={false} />
                      {invoice.receipt_url && (
                        <a href={invoice.receipt_url} target="_blank" rel="noreferrer" className="block text-[11px] underline">
                          Stripe {invoice.number || "receipt"} ↗
                        </a>
                      )}
                    </td>
                    <td className={tdClass}>{invoice.org ? invoice.org.name : "—"}</td>
                    <td className={tdClass}>
                      {invoice.customer_name || "—"}
                      <span className="block text-[11px] text-white/45">{invoice.customer_tax_ids || "no VAT number"}</span>
                    </td>
                    <td className={`${tdClass} tabular-nums`}>{euros(invoice.amount_cents)}</td>
                    <td className={tdClass}>
                      <IssueFatura id={invoice.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid items-start gap-5 xl:grid-cols-3">
        <Panel title={`Free year ends in 30 days (${data.free_ending.length})`}>
          <OrgList rows={data.free_ending} empty="None." />
        </Panel>
        <Panel title={`Payment failing (${data.past_due.length})`}>
          <OrgList rows={data.past_due} empty="None." />
        </Panel>
        <Panel title={`Checkout never finished (${data.without_plan.length})`}>
          <OrgList rows={data.without_plan} empty="None." />
        </Panel>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Panel title="Promo codes">
          <ul className="divide-y divide-app-border">
            {data.promo_codes.map((code) => (
              <li key={code.code} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span>
                  <span className="font-mono font-bold text-white">{code.code}</span>
                  <span className="block text-[11px] text-white/45">
                    {code.free_days} days free · used {code.redemptions ?? 0}
                    {code.max_redemptions ? ` of ${code.max_redemptions}` : ""}
                    {code.expires_at && (
                      <>
                        {" · until "}
                        <When at={code.expires_at} relative={false} />
                      </>
                    )}
                    {code.note && ` · ${code.note}`}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone={code.active ? "good" : "neutral"}>{code.active ? "Active" : "Off"}</Badge>
                  <QuickAction
                    label={code.active ? "Switch off" : "Switch on"}
                    path={`/nexus/billing/promo-codes/${code.code}/`}
                    method="PATCH"
                    body={{ active: !code.active }}
                    done="Saved."
                  />
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="New code">
          <NewPromoCode />
        </Panel>
      </div>

      {data.invoices_issued.length > 0 && (
        <Panel title="Recently issued">
          <ul className="space-y-1 text-xs text-white/60">
            {data.invoices_issued.map((invoice) => (
              <li key={invoice.id}>
                {invoice.fatura_reference} · {invoice.org?.name ?? "—"} · {euros(invoice.amount_cents)} · issued{" "}
                <When at={invoice.fatura_issued_at} relative={false} />
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
