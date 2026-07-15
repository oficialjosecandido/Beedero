import Link from "next/link";

import { CreateOrgButton } from "@/components/CreateOrgButton";

type InvestorProfile = {
  full_name?: string;
  headline?: string;
  profile_picture?: string | null;
};
type Me = { email: string; investor_profile: InvestorProfile | null };
type Membership = { slug: string; name: string; role: string; logo?: string | null };

export function AppSidebar({
  me,
  orgs,
  currentPage,
}: {
  me: Me;
  orgs: Membership[];
  currentPage: "feed" | "dashboard";
}) {
  const profile = me.investor_profile;
  const name = profile?.full_name || me.email;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-3xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          {profile?.profile_picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.profile_picture}
              alt=""
              className="size-11 rounded-full object-cover"
            />
          ) : (
            <span className="flex size-11 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-500">
              {name.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold">{name}</p>
            {profile?.headline && (
              <p className="truncate text-xs text-zinc-500">{profile.headline}</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm">
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

      <div className="flex flex-col gap-2 rounded-3xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm">
        {currentPage === "dashboard" && (
          <Link href="/feed" className="text-sm font-semibold text-beedero-black hover:underline">
            Go to Feed →
          </Link>
        )}
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
