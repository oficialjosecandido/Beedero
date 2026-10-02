"use client";

import Link from "next/link";
import { FaPlus } from "react-icons/fa";

import { followOrgAction } from "@/app/(app)/dashboard/actions";
import { MessagingColumn } from "@/components/messaging/MessagingColumn";
import { useMessaging } from "@/lib/messaging-context";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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
};

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
        <h2 className="text-base font-black tracking-[-0.03em]">Worth a look</h2>
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
              <FaPlus className="size-3" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function UpcomingEvents({ events }: { events: CalendarEvent[] }) {
  if (events.length === 0) return null;

  return (
    <section className="border border-white/10">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <h2 className="text-base font-black tracking-[-0.03em]">Upcoming events</h2>
      </div>
      <div className="divide-y divide-white/[0.06]">
        {events.slice(0, 3).map((ev) => {
          const d = new Date(ev.occurred_at);
          const day = d.toLocaleDateString("en-GB", { weekday: "short" });
          const dateNum = d.getDate();
          const month = d.toLocaleDateString("en-GB", { month: "short" });
          return (
            <div key={ev.id} className="flex items-start gap-3 px-4 py-3">
              <div className="w-9 shrink-0 text-center">
                <p className="text-[10px] font-black uppercase text-white/35">{day}</p>
                <p className="text-lg font-black leading-none text-white">{dateNum}</p>
                <p className="text-[9px] text-white/30">{month}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold leading-snug">{ev.title}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function FeedRightColumn({
  organizations,
  events,
}: {
  organizations: SuggestedOrg[];
  events: CalendarEvent[];
}) {
  const { isDesktop } = useMessaging();
  if (!isDesktop) return null;

  return (
    <aside className="hidden min-w-0 lg:block">
      <div className="sticky top-[94px] space-y-4">
        <div className="overflow-hidden border border-white/10 bg-app-surface [&_*]:border-white/10">
          <MessagingColumn embedded />
        </div>
        <SuggestedConnections organizations={organizations} />
        <UpcomingEvents events={events} />
      </div>
    </aside>
  );
}
