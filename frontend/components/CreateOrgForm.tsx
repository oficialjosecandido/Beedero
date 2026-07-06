"use client";

import { useActionState } from "react";

import { createOrgAction } from "@/app/(app)/dashboard/actions";

export function CreateOrgForm() {
  const [error, formAction, pending] = useActionState(createOrgAction, null);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-3xl border border-beedero-black/10 bg-beedero-white p-6 shadow-sm"
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
        Name
        <input
          name="name"
          required
          className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-beedero-black outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
        One-liner
        <input
          name="one_liner"
          required
          maxLength={140}
          placeholder="What do you do, in one sentence?"
          className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-beedero-black outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
        />
      </label>
      <p className="text-xs text-zinc-500">
        This creates a free draft. Add your logo, team, and other details later — publishing your
        profile is a separate step.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-xl bg-beedero-yellow px-4 py-2 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
      >
        {pending ? "..." : "Create organization"}
      </button>
    </form>
  );
}
