"use client";

import { useActionState } from "react";

import { updateProfileAction } from "@/app/(app)/dashboard/actions";
import { COUNTRIES } from "@/lib/countries";

type Profile = {
  full_name?: string;
  headline?: string;
  bio?: string;
  country?: string;
  profile_picture?: string | null;
};

export function ProfileForm({ profile }: { profile?: Profile | null }) {
  const [error, formAction, pending] = useActionState(updateProfileAction, null);

  return (
    <form
      action={formAction}
      className="grid gap-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm"
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
        Full name
        <input
          name="full_name"
          required
          defaultValue={profile?.full_name ?? ""}
          className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
        Headline
        <input
          name="headline"
          required
          placeholder="Investor, founder, operator..."
          defaultValue={profile?.headline ?? ""}
          className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
        Country
        <select
          name="country"
          required
          defaultValue={profile?.country ?? ""}
          className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
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
          className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
        Profile picture <span className="font-normal text-zinc-400">(optional)</span>
        {profile?.profile_picture && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.profile_picture}
            alt=""
            className="size-16 rounded-full border border-zinc-200 object-cover"
          />
        )}
        <input
          type="file"
          name="profile_picture"
          accept="image/*"
          className="text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-emerald-700 hover:file:bg-emerald-100"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
      >
        {pending ? "Saving..." : "Complete profile"}
      </button>
    </form>
  );
}
