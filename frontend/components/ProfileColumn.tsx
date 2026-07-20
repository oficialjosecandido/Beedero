"use client";

import Link from "next/link";
import { useState } from "react";

import { AppColumnHeader } from "@/components/AppColumnHeader";
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
type ProfileStats = { profile_views_count: number; post_impressions_count: number };

function ProfileAvatar({
  name,
  profilePicture,
  className = "",
}: {
  name: string;
  profilePicture?: string | null;
  className?: string;
}) {
  if (profilePicture) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={profilePicture} alt="" className={`size-11 shrink-0 rounded-full object-cover ${className}`} />
    );
  }
  return (
    <span
      className={`flex size-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-500 ${className}`}
    >
      {name.charAt(0).toUpperCase()}
    </span>
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
    <div className="overflow-hidden rounded-3xl border-2 border-beedero-border bg-beedero-white shadow-sm">
      <div
        className="h-20 bg-gradient-to-br from-beedero-yellow/40 to-zinc-100 bg-cover bg-center"
        style={profile?.cover_image ? { backgroundImage: `url(${profile.cover_image})` } : undefined}
      />
      <div className="px-5 pb-5">
        <div className="-mt-8 flex items-end gap-3">
          <ProfileAvatar
            name={name}
            profilePicture={profile?.profile_picture}
            className="ring-4 ring-beedero-white"
          />
          <div className="min-w-0 pb-0.5">
            <p className="truncate font-semibold">{name}</p>
            {atHandle && <p className="truncate text-xs font-medium text-zinc-500">{atHandle}</p>}
          </div>
        </div>
        {profile?.headline && (
          <p className="mt-2 truncate text-xs text-zinc-500">{profile.headline}</p>
        )}

        {stats && (
          <div className="mt-4 flex gap-5 border-t border-beedero-border pt-4">
            <div>
              <p className="text-sm font-bold text-beedero-black">{stats.profile_views_count}</p>
              <p className="text-xs text-zinc-500">Profile views</p>
            </div>
            <div>
              <p className="text-sm font-bold text-beedero-black">{stats.post_impressions_count}</p>
              <p className="text-xs text-zinc-500">Post impressions</p>
            </div>
          </div>
        )}

        <div className="mt-5 border-t border-beedero-border pt-5">
          <p className="text-sm font-bold uppercase tracking-[0.15em] text-beedero-black/60">
            Organizations
          </p>
          <div className="mt-3 flex flex-col gap-1.5">
            {orgs.length === 0 ? (
              <p className="text-sm text-zinc-500">You don&apos;t manage any organization yet.</p>
            ) : (
              orgs.map((org) => (
                <Link
                  key={org.slug}
                  href={`/dashboard/${org.slug}`}
                  className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-medium hover:bg-beedero-yellow/20"
                >
                  {org.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={org.logo} alt="" className="size-6 rounded-md object-cover" />
                  ) : (
                    <span className="flex size-6 items-center justify-center rounded-md bg-zinc-100 text-[10px] font-semibold text-zinc-500">
                      {org.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <span className="block truncate">{org.name}</span>
                    <span className="block truncate text-xs font-normal text-zinc-400">
                      {formatAtHandle(org.slug)}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
          <CreateOrgButton />
        </div>

        <div className="mt-5 border-t border-beedero-border pt-5">
          <Link
            href="/discovery"
            className="text-sm font-semibold text-beedero-black hover:underline"
          >
            Discover →
          </Link>
          <InvitePeopleButton />
        </div>
      </div>
    </div>
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
          <div className="mt-3 flex flex-col gap-3">
            <ProfileCard me={me} orgs={orgs} stats={stats} />
            <EventsCalendar events={events} />
          </div>
        )}
      </div>

      <div className="hidden flex-col gap-6 lg:flex">
        <AppColumnHeader label="Profile" />
        <ProfileCard me={me} orgs={orgs} stats={stats} />
        <EventsCalendar events={events} />
      </div>
    </>
  );
}
