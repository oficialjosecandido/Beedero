"use client";

import { useActionState, useState, useTransition } from "react";

import {
  addTeamMemberAction,
  confirmAffiliationAction,
  disputeAffiliationAction,
} from "@/app/(app)/dashboard/affiliation-actions";
import { EmptyState } from "@/components/EmptyState";
import { affiliationStatusLabel, ROLE_TYPE_OPTIONS, roleTypeLabel } from "@/lib/affiliation-options";
import { formatDate } from "@/lib/format";
import type { AffiliationSummary } from "@/lib/types";
import { useActionToast } from "@/lib/use-action-toast";

const fieldClass =
  "w-full rounded-xl border border-beedero-border bg-white px-3 py-2.5 text-sm text-beedero-black outline-none transition-colors focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60";

const STATUS_STYLES: Record<AffiliationSummary["status"], string> = {
  self_declared: "bg-zinc-200 text-zinc-600",
  pending: "bg-beedero-yellow text-beedero-black",
  verified: "bg-emerald-600 text-white",
  disputed: "bg-red-100 text-danger-strong",
};

function statusText(affiliation: AffiliationSummary) {
  if (affiliation.status === "verified") {
    return affiliation.verified_via === "registry" ? "Verified via registry" : "Verified by company";
  }
  return affiliationStatusLabel(affiliation.status);
}

function PendingRow({
  slug,
  affiliation,
  onResolved,
}: {
  slug: string;
  affiliation: AffiliationSummary;
  onResolved: (id: number, status: AffiliationSummary["status"]) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handle(
    action: typeof confirmAffiliationAction | typeof disputeAffiliationAction,
    status: AffiliationSummary["status"]
  ) {
    startTransition(async () => {
      const result = await action(slug, affiliation.id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setError(null);
      onResolved(affiliation.id, status);
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-beedero-border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium text-zinc-950">{affiliation.person.name}</p>
          <p className="text-xs text-zinc-500">
            {roleTypeLabel(affiliation.role)}
            {affiliation.title ? ` · ${affiliation.title}` : ""}
          </p>
        </div>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">
          Since {formatDate(affiliation.started_on)}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => handle(confirmAffiliationAction, "verified")}
          className="rounded-lg bg-beedero-yellow px-2.5 py-1.5 text-xs font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Confirm
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => handle(disputeAffiliationAction, "disputed")}
          className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-danger-strong hover:bg-danger-surface disabled:cursor-not-allowed disabled:opacity-50"
        >
          Dispute
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

function TeamRow({ affiliation }: { affiliation: AffiliationSummary }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-beedero-border p-3 text-sm">
      <div>
        <p className="font-medium text-zinc-950">{affiliation.person.name}</p>
        <p className="text-xs text-zinc-500">
          {roleTypeLabel(affiliation.role)}
          {affiliation.title ? ` · ${affiliation.title}` : ""} · Since {formatDate(affiliation.started_on)}
        </p>
      </div>
      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLES[affiliation.status]}`}>
        {statusText(affiliation)}
      </span>
    </div>
  );
}

function AddTeamMemberForm({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [error, formAction, pending] = useActionState(addTeamMemberAction, null);
  useActionToast(error, pending, {
    successMessage: "Team member added.",
    onSuccess: () => setOpen(false),
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start rounded-xl border border-dashed border-beedero-border px-4 py-2.5 text-sm font-semibold text-beedero-black transition-colors hover:border-beedero-black hover:bg-beedero-yellow/10"
      >
        + Add team member
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-2xl border border-beedero-border bg-zinc-50/40 p-4"
    >
      <input type="hidden" name="slug" value={slug} />
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-extrabold text-zinc-900">Add team member</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm font-semibold text-zinc-500 hover:text-beedero-black"
        >
          Cancel
        </button>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
        Handle
        <input name="handle" placeholder="their-handle" required className={fieldClass} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
        Role
        <select name="role" required defaultValue="" className={fieldClass}>
          <option value="" disabled>
            Select a role
          </option>
          {ROLE_TYPE_OPTIONS.filter((option) => option.value !== "founder").map((option) => (
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
      <p className="text-xs text-zinc-500">
        They&apos;ll need to accept before this is marked verified. Founder status can only be
        self-declared by the person, never added by the org.
      </p>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-xl bg-beedero-yellow px-4 py-2.5 text-sm font-bold text-beedero-black transition-colors hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
      >
        {pending ? "Adding..." : "Add team member"}
      </button>
    </form>
  );
}

export function AffiliationsTab({
  slug,
  affiliations: initialAffiliations,
  canManage,
}: {
  slug: string;
  affiliations: AffiliationSummary[];
  canManage: boolean;
}) {
  const [affiliations, setAffiliations] = useState(initialAffiliations);

  if (!canManage) {
    return (
      <EmptyState
        title="Affiliations"
        description="Affiliation management is only available to organization owners and admins."
      />
    );
  }

  function handleResolved(id: number, status: AffiliationSummary["status"]) {
    setAffiliations((prev) => prev.map((item) => (item.id === id ? { ...item, status } : item)));
  }

  const pending = affiliations.filter((item) => item.status === "pending" && !item.is_org_added);

  return (
    <div className="flex flex-col gap-6">
      {pending.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-zinc-500">
            Pending confirmation
          </h3>
          {pending.map((affiliation) => (
            <PendingRow
              key={affiliation.id}
              slug={slug}
              affiliation={affiliation}
              onResolved={handleResolved}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-extrabold uppercase tracking-[0.14em] text-zinc-500">
          Affiliations
        </h3>
        {affiliations.length === 0 ? (
          <EmptyState
            title="No affiliations yet"
            description="Add a team member or wait for people to declare their affiliation with your org."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {affiliations.map((affiliation) => (
              <TeamRow key={affiliation.id} affiliation={affiliation} />
            ))}
          </div>
        )}
      </div>

      <AddTeamMemberForm slug={slug} />
    </div>
  );
}
