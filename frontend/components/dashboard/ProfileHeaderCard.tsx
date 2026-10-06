"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Camera, Pencil } from "lucide-react";

import { uploadProfilePictureAction } from "@/app/(app)/dashboard/actions";
import { Seal } from "@/components/app-shell/ui";
import { ShareProfileModal } from "@/components/dashboard/ShareProfileModal";
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
  visibility?: Record<string, string>;
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
 * as a quote. The camera opens a file picker and uploads immediately.
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

  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const pictureSrc = preview ?? profile?.profile_picture ?? null;

  function onPick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setError(null);

    const body = new FormData();
    body.set("profile_picture", file);
    startTransition(async () => {
      const result = await uploadProfilePictureAction(body);
      if ("error" in result) {
        setError(result.error);
        setPreview(null);
        URL.revokeObjectURL(objectUrl);
        return;
      }
      // Keep the local preview until the server re-renders with the new URL.
    });
  }

  return (
    <section className="border border-white/10 bg-white/[0.025] p-5 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex min-w-0 items-start gap-4">
          <div className="relative">
            {pictureSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pictureSrc}
                alt=""
                className={`size-16 shrink-0 rounded-full object-cover ${pending ? "opacity-60" : ""}`}
              />
            ) : (
              <span
                aria-hidden
                className="grid size-16 shrink-0 place-items-center rounded-full bg-[#68738a] text-xl font-black text-white"
              >
                {initials(name)}
              </span>
            )}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={pending}
              aria-label={pending ? "Uploading profile photo" : "Change profile photo"}
              className="absolute -bottom-1 -right-1 grid size-7 place-items-center rounded-full border-2 border-app-bg bg-beedero-yellow text-beedero-black transition hover:scale-105 disabled:opacity-60"
            >
              <Camera size={13} aria-hidden />
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={onPick}
            />
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
            {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
            {pending && !error && (
              <p className="mt-2 text-xs text-white/45">Uploading photo…</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <ShareProfileModal handle={profile?.handle} visibility={profile?.visibility} />
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
