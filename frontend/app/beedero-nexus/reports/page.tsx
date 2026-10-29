import { ReasonAction } from "@/components/nexus/actions";
import { Badge, Empty, FilterTabs, PageHeader, Pager, PersonCell, When } from "@/components/nexus/ui";
import { nexusFetch } from "@/lib/nexus-server";
import { query, type Paged, type ReportRow } from "@/lib/nexus";

type ReportsPage = Paged<ReportRow> & { can_suspend: boolean };

const STATES = [
  { key: "open", label: "To review" },
  { key: "resolved", label: "Resolved" },
];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; page?: string }>;
}) {
  const { state = "open", page } = await searchParams;
  const data = await nexusFetch<ReportsPage>(`/nexus/reports/${query({ state, page })}`);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Reports"
        title={state === "open" ? "Reports to review, oldest first." : "Resolved reports."}
        description="People report unwanted contact from messages and co-founder cards. Conversations stay private — what the reporter wrote is what you have."
      />
      <FilterTabs base="/beedero-nexus/reports" current={state} options={STATES} param="state" />

      {data.results.length === 0 ? (
        <Empty>{state === "open" ? "Nothing to review." : "Nothing resolved yet."}</Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.results.map((report) => (
            <li key={report.id} className="border border-app-border bg-app-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="warn">{report.reason_label}</Badge>
                  <span className="text-xs text-white/45">
                    #{report.id} · <When at={report.created_at} />
                    {report.from_conversation ? " · from a conversation" : " · from a profile card"}
                  </span>
                </div>
                {report.resolved_at && (
                  <span className="text-xs text-white/50">
                    {report.resolution_label} by {report.resolved_by} · <When at={report.resolved_at} />
                  </span>
                )}
              </div>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white/40">Reported</p>
                  <PersonCell person={report.reported} href={`/beedero-nexus/users/${report.reported.id}`} />
                  <p className="mt-1.5 flex gap-1.5">
                    {!report.reported.is_active && <Badge tone="bad">Suspended</Badge>}
                    {report.reported.reports_total > 1 && <Badge tone="bad">{report.reported.reports_total} reports in total</Badge>}
                  </p>
                </div>
                <div>
                  <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white/40">Reported by</p>
                  <PersonCell person={report.reporter} href={`/beedero-nexus/users/${report.reporter.id}`} />
                </div>
              </div>
              <blockquote className="mt-3 border-l-2 border-beedero-yellow pl-3 text-sm leading-6 text-white/75">
                {report.details || <span className="text-white/40">No details given.</span>}
              </blockquote>
              {report.resolution_note && <p className="mt-2 text-xs text-white/50">Note: {report.resolution_note}</p>}
              {!report.resolved_at && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <ReasonAction
                    label="No action needed"
                    title="Close with no action"
                    path={`/nexus/reports/${report.id}/resolve/`}
                    body={{ resolution: "no_action" }}
                    reasonField="note"
                    reasonRequired={false}
                    confirmLabel="Close report"
                    done="Closed."
                  />
                  <ReasonAction
                    label="Warn them"
                    title={`Warn ${report.reported.name}`}
                    description="They get a notification asking them to keep contact respectful. Your note stays internal."
                    path={`/nexus/reports/${report.id}/resolve/`}
                    body={{ resolution: "warned" }}
                    reasonField="note"
                    reasonRequired={false}
                    confirmLabel="Warn and close"
                    tone="primary"
                    done="Warned."
                  />
                  {data.can_suspend && report.reported.is_active && (
                    <ReasonAction
                      label="Suspend account"
                      title={`Suspend ${report.reported.name}`}
                      description="Signed out everywhere, out of Discover, page gone. We email them. Reversible from their page."
                      path={`/nexus/reports/${report.id}/resolve/`}
                      body={{ resolution: "suspended" }}
                      reasonField="note"
                      confirmLabel="Suspend"
                      tone="danger"
                      done="Suspended."
                    />
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <Pager base="/beedero-nexus/reports" page={data.page} pages={data.pages} total={data.total} params={{ state }} />
    </div>
  );
}
