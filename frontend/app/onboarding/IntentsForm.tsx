"use client";

import Link from "next/link";
import { useActionState } from "react";

import { useActionToast } from "@/lib/use-action-toast";
import type { IntentOption } from "@/lib/types";

import { saveIntentsAction } from "./actions";

/**
 * Step 2 of §6.3 — "O que te traz cá (escolha múltipla, privada — são
 * capacidades, não rótulos públicos)".
 *
 * The "privada" part is told to the person, not just honoured in the backend:
 * somebody deciding whether to tick "procurar emprego" while employed needs to
 * know it will not appear on their profile. It will not — §9 forbids it, the
 * field is absent from every public payload, and the sentence under the list is
 * the part they can actually check.
 */
export function IntentsForm({
  options,
  selected,
}: {
  options: IntentOption[];
  selected: string[];
}) {
  const [error, action, pending] = useActionState(saveIntentsAction, null);

  useActionToast(error, pending);

  return (
    <form action={action} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">What brings you here</legend>
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-beedero-border bg-beedero-white px-4 py-3 text-sm font-medium transition hover:bg-beedero-yellow/15 has-checked:border-beedero-black has-checked:bg-beedero-yellow/25"
          >
            <input
              type="checkbox"
              name="intents"
              value={option.value}
              defaultChecked={selected.includes(option.value)}
              className="size-4 accent-beedero-black"
            />
            {option.label}
          </label>
        ))}
      </fieldset>

      <p className="text-xs text-zinc-500">
        Private. This decides what we show you first and never appears on your public profile.
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
          {pending ? "Saving…" : "Continue"}
        </button>
        {/* A link, not a second submit: "skip" means don't answer, so it must
            not post whatever happens to be ticked. Nothing is saved, which
            leaves an earlier answer — if there was one — as it was. */}
        <Link
          href="/onboarding?step=experience"
          className="text-sm font-semibold text-zinc-500 underline underline-offset-2 hover:text-beedero-black"
        >
          Skip this
        </Link>
      </div>
    </form>
  );
}
