"use client";

import { useActionState, useId, useState } from "react";

import { updateProfileAction } from "@/app/(app)/dashboard/actions";
import { COUNTRIES } from "@/lib/countries";
import { formatAtHandle } from "@/lib/handles";
import { useActionToast } from "@/lib/use-action-toast";

type Visibility = Record<string, string>;
type AttestationPrefs = Record<string, boolean>;

type Profile = {
  full_name?: string;
  headline?: string;
  bio?: string;
  country?: string;
  profile_picture?: string | null;
  cover_image?: string | null;
  handle?: string | null;
  visibility?: Visibility;
  attestation_prefs?: AttestationPrefs;
};

const VISIBILITY_SECTIONS = [
  { key: "bio", label: "Bio", hint: "Your about text" },
  { key: "country", label: "Country", hint: "Where you're based" },
  { key: "posts", label: "Activity posts", hint: "Updates and milestones" },
  { key: "attestations", label: "Platform facts", hint: "Memberships and stats" },
] as const;

const VISIBILITY_OPTIONS = [
  { value: "public", label: "Public" },
  { value: "verified_investors", label: "Verified only" },
  { value: "private", label: "Private" },
] as const;

const ATTESTATION_OPTIONS = [
  { key: "show_memberships", label: "Organization memberships", hint: "Teams you belong to" },
  { key: "show_posts_count", label: "Post count", hint: "How active you are on Beedero" },
] as const;

const fieldClass =
  "w-full rounded-xl border border-beedero-border bg-white px-3 py-2.5 text-sm text-beedero-black outline-none transition-colors focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60";

function ProfileAvatar({
  name,
  profilePicture,
  preview,
}: {
  name: string;
  profilePicture?: string | null;
  preview?: string | null;
}) {
  const src = preview ?? profilePicture;
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className="size-20 rounded-full border-2 border-beedero-border object-cover shadow-sm" />
    );
  }
  return (
    <span className="flex size-20 shrink-0 items-center justify-center rounded-full border-2 border-beedero-border bg-gradient-to-br from-beedero-yellow/30 to-zinc-100 text-2xl font-bold text-zinc-600">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function CoverPreview({ coverImage, preview }: { coverImage?: string | null; preview?: string | null }) {
  const src = preview ?? coverImage;
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className="h-24 w-full rounded-xl border border-beedero-border object-cover shadow-sm sm:w-48" />
    );
  }
  return (
    <div className="flex h-24 w-full items-center justify-center rounded-xl border border-dashed border-beedero-border bg-gradient-to-br from-beedero-yellow/20 to-zinc-100 text-xs font-medium text-zinc-400 sm:w-48">
      No cover photo
    </div>
  );
}

