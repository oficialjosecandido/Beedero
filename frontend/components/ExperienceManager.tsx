"use client";

import { useActionState, useState } from "react";

import {
  createExperienceAction,
  deleteExperienceAction,
  updateExperienceAction,
} from "@/app/(app)/dashboard/experience-actions";
import { useActionToast } from "@/lib/use-action-toast";

import { SkillsInput } from "./ProfileForm";

export type Experience = {
  id: number;
  org_name: string;
  role?: string;
  started_on: string;
  ended_on?: string | null;
  skills?: string[];
};

const fieldClass =
  "w-full rounded-xl border border-beedero-border bg-white px-3 py-2.5 text-sm text-beedero-black outline-none transition-colors focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60";

function formatPeriod(startedOn: string, endedOn?: string | null) {
  const start = startedOn
    ? new Date(startedOn).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
    : "";
  if (!endedOn) return start ? `${start} – Present` : "";
  const end = new Date(endedOn).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  return `${start} – ${end}`;
}

function ExperienceEditFields({ experience }: { experience: Experience }) {
  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
        Organization
        <input
          name="org_name"
          defaultValue={experience.org_name}
          placeholder="Company or organization"
          required
          className={fieldClass}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
        Role <span className="font-normal text-zinc-400">(optional)</span>
        <input
          name="role"
          defaultValue={experience.role ?? ""}
          placeholder="e.g. Founder, Engineer, Advisor"
          className={fieldClass}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
          Started
          <input
            type="date"
            name="started_on"
            defaultValue={experience.started_on}
            required
            className={fieldClass}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
          Ended <span className="font-normal text-zinc-400">(blank = ongoing)</span>
          <input
            type="date"
            name="ended_on"
            defaultValue={experience.ended_on ?? ""}
            className={fieldClass}
          />
        </label>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium text-zinc-700">
          Skills <span className="font-normal text-zinc-400">(optional)</span>
        </p>
        <SkillsInput initial={experience.skills ?? []} />
      </div>
    </div>
  );
}

function ExperienceCard({ experience }: { experience: Experience }) {
  const [editing, setEditing] = useState(false);
  const [error, formAction, pending] = useActionState(updateExperienceAction, null);
  useActionToast(error, pending, {
    successMessage: "Experience updated.",
    onSuccess: () => setEditing(false),
  });

  if (!editing) {
    return (
      <article className="rounded-2xl border border-beedero-border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-base font-extrabold text-zinc-900">{experience.org_name}</p>
            {experience.role && (
              <p className="mt-0.5 text-sm font-medium text-zinc-600">{experience.role}</p>
            )}
            <p className="mt-1 text-xs text-zinc-400">
              {formatPeriod(experience.started_on, experience.ended_on)}
            </p>
            {(experience.skills?.length ?? 0) > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {experience.skills!.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full border border-beedero-border bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 rounded-xl border border-beedero-border px-3 py-2 text-sm font-semibold text-beedero-black transition-colors hover:border-beedero-black hover:bg-beedero-yellow/15"
          >
            Edit
          </button>
        </div>
        <form action={deleteExperienceAction} className="mt-4 border-t border-beedero-border/60 pt-3">
          <input type="hidden" name="experience_id" value={experience.id} />
          <button
            type="submit"
            className="text-sm font-semibold text-red-600 hover:text-red-700 hover:underline"
          >
            Remove
          </button>
        </form>
      </article>
    );
  }

  return (
    <article className="rounded-2xl border-2 border-beedero-black/15 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-extrabold text-zinc-900">Edit experience</h3>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-sm font-semibold text-zinc-500 hover:text-beedero-black"
        >
          Cancel
        </button>
      </div>
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="experience_id" value={experience.id} />
        <ExperienceEditFields experience={experience} />
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-xl bg-beedero-yellow px-4 py-2.5 text-sm font-bold text-beedero-black transition-colors hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save changes"}
        </button>
      </form>
    </article>
  );
}

function AddExperienceForm({ defaultOpen }: { defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [error, formAction, pending] = useActionState(createExperienceAction, null);
  useActionToast(error, pending, {
    successMessage: "Experience added.",
    onSuccess: () => setOpen(false),
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start rounded-xl border border-dashed border-beedero-border px-4 py-2.5 text-sm font-semibold text-beedero-black transition-colors hover:border-beedero-black hover:bg-beedero-yellow/10"
      >
        + Add experience
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5 rounded-2xl border border-beedero-border bg-zinc-50/40 p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-zinc-900">Add experience</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            Roles outside Beedero appear as self-declared on your timeline.
          </p>
        </div>
        {!defaultOpen && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-sm font-semibold text-zinc-500 hover:text-beedero-black"
          >
            Cancel
          </button>
        )}
      </div>
      <ExperienceEditFields
        experience={{
          id: 0,
          org_name: "",
          role: "",
          started_on: "",
          ended_on: null,
          skills: [],
        }}
      />
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-xl bg-beedero-yellow px-4 py-2.5 text-sm font-bold text-beedero-black transition-colors hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
      >
        {pending ? "Adding..." : "Add experience"}
      </button>
    </form>
  );
}

export function ExperienceManager({ experiences }: { experiences: Experience[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border-2 border-beedero-border bg-beedero-white shadow-sm">
      <div className="border-b border-beedero-border bg-beedero-yellow px-5 py-5 sm:px-8">
        <h2 className="text-xl font-extrabold tracking-tight text-zinc-900">Experience</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600">
          Roles and organizations you&apos;ve worked with that aren&apos;t on Beedero — shown as
          self-declared on your relationship timeline.
        </p>
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-8 sm:px-8">
        {experiences.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-beedero-border bg-zinc-50/50 px-5 py-6 text-center">
            <p className="text-sm font-semibold text-zinc-700">No experience yet</p>
            <p className="mt-1 text-sm text-zinc-500">
              Add roles from outside Beedero to complete your timeline.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {experiences.map((experience) => (
              <ExperienceCard key={experience.id} experience={experience} />
            ))}
          </div>
        )}

        <AddExperienceForm defaultOpen={experiences.length === 0} />
      </div>
    </div>
  );
}
