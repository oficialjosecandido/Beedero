import Link from "next/link";
import { Camera, Pencil, Share2 } from "lucide-react";

import { Seal } from "@/components/app-shell/ui";
import { COUNTRIES } from "@/lib/countries";

type ProfileLink = { label?: string; url: string };

export type HeaderProfile = {
  full_name?: string;
  headline?: string;
  bio?: string;
  country?: string;
  city?: string;
  links?: ProfileLink[];
  profile_picture?: string | null;
  handle?: string | null;
  is_verified?: boolean;
};

function countryName(code?: string) {
  if (!code) return "";
  return COUNTRIES.find(([value]) => value === code)?.[1] ?? code;
}

/** `city, Country` — whichever halves exist. */
function locationLine(profile: HeaderProfile) {
  return [profile.city, countryName(profile.country)].filter(Boolean).join(", ");
}

/** The design shows a bare host ("almalabs.pt"), not the full URL. */
function primaryHost(links: ProfileLink[] | undefined) {
  const url = links?.find((link) => link.url)?.url;
  if (!url) return "";
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/**
 * The Figma "My profile" header: identity, the two profile CTAs, and the bio
 * as a quote. The camera affordance links to the settings tab rather than
 * uploading inline — `ProfileForm` owns the `profile_picture` field.
 */
export function ProfileHeaderCard({
  profile,
  email,
}: {
  profile: HeaderProfile | null;
  email: string;
}) {
  const name = profile?.full_name || email;
  const location = profile ? locationLine(profile) : "";
  const host = primaryHost(profile?.links);
  const meta = [location, host].filter(Boolean).join(" · ");

  return (
    <section className="border border-white/10 bg-white/[0.025] p-5 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-0 items-start gap-4">
          <div className="relative">
            {profile?.profile_picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.profile_picture}
                alt=""
                className="size-16 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="grid size-16 shrink-0 place-items-center rounded-full bg-[#68738a] text-xl font-black text-white"
              >
                {initials(name)}
              </span>
            )}
            <Link
              href="/dashboard?tab=settings"
              aria-label="Change profile photo in profile settings"
              className="absolute -bottom-1 -right-1 grid size-7 place-items-center rounded-full border-2 border-app-bg bg-beedero-yellow text-beedero-black"
            >
              <Camera size={13} aria-hidden />
            </Link>
          </div>

          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-beedero-yellow">
              My profile
            </p>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="min-w-0 truncate text-4xl font-black tracking-[-0.055em]">{name}</h1>
              {profile?.is_verified && <Seal className="mt-1" />}
            </div>
            {profile?.headline && <p className="mt-1 text-base text-white/65">{profile.headline}</p>}
            {meta && <p className="mt-2 text-xs text-white/40">{meta}</p>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {profile?.handle && (
            <Link
              href={`/p/${profile.handle}`}
              className="flex items-center gap-2 border border-white/15 px-4 py-2.5 text-xs font-bold text-white/70 transition hover:border-beedero-yellow hover:text-beedero-yellow"
            >
              <Share2 size={14} aria-hidden /> Share public profile
            </Link>
          )}
          <Link
            href="/dashboard?tab=settings"
            className="flex items-center gap-2 border border-beedero-yellow/60 px-4 py-2.5 text-xs font-bold text-beedero-yellow transition hover:bg-beedero-yellow hover:text-beedero-black"
          >
            <Pencil size={14} aria-hidden /> Edit profile
          </Link>
        </div>
      </div>

      {profile?.bio && (
        <p className="mt-6 max-w-2xl border-l-2 border-beedero-yellow pl-4 text-sm leading-6 text-white/65">
          {profile.bio}
        </p>
      )}
    </section>
  );
}
