"use client";

import Link from "next/link";
import { useActionState } from "react";

import { useActionToast } from "@/lib/use-action-toast";

import { addExperienceAction } from "./actions";

/**
 * Step 3 of §6.3 — "O teu percurso: importar o PDF ou adicionar à mão (pode
 * saltar-se)".
 *
 * One role, by hand, and a skip that is as prominent as the submit. The doc is
 * explicit that this step is optional, and the form asks for the two fields
 * that make a role recognisable rather than the whole of it: the profile editor
 * exists for the rest, and this screen's job is to not be the reason somebody
 * closes the tab.
 *
 * The PDF import is item #7 (§6.2) and lands beside this form when it is
 * built — the doc suggests exactly that hand-off, so there is deliberately no
 * placeholder button for it here.
 */
export function ExperienceStep() {
  const [error, action, pending] = useActionState(addExperienceAction, null);

  useActionToast(error, pending);

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-beedero-black">Company</span>
          <input
            name="org_name"
            maxLength={200}
            placeholder="WaveRent"
            className="rounded-xl border-2 border-beedero-border bg-beedero-white px-3 py-2.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-beedero-black">Your role</span>
          <input
            name="role"
            maxLength={200}
            placeholder="Backend engineer"
            className="rounded-xl border-2 border-beedero-border bg-beedero-white px-3 py-2.5 text-sm"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 sm:max-w-xs">
        <span className="text-sm font-semibold text-beedero-black">
          Started <span className="font-normal text-zinc-500">(optional)</span>
        </span>
        <input
          type="date"
          name="started_on"
          className="rounded-xl border-2 border-beedero-border bg-beedero-white px-3 py-2.5 text-sm"
        />
      </label>

      <p className="text-xs text-zinc-500">
        You add this yourself, so it starts as self-declared. An organisation can confirm it
        later, and that is what turns it into a verified fact.
      </p>

      {error && (
        <p role="alert" className="text-sm font-medium text-danger-strong">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-beedero-black px-5 py-2.5 text-sm font-bold text-beedero-yellow transition hover:bg-beedero-yellow hover:text-beedero-black disabled:opacity-60"
        >
          {pending ? "Adding…" : "Add and continue"}
        </button>
        <Link
          href="/onboarding?step=suggestions"
          className="text-sm font-semibold text-zinc-500 underline underline-offset-2 hover:text-beedero-black"
        >
          I&apos;ll do this later
        </Link>
      </div>
    </form>
  );
}
