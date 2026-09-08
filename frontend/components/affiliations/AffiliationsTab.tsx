"use client";

import { useActionState, useEffect, useState, useTransition } from "react";

import {
  addTeamMemberAction,
  confirmAffiliationAction,
  disputeAffiliationAction,
} from "@/app/(app)/dashboard/affiliation-actions";
import { EmptyState } from "@/components/EmptyState";
import { affiliationStatusLabel, roleTypeLabel } from "@/lib/affiliation-options";
import { formatDate } from "@/lib/format";
import { formatAtHandle } from "@/lib/handles";
import type { AffiliationSummary } from "@/lib/types";
import { useActionToast } from "@/lib/use-action-toast";

const fieldClass =
  "w-full rounded-xl border border-beedero-border bg-white px-3 py-2.5 text-sm text-beedero-black outline-none transition-colors focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60";

type PersonMatch = {
  handle: string;
  name: string;
  avatar?: string | null;
};

function normalizeUsername(value: string) {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

function PersonAvatar({ name, avatar }: { name: string; avatar?: string | null }) {
  if (avatar) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatar} alt="" className="size-10 shrink-0 rounded-full object-cover ring-1 ring-beedero-border" />;
  }
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-500 ring-1 ring-beedero-border">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function UsernameField() {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<PersonMatch[]>([]);
  const [selected, setSelected] = useState<PersonMatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const normalized = normalizeUsername(query);
    if (normalized.length < 2) {
      setMatches([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      fetch(`/api/mentions/search?q=${encodeURIComponent(normalized)}`, {
        signal: controller.signal,
        cache: "no-store",
      })
        .then((res) => (res.ok ? (res.json() as Promise<{ users?: PersonMatch[] }>) : null))
        .then((data) => {
          const users = data?.users ?? [];
          setMatches(users);
          const exact = users.find((user) => user.handle.toLowerCase() === normalized) ?? null;
          setSelected((current) => {
            if (current && current.handle.toLowerCase() === normalized) return current;
            return exact;
          });
          setMenuOpen(true);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  function selectPerson(person: PersonMatch) {
    setSelected(person);
    setQuery(person.handle);
    setMenuOpen(false);
  }

  return (
    <div className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
      <label htmlFor="team-member-username">Username</label>
      <div className="relative">
        <input
          id="team-member-username"
          name="handle"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(null);
            setMenuOpen(true);
          }}
          onFocus={() => setMenuOpen(true)}
          onBlur={() => window.setTimeout(() => setMenuOpen(false), 150)}
          placeholder="e.g. josevcandido"
          required
          autoComplete="off"
          className={fieldClass}
        />
        {menuOpen && normalizeUsername(query).length >= 2 && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-beedero-border bg-white shadow-lg">
            {loading && <p className="px-3 py-2 text-xs text-zinc-500">Searching…</p>}
            {!loading && matches.length === 0 && (
              <p className="px-3 py-2 text-xs text-zinc-500">No people found with that username.</p>
            )}
            {!loading &&
              matches.map((person) => (
                <button
                  key={person.handle}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectPerson(person)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-beedero-yellow/20"
                >
                  <PersonAvatar name={person.name} avatar={person.avatar} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-zinc-900">{person.name}</span>
                    <span className="block truncate text-xs text-zinc-500">
                      {formatAtHandle(person.handle)}
                    </span>
                  </span>
                </button>
              ))}
          </div>
        )}
      </div>
      <span className="text-xs font-normal text-subtle">
        Type their Beedero username to confirm you have the right person.
      </span>
      {selected && (
        <div className="mt-1 flex items-center gap-3 rounded-xl border border-beedero-border bg-white px-3 py-2.5">
          <PersonAvatar name={selected.name} avatar={selected.avatar} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-900">{selected.name}</p>
            <p className="truncate text-xs text-zinc-500">{formatAtHandle(selected.handle)}</p>
          </div>
          <span className="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            Matched
          </span>
        </div>
      )}
    </div>
  );
}

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

function affiliationRoleLabel(affiliation: AffiliationSummary) {
  const title = affiliation.title?.trim();
  if (title) return title;
  return roleTypeLabel(affiliation.role);
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
            {affiliationRoleLabel(affiliation)}
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
          {affiliationRoleLabel(affiliation)} · Since {formatDate(affiliation.started_on)}
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
      <UsernameField />
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
        Role
        <input
          name="title"
          required
          maxLength={100}
          placeholder="e.g. Senior Engineer"
          className={fieldClass}
        />
        <span className="text-xs font-normal text-subtle">Free text, max 100 characters.</span>
      </label>
      <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
          <span className="min-h-10">Started</span>
          <input type="date" name="started_on" required className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
          <span className="min-h-10">
            Ended{" "}
            <span className="font-normal text-subtle">(blank = ongoing)</span>
          </span>
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
