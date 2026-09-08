"use client";

import { useActionState, useState } from "react";

import {
  createExperienceOrAffiliationAction,
  deleteExperienceAction,
  updateExperienceAction,
} from "@/app/(app)/dashboard/experience-actions";
import { withdrawAffiliationAction } from "@/app/(app)/dashboard/affiliation-actions";
import { affiliationStatusLabel, ROLE_TYPE_OPTIONS, roleTypeLabel } from "@/lib/affiliation-options";
import type { AffiliationSummary, OrgSummary } from "@/lib/types";
import { useActionToast } from "@/lib/use-action-toast";

import { OrgAutocomplete } from "./OrgAutocomplete";
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
        Role <span className="font-normal text-subtle">(optional)</span>
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
          Ended <span className="font-normal text-subtle">(blank = ongoing)</span>
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
          Skills <span className="font-normal text-subtle">(optional)</span>
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
  const [deleteError, deleteAction, deletePending] = useActionState(deleteExperienceAction, null);
  useActionToast(deleteError, deletePending, { successMessage: "Experience removed." });

  if (!editing) {
    return (
      <article className="rounded-2xl border border-beedero-border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-base font-extrabold text-zinc-900">{experience.org_name}</p>
            {experience.role && (
              <p className="mt-0.5 text-sm font-medium text-zinc-600">{experience.role}</p>
            )}
            <p className="mt-1 text-xs text-subtle">
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
        <form
          action={deleteAction}
          className="mt-4 border-t border-beedero-border/60 pt-3"
          onSubmit={(event) => {
            if (!window.confirm("Remove this experience? This cannot be undone.")) event.preventDefault();
          }}
        >
          <input type="hidden" name="experience_id" value={experience.id} />
          <button
            type="submit"
            disabled={deletePending}
            className="text-sm font-semibold text-danger hover:text-danger-strong hover:underline disabled:opacity-50"
          >
            {deletePending ? "Removing…" : "Remove"}
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

const AFFILIATION_STATUS_STYLES: Record<AffiliationSummary["status"], string> = {
  self_declared: "bg-zinc-200 text-zinc-600",
  pending: "bg-beedero-yellow text-beedero-black",
  verified: "bg-emerald-600 text-white",
  disputed: "bg-red-100 text-danger-strong",
};

function affiliationStatusText(affiliation: AffiliationSummary) {
  if (affiliation.status === "verified") {
    return affiliation.verified_via === "registry" ? "Verified via registry" : "Verified by company";
  }
  return affiliationStatusLabel(affiliation.status);
}

function AffiliationCard({ affiliation }: { affiliation: AffiliationSummary }) {
  const [error, deleteAction, pending] = useActionState(withdrawAffiliationAction, null);
  useActionToast(error, pending, { successMessage: "Affiliation withdrawn." });
  const canWithdraw = affiliation.status !== "verified";

  return (
    <article className="rounded-2xl border border-beedero-border bg-white p-5 shadow-sm">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-base font-extrabold text-zinc-900">{affiliation.org.name}</p>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${AFFILIATION_STATUS_STYLES[affiliation.status]}`}
          >
            {affiliationStatusText(affiliation)}
          </span>
        </div>
        <p className="mt-0.5 text-sm font-medium text-zinc-600">
          {roleTypeLabel(affiliation.role)}
          {affiliation.title ? ` · ${affiliation.title}` : ""}
        </p>
        <p className="mt-1 text-xs text-subtle">
          {formatPeriod(affiliation.started_on, affiliation.ended_on)}
        </p>
        {affiliation.skills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {affiliation.skills.map((skill) => (
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
      {canWithdraw && (
        <form
          action={deleteAction}
          className="mt-4 border-t border-beedero-border/60 pt-3"
          onSubmit={(event) => {
            if (!window.confirm("Withdraw this affiliation? This cannot be undone.")) event.preventDefault();
          }}
        >
          <input type="hidden" name="affiliation_id" value={affiliation.id} />
          <button
            type="submit"
            disabled={pending}
            className="text-sm font-semibold text-danger hover:text-danger-strong hover:underline disabled:opacity-50"
          >
            {pending ? "Withdrawing…" : "Withdraw"}
          </button>
        </form>
      )}
    </article>
  );
}

function AddExperienceForm({ defaultOpen }: { defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [selectedOrg, setSelectedOrg] = useState<OrgSummary | null>(null);
  const [role, setRole] = useState("");
  const [error, formAction, pending] = useActionState(createExperienceOrAffiliationAction, null);
  useActionToast(error, pending, {
    successMessage: "Experience added.",
    onSuccess: () => {
      setOpen(false);
      setSelectedOrg(null);
      setRole("");
    },
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
            Pick a real Beedero organization for a verifiable affiliation — anything else is saved as
            self-declared.
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

      <input type="hidden" name="org_slug" value={selectedOrg?.slug ?? ""} />

      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
        Organization
        <OrgAutocomplete
          name="org_name"
          placeholder="Company or organization"
          onSelect={(org) => {
            setSelectedOrg(org);
            setRole("");
          }}
        />
      </label>

      {selectedOrg ? (
        <>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
            Role
            <select
              name="role"
              required
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className={fieldClass}
            >
              <option value="" disabled>
                Select a role
              </option>
              {ROLE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
            Title <span className="font-normal text-subtle">(optional)</span>
            <input name="title" placeholder="e.g. Senior Engineer" className={fieldClass} />
          </label>
          <p className="rounded-xl bg-beedero-yellow/15 px-3 py-2.5 text-xs leading-5 text-zinc-700">
            {role === "founder"
              ? "Founder status is verified via your company's registry certificate — it'll show as self-declared until then."
              : `${selectedOrg.name} will need to confirm this affiliation before it's marked verified.`}
          </p>
        </>
      ) : (
        <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
          Role <span className="font-normal text-subtle">(optional)</span>
          <input name="role" placeholder="e.g. Founder, Engineer, Advisor" className={fieldClass} />
        </label>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
          Started
          <input type="date" name="started_on" required className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
          Ended <span className="font-normal text-subtle">(blank = ongoing)</span>
          <input type="date" name="ended_on" className={fieldClass} />
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium text-zinc-700">
          Skills <span className="font-normal text-subtle">(optional)</span>
        </p>
        <SkillsInput initial={[]} />
      </div>

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

type ExperienceListItem =
  | { kind: "experience"; startedOn: string; experience: Experience }
  | { kind: "affiliation"; startedOn: string; affiliation: AffiliationSummary };

export function ExperienceManager({
  experiences,
  affiliations,
}: {
  experiences: Experience[];
  affiliations: AffiliationSummary[];
}) {
  const items: ExperienceListItem[] = [
    ...experiences.map((experience): ExperienceListItem => ({
      kind: "experience",
      startedOn: experience.started_on,
      experience,
    })),
    ...affiliations.map((affiliation): ExperienceListItem => ({
      kind: "affiliation",
      startedOn: affiliation.started_on,
      affiliation,
    })),
  ].sort((a, b) => (a.startedOn < b.startedOn ? 1 : a.startedOn > b.startedOn ? -1 : 0));

  return (
    <div className="overflow-hidden rounded-3xl border-2 border-beedero-border bg-beedero-white shadow-sm">
      <div className="border-b border-beedero-border bg-beedero-yellow px-5 py-5 sm:px-8">
        <h2 className="text-xl font-extrabold tracking-tight text-zinc-900">Experience</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600">
          Roles and organizations you&apos;ve worked with — pick a real Beedero org for a verifiable
          affiliation, or add anything else as self-declared.
        </p>
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-5 py-8 sm:px-8">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-beedero-border bg-zinc-50/50 px-5 py-6 text-center">
            <p className="text-sm font-semibold text-zinc-700">No experience yet</p>
            <p className="mt-1 text-sm text-zinc-500">
              Add roles from outside Beedero to complete your timeline.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {items.map((item) =>
              item.kind === "experience" ? (
                <ExperienceCard key={`experience-${item.experience.id}`} experience={item.experience} />
              ) : (
                <AffiliationCard key={`affiliation-${item.affiliation.id}`} affiliation={item.affiliation} />
              )
            )}
          </div>
        )}

        <AddExperienceForm defaultOpen={items.length === 0} />
      </div>
    </div>
  );
}