export function ProfileForm({
  profile,
  variant = "settings",
}: {
  profile?: Profile | null;
  variant?: "settings" | "onboarding";
}) {
  const [error, formAction, pending] = useActionState(updateProfileAction, null);
  useActionToast(error, pending, { successMessage: "Profile updated." });

  const fileInputId = useId();
  const coverInputId = useId();
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [coverName, setCoverName] = useState<string | null>(null);

  const visibility = profile?.visibility ?? {};
  const attestationPrefs = profile?.attestation_prefs ?? {};
  const displayName = profile?.full_name || "Your profile";
  const nameLocked = Boolean(profile?.full_name);

  function onPhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setPhotoPreview(null);
      setPhotoName(null);
      return;
    }
    setPhotoName(file.name);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function onCoverChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setCoverPreview(null);
      setCoverName(null);
      return;
    }
    setCoverName(file.name);
    setCoverPreview(URL.createObjectURL(file));
  }

  return (
    <form action={formAction} className="overflow-hidden rounded-3xl border-2 border-beedero-border bg-beedero-white shadow-sm">
      <div className="border-b border-beedero-border bg-beedero-yellow px-6 py-5">
        <h2 className="text-xl font-extrabold tracking-tight text-zinc-900">
          {variant === "onboarding" ? "Complete your profile" : "Profile settings"}
        </h2>
        <p className="mt-1 max-w-xl text-sm leading-6 text-zinc-600">
          {variant === "onboarding"
            ? "Add enough context so Beedero can recommend people and organizations to follow."
            : "Update your headline, bio, photo, and what others can see."}
        </p>
      </div>

      <div className="flex flex-col gap-8 px-6 py-6">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
          <section className="flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-extrabold text-zinc-900">About you</h3>
              <p className="mt-0.5 text-xs text-zinc-500">How you present yourself on Beedero.</p>
            </div>
            {nameLocked ? (
              <div>
                <p className="text-lg font-extrabold text-zinc-900">{profile?.full_name}</p>
                {profile?.handle && (
                  <p className="mt-0.5 text-sm font-semibold text-zinc-600">
                    {formatAtHandle(profile.handle)}
                  </p>
                )}
                <p className="mt-0.5 text-xs text-zinc-400">
                  Your public ID is assigned from your name and cannot be changed.
                </p>
              </div>
            ) : (
              <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
                Full name
                <input name="full_name" required placeholder="Your full name" className={fieldClass} />
              </label>
            )}
            <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
              Headline
              <input
                name="headline"
                required
                placeholder="Investor, founder, operator..."
                defaultValue={profile?.headline ?? ""}
                className={fieldClass}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
              Country
              <select name="country" required defaultValue={profile?.country ?? ""} className={fieldClass}>
                <option value="" disabled>
                  Select a country
                </option>
                {COUNTRIES.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
              Bio <span className="font-normal text-zinc-400">(optional)</span>
              <textarea
                name="bio"
                rows={5}
                placeholder="A short intro — what you do and what you're looking for."
                defaultValue={profile?.bio ?? ""}
                className={`${fieldClass} min-h-[8rem] resize-y`}
              />
            </label>
            <div className="rounded-2xl border border-beedero-border bg-zinc-50/50 p-4">
              <p className="text-sm font-semibold text-zinc-800">Profile photo</p>
              <p className="mt-0.5 text-xs text-zinc-400">Optional — shown on your profile and in the sidebar.</p>
              <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                <ProfileAvatar
                  name={displayName}
                  profilePicture={profile?.profile_picture}
                  preview={photoPreview}
                />
                <div>
                  <input
                    id={fileInputId}
                    type="file"
                    name="profile_picture"
                    accept="image/*"
                    className="sr-only"
                    onChange={onPhotoChange}
                  />
                  <label
                    htmlFor={fileInputId}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl border-2 border-beedero-border bg-white px-3 py-2 text-sm font-semibold text-beedero-black transition-colors hover:border-beedero-black hover:bg-beedero-yellow/15"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4" aria-hidden>
                      <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16" />
                    </svg>
                    {photoName ? "Change photo" : "Upload photo"}
                  </label>
                  {photoName && <p className="mt-1.5 truncate text-xs text-zinc-500">{photoName}</p>}
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-beedero-border bg-zinc-50/50 p-4">
              <p className="text-sm font-semibold text-zinc-800">Cover photo</p>
              <p className="mt-0.5 text-xs text-zinc-400">Optional — the banner shown behind your profile.</p>
              <div className="mt-4 flex flex-col items-start gap-4">
                <CoverPreview coverImage={profile?.cover_image} preview={coverPreview} />
                <div>
                  <input
                    id={coverInputId}
                    type="file"
                    name="cover_image"
                    accept="image/*"
                    className="sr-only"
                    onChange={onCoverChange}
                  />
                  <label
                    htmlFor={coverInputId}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl border-2 border-beedero-border bg-white px-3 py-2 text-sm font-semibold text-beedero-black transition-colors hover:border-beedero-black hover:bg-beedero-yellow/15"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4" aria-hidden>
                      <path d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16" />
                    </svg>
                    {coverName ? "Change cover" : "Upload cover"}
                  </label>
                  {coverName && <p className="mt-1.5 truncate text-xs text-zinc-500">{coverName}</p>}
                </div>
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-8">
            <section>
              <div className="mb-3">
                <h3 className="text-sm font-extrabold text-zinc-900">Who can see what</h3>
                <p className="mt-0.5 text-xs text-zinc-500">Control visibility for each part of your profile.</p>
              </div>
              <div className="overflow-hidden rounded-2xl border border-beedero-border divide-y divide-beedero-border/70">
                {VISIBILITY_SECTIONS.map(({ key, label, hint }) => (
                  <label
                    key={key}
                    className="flex flex-col gap-2 bg-zinc-50/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-zinc-800">{label}</span>
                      <span className="block text-xs text-zinc-400">{hint}</span>
                    </span>
                    <select
                      name={`visibility_${key}`}
                      defaultValue={visibility[key] ?? "public"}
                      className="w-full shrink-0 rounded-lg border border-beedero-border bg-white px-2.5 py-2 text-sm font-medium text-zinc-800 outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60 sm:w-40"
                    >
                      {VISIBILITY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-3">
                <h3 className="text-sm font-extrabold text-zinc-900">Show on your profile</h3>
                <p className="mt-0.5 text-xs text-zinc-500">Facts Beedero can display from your activity.</p>
              </div>
              <div className="flex flex-col gap-2">
                {ATTESTATION_OPTIONS.map(({ key, label, hint }) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-start gap-3 rounded-2xl border border-beedero-border bg-zinc-50/40 px-4 py-3 transition-colors has-[:checked]:border-beedero-black/20 has-[:checked]:bg-beedero-yellow/10"
                  >
                    <input
                      type="checkbox"
                      name={key}
                      defaultChecked={attestationPrefs[key] !== false}
                      className="mt-0.5 size-4 shrink-0 rounded border-beedero-border accent-beedero-black"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-zinc-800">{label}</span>
                      <span className="block text-xs text-zinc-400">{hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>

      <div className="border-t border-beedero-border bg-zinc-50/80 px-6 py-4">
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-beedero-yellow px-5 py-3 text-sm font-bold text-beedero-black shadow-sm transition-colors hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50 sm:w-auto sm:min-w-[10rem]"
        >
          {pending ? "Saving..." : "Save profile"}
        </button>
      </div>
    </form>
  );
}
