"use client";

import Link from "next/link";
import { useState } from "react";

import { AppColumnHeader } from "@/components/AppColumnHeader";
import { CreateOrgButton } from "@/components/CreateOrgButton";

type InvestorProfile = {
  full_name?: string;
  headline?: string;
  profile_picture?: string | null;
};
type Me = { email: string; investor_profile: InvestorProfile | null };
type Membership = { slug: string; name: string; role: string; logo?: string | null };

function ProfileAvatar({ name, profilePicture }: { name: string; profilePicture?: string | null }) {
  if (profilePicture) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={profilePicture} alt="" className="size-11 shrink-0 rounded-full object-cover" />
    );
  }
  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-500">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function ProfileCard({ me, orgs }: { me: Me; orgs: Membership[] }) {
  const profile = me.investor_profile;
  const name = profile?.full_name || me.email;

  return (
    <div className="rounded-3xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <ProfileAvatar name={name} profilePicture={profile?.profile_picture} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{name}</p>
          {profile?.headline && (
            <p className="truncate text-xs text-zinc-500">{profile.headline}</p>
          )}
        </div>
      </div>

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
                <span className="truncate">{org.name}</span>
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
      </div>
    </div>
  );
}

export function ProfileColumn({
  me,
  orgs,
}: {
  me: Me;
  orgs: Membership[];
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
            <ProfileCard me={me} orgs={orgs} />
          </div>
        )}
      </div>

      <div className="hidden flex-col gap-6 lg:flex">
        <AppColumnHeader label="Profile" />
        <ProfileCard me={me} orgs={orgs} />
      </div>
    </>
  );
}
