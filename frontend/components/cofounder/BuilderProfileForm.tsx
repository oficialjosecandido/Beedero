"use client";

import { useActionState, useState } from "react";

import { updateBuilderProfileAction } from "@/app/(app)/cofounder/actions";
import {
  COMMITMENT_OPTIONS,
  PROMPT_FIELDS,
  PROMPT_MAX_LENGTH,
  STRENGTH_OPTIONS,
  type BuilderProfile,
  type CofounderStatus,
} from "@/lib/cofounder-options";
import { SECTOR_OPTIONS } from "@/lib/org-filters";
import { useActionToast } from "@/lib/use-action-toast";

const inputClass =
  "rounded-xl border border-beedero-border bg-white px-3 py-2 text-sm text-beedero-black outline-none transition focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60";

function OptionFieldset({
  legend,
  hint,
  name,
  type,
  options,
  selected,
}: {
  legend: string;
  hint?: string;
  name: string;
  type: "radio" | "checkbox";
  options: readonly { value: string; label: string; description?: string }[];
  selected: string[];
}) {
  return (
    <fieldset className="rounded-2xl border border-beedero-border p-4">
      <legend className="px-1 text-sm font-semibold text-zinc-800">{legend}</legend>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            title={option.description}
            className="inline-flex items-center gap-2 rounded-lg border border-beedero-border px-2.5 py-1.5 text-xs font-medium has-[:checked]:border-beedero-black has-[:checked]:bg-beedero-yellow/20"
          >
            <input
              type={type}
              name={name}
              value={option.value}
              defaultChecked={selected.includes(option.value)}
              className="accent-beedero-black"
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function BuilderProfileForm({
  profile,
  status,
}: {
  profile: BuilderProfile | null;
  status: CofounderStatus | null;
}) {
  const [error, formAction, pending] = useActionState(updateBuilderProfileAction, null);
  useActionToast(error, pending, { successMessage: "Builder card saved." });

  const [isActive, setIsActive] = useState(Boolean(profile?.is_active));
  const [hasIdea, setHasIdea] = useState(Boolean(profile?.has_idea));

  return (
    <form
      action={formAction}
      className="overflow-hidden rounded-3xl border-2 border-beedero-border bg-beedero-white shadow-sm"
    >
      <div className="border-b border-beedero-border bg-beedero-yellow px-6 py-5">
        <h2 className="text-xl font-extrabold tracking-tight text-zinc-900">Your builder card</h2>
        <p className="mt-1 max-w-xl text-sm leading-6 text-zinc-700">
          Separate from your public profile, and only shown to other people who are also looking.
          Your skills and location come from your profile — no need to type them twice.
        </p>
      </div>

      <div className="flex flex-col gap-6 px-6 py-6">
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-beedero-border bg-zinc-50/40 px-4 py-3 transition-colors has-[:checked]:border-beedero-black/20 has-[:checked]:bg-beedero-yellow/10">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
            className="mt-0.5 size-4 shrink-0 rounded border-beedero-border accent-beedero-black"
          />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-zinc-800">
              I&apos;m looking for a co-founder
            </span>
            <span className="block text-xs text-subtle">
              Turn this off any time — your card disappears from everyone&apos;s deck immediately.
            </span>
          </span>
        </label>

        <OptionFieldset
          legend="What you bring"
          hint="Pick the one you'd be hired for."
          name="primary_strength"
          type="radio"
          options={STRENGTH_OPTIONS}
          selected={profile?.primary_strength ? [profile.primary_strength] : []}
        />

        <OptionFieldset
          legend="What you're looking for"
          hint="You'll only see builders who bring one of these and are looking for what you bring."
          name="looking_for"
          type="checkbox"
          options={STRENGTH_OPTIONS}
          selected={profile?.looking_for ?? []}
        />

        <OptionFieldset
          legend="How much time you can give"
          name="commitment"
          type="radio"
          options={COMMITMENT_OPTIONS}
          selected={profile?.commitment ? [profile.commitment] : []}
        />

        <OptionFieldset
          legend="Sectors you care about"
          hint="Optional — overlap nudges someone up your deck, it never filters them out."
          name="sectors"
          type="checkbox"
          options={SECTOR_OPTIONS}
          selected={profile?.sectors ?? []}
        />

        <fieldset className="rounded-2xl border border-beedero-border p-4">
          <legend className="px-1 text-sm font-semibold text-zinc-800">An idea already?</legend>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              name="has_idea"
              defaultChecked={hasIdea}
              onChange={(event) => setHasIdea(event.target.checked)}
              className="size-4 rounded border-beedero-border accent-beedero-black"
            />
            I&apos;m already working on something
          </label>
          {hasIdea && (
            <label className="mt-3 flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
              In one or two sentences
              <textarea
                name="idea_pitch"
                rows={2}
                maxLength={280}
                defaultValue={profile?.idea_pitch ?? ""}
                placeholder="What you're building and who it's for."
                className={inputClass}
              />
            </label>
          )}
        </fieldset>

        <fieldset className="rounded-2xl border border-beedero-border p-4">
          <legend className="px-1 text-sm font-semibold text-zinc-800">
            Three questions
          </legend>
          <p className="mt-1 text-xs text-zinc-500">
            This is the part people actually read. Write like you talk.
          </p>
          <div className="mt-3 flex flex-col gap-4">
            {PROMPT_FIELDS.map((field) => (
              <label key={field.key} className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
                {field.label}
                <textarea
                  name={`prompt_${field.key}`}
                  rows={3}
                  maxLength={PROMPT_MAX_LENGTH}
                  defaultValue={profile?.prompts?.[field.key] ?? ""}
                  placeholder={field.placeholder}
                  className={inputClass}
                />
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-beedero-border px-4 py-3">
          <input
            type="checkbox"
            name="adult_confirmed"
            defaultChecked={Boolean(profile?.adult_confirmed)}
            className="mt-0.5 size-4 shrink-0 rounded border-beedero-border accent-beedero-black"
          />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-zinc-800">I&apos;m 18 or over</span>
            <span className="block text-xs text-subtle">
              Required by the Terms for person-to-person matching.
            </span>
          </span>
        </label>

        {status && !status.gate_met && (
          <p className="rounded-2xl bg-zinc-50/70 px-4 py-3 text-xs leading-5 text-zinc-600">
            Co-founder matching is still early{status.market ? ` in ${status.market}` : ""} —{" "}
            {status.active_builders} of {status.threshold} builders so far. You can use it now; it
            just gets considerably better as more people join.
          </p>
        )}
      </div>

      <div className="border-t border-beedero-border bg-zinc-50/80 px-6 py-4">
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-beedero-yellow px-5 py-3 text-sm font-bold text-beedero-black shadow-sm transition-colors hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50 sm:w-auto sm:min-w-[10rem]"
        >
          {pending ? "Saving..." : "Save builder card"}
        </button>
      </div>
    </form>
  );
}
