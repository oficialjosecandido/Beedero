"use client";

import { useActionState, useState } from "react";

import { useActionToast } from "@/lib/use-action-toast";
import type { OnboardingState } from "@/lib/types";

import { saveIdentityAction } from "./actions";

/**
 * Step 1 of §6.3 — "Quem és: nome, handle, cidade, frase curta sobre ti".
 *
 * The handle is shown as the address it will become (`beedero.com/p/<handle>`)
 * rather than as a bare field, because that is the only thing that explains why
 * it matters and why it is being asked now. Once onboarding is done it is
 * locked (accounts/onboarding.py), so this is the one screen that offers it.
 */
export function IdentityForm({ state }: { state: OnboardingState }) {
  const [error, action, pending] = useActionState(saveIdentityAction, null);
  const [handle, setHandle] = useState(state.handle || state.handle_suggestion);

  useActionToast(error, pending);

  const nameLocked = Boolean(state.full_name);

  return (
    <form action={action} className="flex flex-col gap-5">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-beedero-black">Your name</span>
        <input
          name="full_name"
          defaultValue={state.full_name}
          required
          maxLength={200}
          readOnly={nameLocked}
          autoComplete="name"
          className="rounded-xl border-2 border-beedero-border bg-beedero-white px-3 py-2.5 text-sm read-only:bg-zinc-50 read-only:text-zinc-500"
        />
        {nameLocked && (
          <span className="text-xs text-zinc-500">
            Your name is what confirmed roles and verifications were issued against, so it
            can&apos;t be changed here.
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-beedero-black">Your public address</span>
        <span className="flex items-center overflow-hidden rounded-xl border-2 border-beedero-border bg-beedero-white">
          <span className="shrink-0 px-3 py-2.5 text-sm text-zinc-500">beedero.com/p/</span>
          <input
            name="handle"
            value={handle}
            onChange={(event) => setHandle(event.target.value.toLowerCase())}
            readOnly={state.handle_locked}
            maxLength={50}
            inputMode="text"
            autoCapitalize="none"
            spellCheck={false}
            className="w-full border-0 py-2.5 pr-3 text-sm focus:outline-none read-only:text-zinc-500"
          />
        </span>
        <span className="text-xs text-zinc-500">
          {state.handle_locked
            ? "People may already have this link, so it stays as it is."
            : "Lowercase letters and numbers. This is the last time you can change it."}
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-beedero-black">Your base city</span>
        <input
          name="city"
          defaultValue={state.city}
          required
          maxLength={80}
          placeholder="Lisboa"
          autoComplete="address-level2"
          className="rounded-xl border-2 border-beedero-border bg-beedero-white px-3 py-2.5 text-sm"
        />
        {/* §6.1: "Declarada no onboarding, nunca deduzida do IP." Saying so is
            also the honest answer to "why are you asking me this?". */}
        <span className="text-xs text-zinc-500">
          Used for suggestions and local filters. We never guess it from your connection.
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-beedero-black">
          One line about you <span className="font-normal text-zinc-500">(optional)</span>
        </span>
        <input
          name="headline"
          defaultValue={state.headline}
          maxLength={200}
          placeholder="Backend engineer, ex-WaveRent"
          className="rounded-xl border-2 border-beedero-border bg-beedero-white px-3 py-2.5 text-sm"
        />
      </label>

      {error && (
        <p role="alert" className="text-sm font-medium text-danger-strong">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-xl bg-beedero-black px-5 py-2.5 text-sm font-bold text-beedero-yellow transition hover:bg-beedero-yellow hover:text-beedero-black disabled:opacity-60"
      >
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
