"use client";

import { useActionState } from "react";

import { updateProfileAction } from "@/app/(app)/dashboard/actions";
import { COUNTRIES } from "@/lib/countries";
import { useActionToast } from "@/lib/use-action-toast";

type Visibility = Record<string, string>;
type AttestationPrefs = Record<string, boolean>;

type Profile = {
  full_name?: string;
  headline?: string;
  bio?: string;
  country?: string;
  profile_picture?: string | null;
  handle?: string | null;
  visibility?: Visibility;
  attestation_prefs?: AttestationPrefs;
};

const VISIBILITY_SECTIONS = [
  { key: "bio", label: "Bio" },
  { key: "country", label: "Country" },
  { key: "posts", label: "Activity posts" },
  { key: "attestations", label: "Platform attestations" },
] as const;

const VISIBILITY_OPTIONS = [
  { value: "public", label: "Public" },
  { value: "verified_investors", label: "Verified investors only" },
  { value: "private", label: "Private" },
] as const;

export function ProfileForm({ profile }: { profile?: Profile | null }) {
  const [error, formAction, pending] = useActionState(updateProfileAction, null);
  useActionToast(error, pending, { successMessage: "Profile updated." });

  const visibility = profile?.visibility ?? {};
  const attestationPrefs = profile?.attestation_prefs ?? {};

  return (
    <form
      action={formAction}
      className="grid gap-4 rounded-3xl border-2 border-beedero-border bg-beedero-white p-6 shadow-sm"
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
        Full name
        <input
          name="full_name"
          required
          defaultValue={profile?.full_name ?? ""}
          className="rounded-xl border border-beedero-border bg-white px-3 py-2 text-sm text-beedero-black outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
        Headline
        <input
          name="headline"
          required
          placeholder="Investor, founder, operator..."
          defaultValue={profile?.headline ?? ""}
          className="rounded-xl border border-beedero-border bg-white px-3 py-2 text-sm text-beedero-black outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
        Public handle
        <span className="text-xs font-normal text-zinc-400">
          Your shareable profile URL: beedero.com/p/your-handle
        </span>
        <input
          name="handle"
          placeholder="ada-lovelace"
          defaultValue={profile?.handle ?? ""}
          pattern="[a-z0-9][a-z0-9-]{1,48}[a-z0-9]"
          className="rounded-xl border border-beedero-border bg-white px-3 py-2 text-sm text-beedero-black outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
        Country
        <select
          name="country"
          required
          defaultValue={profile?.country ?? ""}
          className="rounded-xl border border-beedero-border bg-white px-3 py-2 text-sm text-beedero-black outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
        >
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
          rows={4}
          defaultValue={profile?.bio ?? ""}
          className="rounded-xl border border-beedero-border bg-white px-3 py-2 text-sm text-beedero-black outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
        Profile picture <span className="font-normal text-zinc-400">(optional)</span>
        {profile?.profile_picture && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.profile_picture}
            alt=""
            className="size-16 rounded-full border border-beedero-border object-cover"
          />
        )}
        <input
          type="file"
          name="profile_picture"
          accept="image/*"
          className="text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-beedero-yellow file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-beedero-black hover:file:bg-beedero-black hover:file:text-beedero-white"
        />
      </label>

      <fieldset className="rounded-2xl border border-beedero-border/70 p-4">
        <legend className="px-1 text-sm font-bold text-zinc-800">Visibility</legend>
        <p className="mb-3 text-xs text-zinc-500">Control who sees each section on your public profile.</p>
        <div className="grid gap-3">
          {VISIBILITY_SECTIONS.map(({ key, label }) => (
            <label key={key} className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-zinc-700">{label}</span>
              <select
                name={`visibility_${key}`}
                defaultValue={visibility[key] ?? "public"}
                className="rounded-lg border border-beedero-border bg-white px-2 py-1 text-xs"
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
      </fieldset>

      <fieldset className="rounded-2xl border border-beedero-border/70 p-4">
        <legend className="px-1 text-sm font-bold text-zinc-800">Platform attestations</legend>
        <p className="mb-3 text-xs text-zinc-500">
          Beedero can prove facts from your activity — you choose what to display.
        </p>
        <div className="flex flex-col gap-2">
          {[
            { key: "show_verified_badge", label: "Show verified identity badge" },
            { key: "show_memberships", label: "Show organization memberships" },
            { key: "show_posts_count", label: "Show post count" },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                name={key}
                defaultChecked={attestationPrefs[key] !== false}
                className="size-4 rounded border-beedero-border"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-beedero-yellow px-5 py-2.5 text-sm font-bold text-beedero-black shadow-sm hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
      >
        {pending ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}
