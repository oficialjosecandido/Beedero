import Link from "next/link";
import { notFound } from "next/navigation";

import { QuickAction, ReasonAction } from "@/components/nexus/actions";
import { History, LadderList } from "@/components/nexus/detail";
import { Avatar, Badge, PageHeader, Panel, PlanBadge, Row, When } from "@/components/nexus/ui";
import { ApiError, apiFetch } from "@/lib/api";
import type { UserDetail } from "@/lib/nexus";

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let user: UserDetail;
  try {
    user = await apiFetch<UserDetail>(`/nexus/users/${id}/`);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) notFound();
    throw err;
  }
  const base = `/nexus/users/${user.id}`;

  return (
    <div className="flex flex-col gap-5">
      <Link href="/beedero-nexus/users" className="text-xs font-bold text-white/45 hover:text-white">
        ← Users
      </Link>
      <PageHeader
        eyebrow={`User #${user.id}`}
        title={user.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {user.email}
            {user.handle && <span className="text-white/40">@{user.handle}</span>}
            {!user.is_active && <Badge tone="bad">Suspended</Badge>}
            {user.is_staff && <Badge tone="accent">Staff</Badge>}
            {user.is_internal && <Badge>Internal</Badge>}
            {user.beedero_verified && <Badge tone="good">Verified by Beedero</Badge>}
          </span>
        }
        actions={
          <>
            {user.public_url && (
              <a href={user.public_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-white/60 underline">
                Public profile ↗
              </a>
            )}
            {user.can_manage && (
              <>
                <ReasonAction
                  label={user.beedero_verified ? "Remove verification" : "Verify"}
                  title={user.beedero_verified ? "Remove Beedero's verification" : "Verify this person"}
                  description="The “Verified by Beedero” step of their ladder. Say what you checked."
                  path={`${base}/verify/`}
                  body={{ value: !user.beedero_verified }}
                  confirmLabel={user.beedero_verified ? "Remove" : "Verify"}
                  done="Saved."
                />
                <QuickAction
                  label={user.is_internal ? "Count in numbers" : "Mark internal"}
                  path={`${base}/internal/`}
                  body={{ value: !user.is_internal }}
                  done={user.is_internal ? "Counted again." : "Left out of the numbers."}
                />
                {user.is_active ? (
                  <ReasonAction
                    label="Suspend"
                    title={`Suspend ${user.name}`}
                    description="They're signed out everywhere, leave Discover and their page goes. We email them. Reversible."
                    path={`${base}/suspend/`}
                    confirmLabel="Suspend"
                    tone="danger"
                    done="Suspended."
                  />
                ) : (
                  <ReasonAction
                    label="Reactivate"
                    title={`Reactivate ${user.name}`}
                    path={`${base}/reactivate/`}
                    confirmLabel="Reactivate"
                    tone="primary"
                    done="Reactivated."
                  />
                )}
                <ReasonAction
                  label="Delete"
                  title={`Delete ${user.name}`}
                  description="Permanent. The account, profile, messages, connections and everything else tied to them are removed. Organisations they own are left behind without their membership. This cannot be undone."
                  path={`${base}/delete/`}
                  confirmLabel="Delete forever"
                  tone="danger"
                  done="Deleted."
                  redirectTo="/beedero-nexus/users"
                />
              </>
            )}
          </>
        }
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title="Account">
            <div className="mb-3 flex items-center gap-3">
              <Avatar person={user} size={48} />
              <div>
                <p className="font-bold text-white">{user.headline || "No headline"}</p>
                <p className="text-xs text-white/45">{[user.city, user.country].filter(Boolean).join(", ") || "No location"}</p>
              </div>
            </div>
            <dl>
              <Row label="Joined">
                <When at={user.joined_at} relative={false} />
                {user.signup_source && ` · via ${user.signup_source}${user.signup_ref ? ` (${user.signup_ref})` : ""}`}
              </Row>
              <Row label="Last seen">
                <When at={user.last_seen_at} />
              </Row>
              <Row label="Active days (30d)">{user.active_days_30}</Row>
              <Row label="Email confirmed">
                <When at={user.email_verified_at} relative={false} />
              </Row>
              <Row label="In Discover since">
                <When at={user.discoverable_since} relative={false} />
              </Row>
              <Row label="Here for">{user.intents.join(", ") || "—"}</Row>
              <Row label="Personal posts">
                {user.counts.posts}
                {user.counts.posts_removed > 0 && ` · ${user.counts.posts_removed} removed`}
              </Row>
              <Row label="Job applications">{user.counts.applications}</Row>
              <Row label="Reports filed">{user.counts.reports_filed}</Row>
            </dl>
          </Panel>

          <Panel title={`Organisations (${user.orgs.length})`}>
            {user.orgs.length === 0 ? (
              <p className="text-sm text-white/40">None.</p>
            ) : (
              <ul className="divide-y divide-app-border">
                {user.orgs.map((org) => (
                  <li key={org.slug} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <Link href={`/beedero-nexus/orgs/${org.slug}`} className="font-bold text-white hover:underline">
                      {org.name}
                    </Link>
                    <span className="flex items-center gap-1.5">
                      <Badge>{org.role}</Badge>
                      <Badge>{org.status}</Badge>
                      <PlanBadge state={org.plan} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={`Reports against them (${user.reports_against.length})`}>
            {user.reports_against.length === 0 ? (
              <p className="text-sm text-white/40">None.</p>
            ) : (
              <ul className="divide-y divide-app-border text-sm">
                {user.reports_against.map((report) => (
                  <li key={report.id} className="flex justify-between gap-2 py-2">
                    <span className="text-white/80">
                      #{report.id} · {report.reason}
                    </span>
                    <span className="text-xs text-white/45">
                      {report.resolution || "Open"} · <When at={report.created_at} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Staff history">
            <History rows={user.history} />
          </Panel>
        </div>

        <aside className="flex flex-col gap-5">
          <Panel title="Verification ladder">
            {user.ladder ? <LadderList ladder={user.ladder} /> : <p className="text-sm text-white/40">No profile yet.</p>}
          </Panel>
          <Panel title="Roles at organisations">
            {user.affiliations.length === 0 ? (
              <p className="text-sm text-white/40">None.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {user.affiliations.map((a, index) => (
                  <li key={index} className="flex justify-between gap-2">
                    <span className="text-white/80">{[a.title, a.org].filter(Boolean).join(" · ")}</span>
                    <Badge tone={a.status === "verified" ? "good" : "neutral"}>{a.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
