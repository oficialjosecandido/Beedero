"use client";

import { useActionState } from "react";

import { createOrgAction } from "@/app/(app)/dashboard/actions";

const STAGES = [
  ["idea", "Idea"],
  ["pre_seed", "Pre-seed"],
  ["seed", "Seed"],
  ["series_a", "Series A"],
  ["growth", "Growth"],
];

const SECTORS = [
  ["software", "Software"],
  ["fintech", "Fintech"],
  ["health", "Health"],
  ["climate", "Climate"],
  ["consumer", "Consumer"],
  ["marketplace", "Marketplace"],
  ["other", "Other"],
];

const GEOGRAPHIES = [
  ["portugal", "Portugal"],
  ["europe", "Europe"],
  ["north_america", "North America"],
  ["latin_america", "Latin America"],
  ["remote", "Remote"],
  ["other", "Other"],
];

export function CreateOrgForm() {
  const [error, formAction, pending] = useActionState(createOrgAction, null);

  return (
    <form action={formAction} className="grid gap-4 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm md:grid-cols-2">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700 md:col-span-2">
        Name
        <input
          name="name"
          required
          className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
        Stage
        <select name="stage" className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950">
          {STAGES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
        Sector
        <select name="sector" className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950">
          {SECTORS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700 md:col-span-2">
        Address / geography
        <select name="geo" className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950">
          {GEOGRAPHIES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="md:col-span-2">
        <p className="text-sm font-semibold text-zinc-900">Add organization fields</p>
        <p className="mt-1 text-sm text-zinc-500">
          Add at least 5 profile fields before posting organization updates.
        </p>
      </div>
      {[
        ["about", "About"],
        ["team", "Team"],
        ["products", "Products"],
        ["market_thesis", "Market thesis"],
      ].map(([name, label]) => (
        <label key={name} className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
          {label}
          <textarea
            name={name}
            rows={3}
            className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
      ))}
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 md:col-span-2"
      >
        {pending ? "..." : "Create organization"}
      </button>
    </form>
  );
}
