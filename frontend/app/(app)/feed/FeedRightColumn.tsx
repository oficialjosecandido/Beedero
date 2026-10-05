"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { CalendarDays, MessageCircle } from "lucide-react";

import type { ConversationSummary } from "@/app/(app)/feed/types";
import { followOrgAction } from "@/app/(app)/dashboard/actions";
import { useRightSidebar } from "@/components/app-shell/RightSidebar";
import { formatRelativeTime } from "@/lib/format";
import { useMessaging } from "@/lib/messaging-context";
import { useVisiblePolling } from "@/lib/use-visible-polling";

type SuggestedOrg = {
  slug: string;
  name: string;
  one_liner?: string;
  logo?: string | null;
};

type CalendarEvent = {
  id: number | string;
  title: string;
  occurred_at: string;
  ends_at?: string | null;
  org?: string;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function compactTime(value: string | null | undefined) {
  if (!value) return "";
  return formatRelativeTime(value).replace(" ago", "");
}

function FeedMessagesSidebar() {
  const { unreadTotal } = useMessaging();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/messaging/conversations", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { items: ConversationSummary[] };
      setConversations(data.items.slice(0, 4));
    } catch {
      // ignore
    }
  }, []);

  useVisiblePolling({ onPoll: poll, intervalMs: 45_000 });

  return (
    <section className="border border-white/10 bg-[#15181f]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageCircle size={16} className="text-beedero-yellow" aria-hidden />
          <h2 className="text-base font-black tracking-[-0.03em]">Messages</h2>
          {unreadTotal > 0 && (
            <span className="ml-1 rounded-full bg-beedero-yellow px-1.5 py-0.5 text-[9px] font-black text-beedero-black">
              {unreadTotal > 9 ? "9+" : unreadTotal}
            </span>
          )}
        </div>
        <Link
          href="/messages"
          className="text-[10px] font-bold uppercase tracking-[0.12em] text-beedero-yellow"
        >
          See all
        </Link>
      </div>
      <div className="divide-y divide-white/[0.07]">
        {conversations.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-white/40">No messages yet.</p>
        ) : (
          conversations.map((c) => {
            const unread = c.unread_count > 0;
            return (
              <Link
                key={c.id}
                href={`/messages?chat=${c.id}`}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-white/[0.04]"
              >
                <span className="relative shrink-0">
                  {c.other_participant.profile_picture ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.other_participant.profile_picture}
                      alt=""
                      className="size-9 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      className={`grid size-9 place-items-center rounded-full text-[10px] font-black ${
                        unread ? "bg-beedero-yellow text-beedero-black" : "bg-[#5f6b80] text-white"
                      }`}
                    >
                      {initials(c.other_participant.name)}
                    </span>
                  )}
                  {unread && (
                    <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-[#15181f] bg-beedero-yellow" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <b className={`truncate text-xs ${unread ? "text-white" : "text-white/70"}`}>
                      {c.other_participant.name}
                    </b>
                    <small className="shrink-0 text-[10px] text-white/35">
                      {compactTime(c.last_message_at)}
                    </small>
                  </span>
                  <p
                    className={`mt-0.5 truncate text-[11px] ${
                      unread ? "font-semibold text-white/80" : "text-white/40"
                    }`}
                  >
                    {c.last_message
                      ? `${c.last_message.is_mine ? "You: " : ""}${c.last_message.body}`
                      : "No messages yet"}
                  </p>
                </span>
              </Link>
            );
          })
        )}
      </div>
    </section>
  );
}

function SuggestedConnections({ organizations }: { organizations: SuggestedOrg[] }) {
  const router = useRouter();
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (organizations.length === 0) return null;

  function follow(slug: string) {
    setPendingSlug(slug);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("slug", slug);
      await followOrgAction(formData);
      setPendingSlug(null);
      router.refresh();
    });
  }

  return (
    <section className="border border-white/10 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-black tracking-[-0.03em]">Suggested connections</h2>
        <Link href="/discovery" className="text-xs font-bold text-beedero-yellow">
          See all
        </Link>
      </div>
      <ul>
        {organizations.slice(0, 3).map((org) => (
          <li key={org.slug} className="flex items-center gap-3 py-2">
            {org.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logo} alt="" className="size-8 shrink-0 object-cover" />
            ) : (
              <span className="grid size-8 shrink-0 place-items-center bg-white/10 text-[10px] font-black">
                {org.name.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <b className="block truncate text-xs">{org.name}</b>
              <small className="block truncate text-[11px] text-white/45">
                {org.one_liner || "Organisation"}
              </small>
            </span>
            <button
              type="button"
              disabled={isPending && pendingSlug === org.slug}
              onClick={() => follow(org.slug)}
              className="shrink-0 text-sm font-black text-beedero-yellow transition hover:opacity-70 disabled:opacity-40"
              aria-label={`Follow ${org.name}`}
            >
              +
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function UpcomingEvents({ events }: { events: CalendarEvent[] }) {
  const [going, setGoing] = useState<Record<string, boolean>>({});

  return (
    <section className="border border-white/10">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <CalendarDays size={14} className="text-beedero-yellow" aria-hidden />
        <h2 className="text-base font-black tracking-[-0.03em]">Upcoming events</h2>
      </div>
      {events.length === 0 ? (
        <p className="px-4 py-5 text-xs text-white/40">No upcoming events yet.</p>
      ) : (
        <div className="divide-y divide-white/[0.06]">
          {events.slice(0, 3).map((ev) => {
            const d = new Date(ev.occurred_at);
            const day = d.toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase();
            const dateNum = d.getDate();
            const month = d.toLocaleDateString("en-GB", { month: "short" });
            const key = String(ev.id);
            const isGoing = going[key];
            return (
              <div key={ev.id} className="flex items-start gap-3 px-4 py-3">
                <div className="w-9 shrink-0 text-center">
                  <p className="text-[10px] font-black uppercase text-white/35">{day}</p>
                  <p className="text-lg font-black leading-none text-white">{dateNum}</p>
                  <p className="text-[9px] text-white/30">{month}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold leading-snug">{ev.title}</p>
                  {ev.org && <p className="mt-0.5 text-[10px] text-white/40">{ev.org}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => setGoing((g) => ({ ...g, [key]: !g[key] }))}
                  className={`shrink-0 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.08em] transition ${
                    isGoing
                      ? "bg-beedero-yellow text-beedero-black"
                      : "border border-white/20 text-white/50 hover:border-beedero-yellow/50 hover:text-beedero-yellow"
                  }`}
                >
                  {isGoing ? "Going ✓" : "RSVP"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function FeedRightPanels({
  organizations,
  events,
}: {
  organizations: SuggestedOrg[];
  events: CalendarEvent[];
}) {
  return (
    <>
      <FeedMessagesSidebar />
      <SuggestedConnections organizations={organizations} />
      <UpcomingEvents events={events} />
    </>
  );
}

/** Mounts the Figma right column into the AppShell 3-col grid. Renders nothing inline. */
export function FeedRightColumn({
  organizations,
  events,
}: {
  organizations: SuggestedOrg[];
  events: CalendarEvent[];
}) {
  const panels = useMemo(
    () => <FeedRightPanels organizations={organizations} events={events} />,
    [organizations, events]
  );
  useRightSidebar(panels);
  return null;
}
