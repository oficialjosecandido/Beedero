"use client";

import { useActionState } from "react";

import { createInvestorPostAction } from "@/app/(app)/dashboard/actions";

const POST_KIND_OPTIONS = [
  { value: "milestone", label: "Milestone" },
  { value: "event", label: "Event" },
  { value: "update", label: "Update" },
];

export function InvestorPostForm() {
  const [error, formAction, pending] = useActionState(createInvestorPostAction, null);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-3xl border border-beedero-black/10 bg-beedero-white p-6 shadow-sm"
    >
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
          Type
          <select name="kind" className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60">
            {POST_KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <input
          name="title"
          placeholder="Title"
          required
          className="min-w-[12rem] flex-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
        />
      </div>
      <textarea
        name="body"
        placeholder="Say more..."
        rows={3}
        className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
      />
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
        Photo (optional)
        <input
          type="file"
          name="image"
          accept="image/*"
          className="text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-beedero-yellow file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-beedero-black hover:file:bg-beedero-black hover:file:text-beedero-white"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-xl bg-beedero-yellow px-4 py-2 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
      >
        {pending ? "Publishing..." : "Publish"}
      </button>
    </form>
  );
}
