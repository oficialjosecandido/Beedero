"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { createOrgFromMatchAction } from "@/app/(app)/cofounder/actions";
import type { CofounderMatch } from "@/lib/cofounder-options";

/** Doc §6: the funnel closes here. Everything before this is conversation —
 * this is the point where a match becomes something real on Beedero, which
 * is why it's a first-class action on the match and not buried in a menu. */
export function CreateOrgFromMatch({ match }: { match: CofounderMatch }) {
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<{ slug: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (created) {
    return (
      <div className="rounded-2xl border border-beedero-border bg-zinc-50/70 px-4 py-3">
        <p className="text-sm font-semibold text-zinc-900">
          Organization created —{" "}
          <Link href={`/org/${created.slug}`} className="underline hover:text-beedero-black">
            open it
          </Link>
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          {match.other.name} has been invited as an owner. They join once they accept.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start rounded-xl border-2 border-beedero-black px-4 py-2 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white"
      >
        Create an organization together
      </button>
    );
  }

  function submit(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    const oneLiner = String(formData.get("one_liner") ?? "").trim();
    if (!name) {
      setError("Give it a name.");
      return;
    }
    startTransition(async () => {
      setError(null);
      const result = await createOrgFromMatchAction(match.id, name, oneLiner);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setCreated({ slug: result.slug });
    });
  }

  return (
    <form
      action={submit}
      className="flex flex-col gap-3 rounded-2xl border border-beedero-border bg-zinc-50/70 px-4 py-4"
    >
      <p className="text-sm font-semibold text-zinc-900">Start it together</p>
      <p className="text-xs leading-5 text-zinc-500">
        You become the first owner and {match.other.name} is invited as an owner too — they have to
        accept, nobody is added to a company without saying yes.
      </p>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
        Name
        <input
          name="name"
          required
          maxLength={200}
          placeholder="What are you calling it?"
          className="rounded-xl border border-beedero-border bg-white px-3 py-2 text-sm text-beedero-black outline-none transition focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
        One-liner <span className="font-normal text-zinc-500">(optional)</span>
        <input
          name="one_liner"
          maxLength={140}
          placeholder="What it does, in one sentence."
          className="rounded-xl border border-beedero-border bg-white px-3 py-2 text-sm text-beedero-black outline-none transition focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
        />
      </label>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-beedero-yellow px-4 py-2 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create organization"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl border border-beedero-border px-4 py-2 text-sm font-medium text-beedero-black hover:bg-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
