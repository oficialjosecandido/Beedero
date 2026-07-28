"use client";

import Link from "next/link";
import { useState } from "react";

import { CreateOrgButton } from "@/components/CreateOrgButton";
import { EventsCalendar } from "@/components/EventsCalendar";
import { InvitePeopleButton } from "@/components/InvitePeopleButton";
import { formatAtHandle } from "@/lib/handles";

type InvestorProfile = {
  full_name?: string;
  headline?: string;
  profile_picture?: string | null;
  cover_image?: string | null;
  handle?: string | null;
};
type Me = { email: string; investor_profile: InvestorProfile | null };
type Membership = { slug: string; name: string; role: string; logo?: string | null };
type CalendarEvent = { id: number | string; title: string; occurred_at: string; ends_at?: string | null };
type ProfileStats = { profile_views_count: number; post_impressions_count: number; range_days: number };

function SidebarCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-lg border border-zinc-300/80 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.03),0_2px_4px_rgba(0,0,0,0.05)] ${className}`}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`text-sm font-semibold text-zinc-900 ${className}`}>{children}</h3>;
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
  const sizeClass = size === "lg" ? "size-[72px] text-lg" : "size-11 text-sm";
  if (profilePicture) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={profilePicture} alt="" className={`${sizeClass} shrink-0 rounded-full object-cover ${className}`} />
    );
  }
  return (
    <span
      className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full bg-zinc-200 font-semibold text-zinc-600 ${className}`}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function QuickActionRow({
  href,
  onClick,
  icon,
  children,
}: {
  href?: string;
  onClick?: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const className =
    "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-900";

  const content = (
    <>
      <span className="flex size-5 shrink-0 items-center justify-center text-zinc-500">{icon}</span>
      <span className="flex-1">{children}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

function ProfileCard({
  me,
  orgs,
  stats,
}: {
  me: Me;
  orgs: Membership[];
  stats?: ProfileStats | null;
}) {
  const profile = me.investor_profile;
  const name = profile?.full_name || me.email;
  const atHandle = formatAtHandle(profile?.handle);

  return (
    <SidebarCard>
      <div
        className="h-[54px] bg-zinc-200 bg-cover bg-center"
        style={profile?.cover_image ? { backgroundImage: `url(${profile.cover_image})` } : undefined}
      />
      <div className="px-4 pb-4">
        <div className="-mt-[38px] mb-3">
          <ProfileAvatar
            name={name}
            profilePicture={profile?.profile_picture}
            size="lg"
            className="ring-2 ring-white"
          />
        </div>

        <div className="min-w-0">
          <p className="truncate text-base font-semibold leading-snug text-zinc-900">{name}</p>
          {atHandle && <p className="truncate text-xs text-zinc-500">{atHandle}</p>}
          {profile?.headline && (
            <p className="mt-1.5 text-sm leading-snug text-zinc-600">{profile.headline}</p>
          )}
        </div>

        {stats && (
          <div className="mt-3 border-y border-zinc-200 py-3">
            <div className="flex">
              <div className="flex-1 text-center">
                <p className="text-lg font-semibold tabular-nums text-zinc-900">
                  {stats.profile_views_count}
                </p>
                <p className="mt-0.5 text-[11px] leading-tight text-zinc-500">Profile views</p>
              </div>
              <div className="w-px bg-zinc-200" aria-hidden />
              <div className="flex-1 text-center">
                <p className="text-lg font-semibold tabular-nums text-zinc-900">
                  {stats.post_impressions_count}
                </p>
                <p className="mt-0.5 text-[11px] leading-tight text-zinc-500">Post impressions</p>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wide text-zinc-400">
                Last {stats.range_days} days
              </p>
              <Link
                href="/dashboard?tab=kpis"
                className="text-[11px] font-semibold text-zinc-600 hover:text-zinc-900 hover:underline"
              >
                More insights →
              </Link>
            </div>
          </div>
        )}

        <div className="mt-4">
          <SectionTitle>Organizations</SectionTitle>
          <div className="mt-2 flex flex-col gap-1">
            {orgs.length === 0 ? (
              <p className="rounded-md bg-zinc-50 px-3 py-3 text-center text-sm text-zinc-500">
                You don&apos;t manage any organizations yet.
              </p>
            ) : (
              orgs.map((org) => (
                <Link
                  key={org.slug}
                  href={`/dashboard/${org.slug}`}
                  className="group flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-zinc-100"
                >
                  {org.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={org.logo} alt="" className="size-10 shrink-0 rounded-sm object-cover" />
                  ) : (
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-zinc-200 text-sm font-semibold text-zinc-600">
                      {org.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-zinc-900">{org.name}</span>
                    <span className="block truncate text-xs text-zinc-500">{formatAtHandle(org.slug)}</span>
                  </div>
                  <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                    {org.role}
                  </span>
                </Link>
              ))
            )}
          </div>
          <CreateOrgButton className="mt-3" />
        </div>

        <div className="mt-4 border-t border-zinc-200 pt-1">
          <SectionTitle className="px-4 pt-3">Quick actions</SectionTitle>
          <div className="-mx-4 mt-1">
            <QuickActionRow
              href="/discovery"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4" aria-hidden>
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
              }
            >
              Discover
            </QuickActionRow>
            <InvitePeopleButton variant="row" className="mt-0" />
          </div>
        </div>
      </div>
    </SidebarCard>
  );
}

export function ProfileColumn({
  me,
  orgs,
  events,
  stats,
}: {
  me: Me;
  orgs: Membership[];
  events: CalendarEvent[];
  stats?: ProfileStats | null;
}) {
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const profile = me.investor_profile;
  const name = profile?.full_name || me.email;

  const calendarCard = (
    <SidebarCard className="p-4">
      <SectionTitle>Calendar</SectionTitle>
      <div className="mt-3">
        <EventsCalendar events={events} embedded />
      </div>
    </SidebarCard>
  );

  return (
    <>
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobileExpanded((value) => !value)}
          className="flex w-full items-center gap-3 rounded-lg border border-zinc-300/80 bg-white px-4 py-3 text-left shadow-sm"
          aria-expanded={mobileExpanded}
        >
          <ProfileAvatar name={name} profilePicture={profile?.profile_picture} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-900">{name}</p>
            {profile?.headline && (
              <p className="truncate text-xs text-zinc-500">{profile.headline}</p>
            )}
          </div>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`size-4 shrink-0 text-zinc-400 transition-transform ${
              mobileExpanded ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        {mobileExpanded && (
          <div className="mt-2 space-y-2">
            <ProfileCard me={me} orgs={orgs} stats={stats} />
            {calendarCard}
          </div>
        )}
      </div>

      <div className="hidden lg:block">
        <div className="sticky top-[5.5rem] space-y-2">
          <ProfileCard me={me} orgs={orgs} stats={stats} />
          {calendarCard}
        </div>
      </div>
    </>
  );
}
