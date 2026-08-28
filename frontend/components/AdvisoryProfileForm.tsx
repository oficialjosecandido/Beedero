"use client";

import { useActionState, useState } from "react";

import { updateAdvisorProfileAction } from "@/app/(app)/dashboard/advisory-actions";
import { ENGAGEMENT_OPTIONS, EXPERTISE_OPTIONS } from "@/lib/advisory-options";
import { SECTOR_OPTIONS, STAGE_OPTIONS } from "@/lib/org-filters";
import { useActionToast } from "@/lib/use-action-toast";

export type AdvisorProfile = {
  is_available: boolean;
  expertise: string[];
  stages: string[];
  sectors: string[];
  engagement_types: string[];
};

function CheckboxFieldset({
  legend,
  name,
  options,
  selected,
}: {
  legend: string;
  name: string;
  options: readonly { value: string; label: string }[];
  selected: string[];
}) {
  return (
    <fieldset className="rounded-2xl border border-beedero-border p-4">
      <legend className="px-1 text-sm font-semibold text-zinc-800">{legend}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className="inline-flex items-center gap-2 rounded-lg border border-beedero-border px-2.5 py-1.5 text-xs font-medium"
          >
            <input
              type="checkbox"
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

export function AdvisoryProfileForm({ profile }: { profile?: AdvisorProfile | null }) {
  const [error, formAction, pending] = useActionState(updateAdvisorProfileAction, null);
  useActionToast(error, pending, { successMessage: "Advisory preferences updated." });

  const [isAvailable, setIsAvailable] = useState(Boolean(profile?.is_available));

  return (
    <form
      action={formAction}
      className="overflow-hidden rounded-3xl border-2 border-beedero-border bg-beedero-white shadow-sm"
    >
      <div className="border-b border-beedero-border bg-beedero-yellow px-6 py-5">
        <h2 className="text-xl font-extrabold tracking-tight text-zinc-900">Advisory &amp; board</h2>
        <p className="mt-1 max-w-xl text-sm leading-6 text-zinc-600">
          Let organizations know you&apos;re open to advisory, board, or fractional work.
        </p>
      </div>

      <div className="flex flex-col gap-6 px-6 py-6">
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-beedero-border bg-zinc-50/40 px-4 py-3 transition-colors has-[:checked]:border-beedero-black/20 has-[:checked]:bg-beedero-yellow/10">
          <input
            type="checkbox"
            name="is_available"
            defaultChecked={isAvailable}
            onChange={(event) => setIsAvailable(event.target.checked)}
            className="mt-0.5 size-4 shrink-0 rounded border-beedero-border accent-beedero-black"
          />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-zinc-800">
              Open to advisory / board / fractional work
            </span>
            <span className="block text-xs text-subtle">
              Shown in advisor discovery and on your public profile. Toggle off to hide.
            </span>
          </span>
        </label>

        {isAvailable && (
          <div className="flex flex-col gap-4">
            <CheckboxFieldset
              legend="Engagement types"
              name="engagement_types"
              options={ENGAGEMENT_OPTIONS}
              selected={profile?.engagement_types ?? []}
            />
            <CheckboxFieldset
              legend="Expertise"
              name="expertise"
              options={EXPERTISE_OPTIONS}
              selected={profile?.expertise ?? []}
            />
            <CheckboxFieldset
              legend="Stages"
              name="stages"
              options={STAGE_OPTIONS}
              selected={profile?.stages ?? []}
            />
            <CheckboxFieldset
              legend="Sectors"
              name="sectors"
              options={SECTOR_OPTIONS}
              selected={profile?.sectors ?? []}
            />
          </div>
        )}
      </div>

      <div className="border-t border-beedero-border bg-zinc-50/80 px-6 py-4">
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-beedero-yellow px-5 py-3 text-sm font-bold text-beedero-black shadow-sm transition-colors hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50 sm:w-auto sm:min-w-[10rem]"
        >
          {pending ? "Saving..." : "Save advisory preferences"}
        </button>
      </div>
    </form>
  );
}
