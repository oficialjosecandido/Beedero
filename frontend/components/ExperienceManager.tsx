"use client";

import { useActionState } from "react";

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

function ExperienceFields({ experience }: { experience?: Experience }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <input
        name="org_name"
        defaultValue={experience?.org_name ?? ""}
        placeholder="Organization"
        required
        className={fieldClass}
      />
      <input
        name="role"
        defaultValue={experience?.role ?? ""}
        placeholder="Role (optional)"
        className={fieldClass}
      />
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
        Started
        <input
          type="date"
          name="started_on"
          defaultValue={experience?.started_on ?? ""}
          required
          className={fieldClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
        Ended <span className="font-normal text-zinc-400">(blank = ongoing)</span>
        <input
          type="date"
          name="ended_on"
          defaultValue={experience?.ended_on ?? ""}
          className={fieldClass}
        />
      </label>
    </div>
  );
}

function ExperienceCard({ experience }: { experience: Experience }) {
  const [error, formAction, pending] = useActionState(updateExperienceAction, null);
  useActionToast(error, pending, { successMessage: "Experience updated." });

  return (
    <div className="rounded-2xl border border-beedero-border bg-zinc-50/50 p-4">
      <form action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="experience_id" value={experience.id} />
        <ExperienceFields experience={experience} />
        <SkillsInput initial={experience.skills ?? []} />
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-lg bg-beedero-yellow px-3 py-1.5 text-xs font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save"}
        </button>
      </form>
      <form action={deleteExperienceAction} className="mt-2">
        <input type="hidden" name="experience_id" value={experience.id} />
        <button type="submit" className="text-xs font-medium text-red-700 hover:underline">
          Remove
        </button>
      </form>
    </div>
  );
}

function AddExperienceForm() {
  const [error, formAction, pending] = useActionState(createExperienceAction, null);
  useActionToast(error, pending, { successMessage: "Experience added." });

  return (
    <form
      action={formAction}
      className="flex flex-col gap-2 rounded-2xl border border-dashed border-beedero-border p-4"
    >
      <ExperienceFields />
      <SkillsInput initial={[]} />
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-beedero-yellow px-3 py-1.5 text-xs font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
      >
        {pending ? "Adding..." : "+ Add experience"}
      </button>
    </form>
  );
}

export function ExperienceManager({ experiences }: { experiences: Experience[] }) {
  return (
    <div className="overflow-hidden rounded-3xl border-2 border-beedero-border bg-beedero-white shadow-sm">
      <div className="border-b border-beedero-border bg-beedero-yellow px-6 py-5">
        <h2 className="text-xl font-extrabold tracking-tight text-zinc-900">Experience</h2>
        <p className="mt-1 max-w-xl text-sm leading-6 text-zinc-600">
          Roles and organizations you&apos;ve worked with that aren&apos;t on Beedero — shown as
          self-declared on your relationship timeline.
        </p>
      </div>
      <div className="flex flex-col gap-4 px-6 py-6">
        {experiences.length === 0 ? (
          <p className="text-sm text-zinc-400">No experience entries yet.</p>
        ) : (
          experiences.map((experience) => <ExperienceCard key={experience.id} experience={experience} />)
        )}
        <AddExperienceForm />
      </div>
    </div>
  );
}
