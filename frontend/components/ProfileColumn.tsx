"use client";

import Link from "next/link";
import { useState } from "react";

import { AppColumnSection } from "@/components/AppColumnSection";
import { CreateOrgButton } from "@/components/CreateOrgButton";
import { EventsCalendar } from "@/components/EventsCalendar";
import { InvitePeopleButton } from "@/components/InvitePeopleButton";
import { formatAtHandle } from "@/lib/handles";

type InvestorProfile = {
  full_name?: string;
  headline?: string;
  profile_picture?: string | null;
  handle?: string | null;
};
type Me = { email: string; investor_profile: InvestorProfile | null };
type Membership = { slug: string; name: string; role: string; logo?: string | null };
type CalendarEvent = { id: number | string; title: string; occurred_at: string; ends_at?: string | null };
type ProfileStats = { profile_views_count: number; post_impressions_count: number; range_days: number };
type NetworkCounts = { connections: number; pending: number; following: number };

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-beedero-black/50">{children}</p>
  );
}

function ProfileAvatar({
  name,
  profilePicture,
  className = "",
  size = "md",
}: {
  name: string;
  profilePicture?: string | null;
  className?: string;
  size?: "md" | "lg";
}) {
  const sizeClass = size === "lg" ? "size-14 text-base" : "size-11 text-sm";
  if (profilePicture) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img loading="lazy" src={profilePicture} alt="" className={`${sizeClass} shrink-0 rounded-full object-cover ${className}`} />
    );
  }
  return (
    <span
      className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full bg-zinc-100 font-semibold text-zinc-500 ${className}`}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function ProfileCard({
  me,
  orgs,
  stats,
  network,
  embedded = false,
}: {
  me: Me;
  orgs: Membership[];
  stats?: ProfileStats | null;
  network?: NetworkCounts | null;
  embedded?: boolean;
}) {
  const profile = me.investor_profile;
  const name = profile?.full_name || me.email;
  const atHandle = formatAtHandle(profile?.handle);

  const content = (
    <>
      <div
        className={`h-16 bg-gradient-to-br from-beedero-yellow/70 via-beedero-yellow/25 to-beedero-white ${
          embedded ? "" : "rounded-t-[1.35rem]"
        }`}
      />
      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
        <div className="-mt-9 flex items-end gap-3">
          <ProfileAvatar
            name={name}
            profilePicture={profile?.profile_picture}
            size="lg"
            className="ring-4 ring-beedero-white"
          />
          <div className="min-w-0 flex-1 pb-1">
            <p className="truncate text-base font-bold text-beedero-black">{name}</p>
            {atHandle && <p className="truncate text-xs font-medium text-zinc-500">{atHandle}</p>}
          </div>
        </div>
        {profile?.headline && (
          <p className="mt-2 text-sm leading-snug text-zinc-600">{profile.headline}</p>
        )}

        {stats && (
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-beedero-border/80 bg-beedero-yellow/15 p-3">
            <div>
              <p className="text-xl font-extrabold tabular-nums text-beedero-black">
                {stats.profile_views_count}
              </p>
              <p className="text-[11px] font-medium text-zinc-500">Profile views</p>
            </div>
            <div>
              <p className="text-xl font-extrabold tabular-nums text-beedero-black">
                {stats.post_impressions_count}
              </p>
              <p className="text-[11px] font-medium text-zinc-500">Post impressions</p>
            </div>
          </div>
        )}

        {network && (
          <Link
            href="/network"
            className="mt-4 flex items-center justify-between rounded-2xl border border-beedero-border px-3 py-2.5 text-sm font-semibold text-beedero-black transition hover:border-beedero-black hover:bg-beedero-yellow/15"
          >
            <span>
              Network · {network.connections} connection{network.connections === 1 ? "" : "s"}
              {network.pending > 0 && ` · ${network.pending} request${network.pending === 1 ? "" : "s"}`}
            </span>
            <span aria-hidden>→</span>
          </Link>
        )}

        <div className="mt-5">
          <SectionLabel>Organizations</SectionLabel>
          <div className="mt-2.5 flex flex-col gap-2">
            {orgs.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-beedero-border bg-zinc-50 px-3 py-4 text-center text-sm text-zinc-500">
                You don&apos;t belong to any org.
              </p>
            ) : (
              orgs.map((org) => (
                <Link
                  key={org.slug}
                  href={`/dashboard/${org.slug}`}
                  className="group flex items-center gap-3 rounded-2xl border border-beedero-border bg-beedero-white px-3 py-2.5 transition hover:border-beedero-black hover:bg-beedero-yellow/15"
                >
                  {org.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img loading="lazy" src={org.logo} alt="" className="size-9 shrink-0 rounded-full object-cover ring-1 ring-beedero-border/60" />
                  ) : (
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-beedero-yellow/30 text-xs font-bold text-beedero-black">
                      {org.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-beedero-black">{org.name}</span>
                    <span className="block truncate text-xs text-zinc-500">{formatAtHandle(org.slug)}</span>
                  </div>
                  <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    {org.role}
                  </span>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="size-4 shrink-0 text-subtle transition group-hover:translate-x-0.5 group-hover:text-beedero-black"
                    aria-hidden
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </Link>
              ))
            )}
          </div>
          <CreateOrgButton className="mt-3" />
        </div>

        <div className="mt-5 border-t border-beedero-border/70 pt-5">
          <SectionLabel>Quick actions</SectionLabel>
          <div className="mt-2.5 flex flex-col gap-2">
            <Link
              href="/discovery"
              className="flex items-center justify-between rounded-2xl border border-beedero-border px-3 py-2.5 text-sm font-semibold text-beedero-black transition hover:border-beedero-black hover:bg-beedero-yellow/15"
            >
              <span className="flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4" aria-hidden>
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                Discover
              </span>
              <span aria-hidden>→</span>
            </Link>
            <InvitePeopleButton className="mt-0" />
          </div>
        </div>
      </div>
    </>
  );

  if (embedded) return content;

  return (
    <div className="overflow-hidden rounded-3xl border-2 border-beedero-border bg-beedero-white shadow-sm">
      {content}
    </div>
  );
}

export function ProfileColumn({
  me,
  orgs,
  events,
  stats,
  network,
}: {
  me: Me;
  orgs: Membership[];
  events: CalendarEvent[];
  stats?: ProfileStats | null;
  network?: NetworkCounts | null;
}) {
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const profile = me.investor_profile;
  const name = profile?.full_name || me.email;

  return (
    <>
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobileExpanded((value) => !value)}
          className="flex w-full items-center gap-3 rounded-2xl border-2 border-beedero-border bg-beedero-white px-4 py-3 text-left shadow-sm"
          aria-expanded={mobileExpanded}
        >
          <ProfileAvatar name={name} profilePicture={profile?.profile_picture} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-beedero-black">{name}</p>
            {profile?.headline && (
              <p className="truncate text-xs text-zinc-500">{profile.headline}</p>
            )}
          </div>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`size-4 shrink-0 text-zinc-500 transition-transform ${
              mobileExpanded ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {mobileExpanded && (
          <div className="mt-3">
            <AppColumnSection label="Profile">
              <ProfileCard me={me} orgs={orgs} stats={stats} network={network} embedded />
              <div className="border-t border-beedero-border/70 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
                <SectionLabel>Calendar</SectionLabel>
                <div className="mt-2.5">
                  <EventsCalendar events={events} embedded />
                </div>
              </div>
            </AppColumnSection>
          </div>
        )}
      </div>

      <div className="hidden lg:block">
        <div className="sticky top-[5.5rem]">
          <AppColumnSection label="Profile">
            <ProfileCard me={me} orgs={orgs} stats={stats} embedded />
            <div className="border-t border-beedero-border/70 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
              <SectionLabel>Calendar</SectionLabel>
              <div className="mt-2.5">
                <EventsCalendar events={events} embedded />
              </div>
            </div>
          </AppColumnSection>
        </div>
      </div>
    </>
  );
}
