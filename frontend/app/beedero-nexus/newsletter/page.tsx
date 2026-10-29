import Link from "next/link";

import { ReasonAction } from "@/components/nexus/actions";
import { AddContacts } from "@/components/nexus/Contacts";
import { NewDraftButton } from "@/components/nexus/NewsletterEditor";
import { Badge, Empty, PageHeader, Panel, SearchForm, When } from "@/components/nexus/ui";
import { nexusFetch } from "@/lib/nexus-server";
import { query, type NewsletterSendRow, type Paged, type Segment } from "@/lib/nexus";

type NewsletterHome = {
  sends: NewsletterSendRow[];
  segments: Segment[];
  subscribers: { accounts: number; contacts: number; contacts_unsubscribed: number };
};

type Contact = { id: number; email: string; name: string; source: string; created_at: string; unsubscribed_at: string | null };

export default async function NewsletterPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const [home, contacts] = await Promise.all([
    nexusFetch<NewsletterHome>("/nexus/newsletter/"),
    nexusFetch<Paged<Contact> & { sources: { source: string; n: number }[] }>(`/nexus/newsletter/contacts/${query({ q })}`),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Newsletter"
        title="Emails to the network."
        description="The newsletter only goes to people who opted in (in their notification settings) and to contacts who asked for it. Service announcements go to every account — only for changes to the service itself."
        actions={<NewDraftButton />}
      />

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ["Subscribed accounts", home.subscribers.accounts],
          ["Contacts", home.subscribers.contacts],
          ["Contacts who left", home.subscribers.contacts_unsubscribed],
        ].map(([label, value]) => (
          <div key={label} className="border border-app-border bg-app-surface p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">{label}</p>
            <p className="mt-2 text-3xl font-black tabular-nums">{value}</p>
          </div>
        ))}
      </section>

      <Panel title="Emails">
        {home.sends.length === 0 ? (
          <Empty>Nothing yet. Start with “New email”.</Empty>
        ) : (
          <ul className="divide-y divide-app-border">
            {home.sends.map((send) => (
              <li key={send.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <Link href={`/beedero-nexus/newsletter/${send.id}`} className="min-w-0 hover:opacity-80">
                  <span className="block truncate font-bold text-white">{send.subject || "(no subject)"}</span>
                  <span className="block text-xs text-white/45">
                    {send.kind === "announcement" ? "Service announcement" : "Newsletter"} · {send.segment_label || "no audience yet"} ·{" "}
                    {send.author}
                  </span>
                </Link>
                <span className="flex items-center gap-2 text-xs text-white/50">
                  <Badge tone={send.status === "sent" ? "good" : send.status === "sending" ? "warn" : "neutral"}>{send.status}</Badge>
                  {send.status !== "draft" && send.progress && (
                    <span>
                      {send.progress.sent}/{send.progress.total} sent
                      {send.progress.failed ? ` · ${send.progress.failed} failed` : ""}
                      {send.progress.unsubscribed ? ` · ${send.progress.unsubscribed} left` : ""}
                    </span>
                  )}
                  <When at={send.finished_at ?? send.queued_at ?? send.created_at} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title={`Contacts (${contacts.total})`} aside={<SearchForm action="/beedero-nexus/newsletter" value={q} placeholder="Email or source" />}>
          {contacts.results.length === 0 ? (
            <Empty>No contacts.</Empty>
          ) : (
            <ul className="divide-y divide-app-border text-sm">
              {contacts.results.map((contact) => (
                <li key={contact.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-white">{contact.email}</span>
                    <span className="block text-[11px] text-white/40">
                      {contact.source || "no source recorded"} · <When at={contact.created_at} relative={false} />
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {contact.unsubscribed_at && <Badge tone="bad">Unsubscribed</Badge>}
                    <ReasonAction
                      label="Delete"
                      title={`Delete ${contact.email}`}
                      description="For erasure requests. To stop emails, they can unsubscribe — that keeps the record that they left."
                      path={`/nexus/newsletter/contacts/${contact.id}/`}
                      method="DELETE"
                      reasonRequired={false}
                      confirmLabel="Delete"
                      tone="danger"
                      done="Deleted."
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Add contacts">
          <AddContacts />
          <p className="mt-3 text-[11px] leading-4 text-white/40">
            Only people who asked for the newsletter. Someone who unsubscribed stays marked, so adding them again does nothing.
          </p>
        </Panel>
      </div>
    </div>
  );
}
