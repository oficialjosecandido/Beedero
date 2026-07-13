"use client";

import { useActionState, useState } from "react";

import { createInvestorPostAction } from "@/app/(app)/dashboard/actions";
import { useActionToast } from "@/lib/use-action-toast";

const POST_KIND_OPTIONS = [
  { value: "milestone", label: "Milestone" },
  { value: "event", label: "Event" },
  { value: "update", label: "Update" },
];

export function InvestorPostForm() {
  const [error, formAction, pending] = useActionState(createInvestorPostAction, null);
  const [kind, setKind] = useState(POST_KIND_OPTIONS[0].value);
  const allowsPhoto = kind === "event" || kind === "update";
  useActionToast(error, pending, { successMessage: "Post published!" });

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-3xl border border-beedero-black/10 bg-beedero-white p-6 shadow-sm"
    >
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
          Type
          <select
            name="kind"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
            className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
          >
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
      {allowsPhoto ? (
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
          Photo (optional, max 1)
          <input
            type="file"
            name="image"
            accept="image/*"
            className="text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-beedero-yellow file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-beedero-black hover:file:bg-beedero-black hover:file:text-beedero-white"
          />
        </label>
      ) : (
        <p className="text-xs text-zinc-500">Milestones are text-only and cannot include photos.</p>
      )}
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
