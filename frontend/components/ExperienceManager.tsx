"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BriefcaseBusiness,
  Globe2,
  GraduationCap,
  Landmark,
  Pencil,
  Plus,
  UsersRound,
  X,
  type LucideIcon,
} from "lucide-react";

import {
  acceptAffiliationAction,
  withdrawAffiliationAction,
  withdrawAffiliationByIdAction,
} from "@/app/(app)/dashboard/affiliation-actions";
import {
  createExperienceOrAffiliationAction,
  deleteExperienceAction,
  updateExperienceAction,
} from "@/app/(app)/dashboard/experience-actions";
import { btnPrimary, inputDark, labelDark } from "@/components/app-shell/ui";
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

/** The design's record icons, mapped onto this platform's role types. */
const ROLE_ICONS: Record<string, LucideIcon> = {
  founder: Landmark,
  employee: BriefcaseBusiness,
  contractor: Globe2,
  volunteer: UsersRound,
  advisor: GraduationCap,
};

/**
 * Filter chips. Role types come from affiliations; free-text experiences have
 * no role type, so they get their own chip instead of disappearing.
 */
const SELF_DECLARED = "self_declared";
const FILTERS = [
  { value: "all", label: "All" },
  ...ROLE_TYPE_OPTIONS.map((option) => ({ value: option.value as string, label: option.label })),
  { value: SELF_DECLARED, label: "Self-declared" },
];

const STATUS_STYLES: Record<AffiliationSummary["status"], string> = {
  verified: "border-emerald-400/45 text-emerald-400",
  pending: "border-sky-300/45 text-sky-300",
  self_declared: "border-white/20 text-white/55",
  disputed: "border-red-400/45 text-red-300",
};

function chipClass(active: boolean) {
  return `border px-3 py-1.5 text-[11px] font-bold transition ${
    active
      ? "border-beedero-yellow bg-beedero-yellow text-beedero-black"
      : "border-white/15 text-white/55 hover:border-white/30 hover:text-white"
  }`;
}

const iconButtonClass =
  "grid size-7 shrink-0 place-items-center border border-white/10 text-white/45 transition hover:border-beedero-yellow hover:text-beedero-yellow";

function formatPeriod(startedOn: string, endedOn?: string | null) {
  const start = startedOn
    ? new Date(startedOn).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
    : "";
  if (!endedOn) return start ? `${start} – Present` : "";
  const end = new Date(endedOn).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  return `${start} – ${end}`;
}

function affiliationStatusText(affiliation: AffiliationSummary) {
  if (affiliation.status === "verified") {
    return affiliation.verified_via === "registry" ? "Verified · registry" : "Verified · company";
  }
  return affiliationStatusLabel(affiliation.status);
}

function SkillChips({ skills }: { skills: string[] }) {
  if (skills.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {skills.map((skill) => (
        <span key={skill} className="border border-white/15 px-2 py-1 text-[10px] text-white/55">
          {skill}
        </span>
      ))}
    </div>
  );
}

function StatusChip({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`shrink-0 border px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] ${className}`}
    >
      {label}
    </span>
  );
}

/**
 * One timeline row. `isLast` drives both the connector line and the divider —
 * CSS `:last-child` can't see either, since every row renders the same shape.
 */
function RecordRow({
  icon: Icon,
  isLast,
  children,
}: {
  icon: LucideIcon;
  isLast: boolean;
  children: React.ReactNode;
}) {
  return (
    <article className={`grid grid-cols-[28px_1fr] gap-4 ${isLast ? "" : "pb-8"}`}>
      <span
        aria-hidden
        className={`grid size-7 place-items-center bg-[#252a34] text-beedero-yellow ${
          isLast ? "" : "record-line"
        }`}
      >
        <Icon size={14} />
      </span>
      <div className={`min-w-0 ${isLast ? "" : "border-b border-white/[0.08] pb-8"}`}>
        {children}
      </div>
    </article>
  );
}

function ExperienceFields({ experience }: { experience?: Experience }) {
  return (
    <>
      <label className={`sm:col-span-2 ${labelDark}`}>
        Organisation
        <input
          name="org_name"
          defaultValue={experience?.org_name}
          placeholder="Company or organisation"
          required
          className={`mt-2 ${inputDark} placeholder:text-white/35`}
        />
      </label>
      <label className={`sm:col-span-2 ${labelDark}`}>
        Role <span className="normal-case tracking-normal text-white/25">(optional)</span>
        <input
          name="role"
          defaultValue={experience?.role ?? ""}
          placeholder="e.g. Founder, Engineer, Advisor"
          className={`mt-2 ${inputDark} placeholder:text-white/35`}
        />
      </label>
      <label className={labelDark}>
        Started
        <input
          type="date"
          name="started_on"
          defaultValue={experience?.started_on}
          required
          className={`mt-2 ${inputDark}`}
        />
      </label>
      <label className={labelDark}>
        Ended <span className="normal-case tracking-normal text-white/25">(blank = ongoing)</span>
        <input
          type="date"
          name="ended_on"
          defaultValue={experience?.ended_on ?? ""}
          className={`mt-2 ${inputDark}`}
        />
      </label>
      <div className="sm:col-span-2">
        <p className={labelDark}>
          Skills <span className="normal-case tracking-normal text-white/25">(optional)</span>
        </p>
        <div className="mt-2">
          <SkillsInput initial={experience?.skills ?? []} dark />
        </div>
      </div>
    </>
  );
}

function ExperienceRecord({ experience, isLast }: { experience: Experience; isLast: boolean }) {
  const [editing, setEditing] = useState(false);
  const [error, formAction, pending] = useActionState(updateExperienceAction, null);
  useActionToast(error, pending, {
    successMessage: "Experience updated.",
    onSuccess: () => setEditing(false),
  });
  const [deleteError, deleteAction, deletePending] = useActionState(deleteExperienceAction, null);
  useActionToast(deleteError, deletePending, { successMessage: "Experience removed." });

  if (editing) {
    return (
      <RecordRow icon={BriefcaseBusiness} isLast={isLast}>
        <form action={formAction} className="border border-white/15 bg-white/[0.02] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-sm font-black tracking-[-0.02em]">Edit experience</h3>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-white/45 transition hover:text-white"
              aria-label="Cancel editing"
            >
              <X size={16} aria-hidden />
            </button>
          </div>
          <input type="hidden" name="experience_id" value={experience.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <ExperienceFields experience={experience} />
          </div>
          <button type="submit" disabled={pending} className={`${btnPrimary} mt-4`}>
            {pending ? "Saving…" : "Save changes"}
          </button>
        </form>
      </RecordRow>
    );
  }

  return (
    <RecordRow icon={BriefcaseBusiness} isLast={isLast}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35">
            Self-declared · {formatPeriod(experience.started_on, experience.ended_on)}
          </p>
          <h3 className="mt-1 text-base font-bold">{experience.role || experience.org_name}</h3>
          {experience.role && <p className="mt-1 text-sm text-white/55">{experience.org_name}</p>}
        </div>
        <div className="flex items-center gap-2">
          <StatusChip label="Self-declared" className={STATUS_STYLES.self_declared} />
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={iconButtonClass}
            aria-label={`Edit ${experience.role || experience.org_name}`}
          >
            <Pencil size={12} aria-hidden />
          </button>
        </div>
      </div>
      <SkillChips skills={experience.skills ?? []} />
      <form
        action={deleteAction}
        className="mt-3"
        onSubmit={(event) => {
          if (!window.confirm("Remove this experience? This cannot be undone.")) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="experience_id" value={experience.id} />
        <button
          type="submit"
          disabled={deletePending}
          className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/35 transition hover:text-red-300 disabled:opacity-50"
        >
          {deletePending ? "Removing…" : "Remove"}
        </button>
      </form>
    </RecordRow>
  );
}

function AffiliationRecord({
  affiliation,
  isLast,
}: {
  affiliation: AffiliationSummary;
  isLast: boolean;
}) {
  const router = useRouter();
  const [error, deleteAction, pending] = useActionState(withdrawAffiliationAction, null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  useActionToast(error, pending, { successMessage: "Affiliation withdrawn." });
  const canWithdraw = affiliation.status !== "verified";
  const canAccept = affiliation.status === "pending" && affiliation.is_org_added;

  function accept() {
    startTransition(async () => {
      const result = await acceptAffiliationAction(affiliation.id);
      if ("error" in result) {
        setActionError(result.error);
        return;
      }
      setActionError(null);
      router.refresh();
    });
  }

  function withdrawById() {
    if (!window.confirm("Withdraw this affiliation? This cannot be undone.")) return;
    startTransition(async () => {
      const result = await withdrawAffiliationByIdAction(affiliation.id);
      if ("error" in result) {
        setActionError(result.error);
        return;
      }
      setActionError(null);
      router.refresh();
    });
  }

  return (
    <RecordRow icon={ROLE_ICONS[affiliation.role] ?? BriefcaseBusiness} isLast={isLast}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35">
            {roleTypeLabel(affiliation.role)} ·{" "}
            {formatPeriod(affiliation.started_on, affiliation.ended_on)}
          </p>
          <h3 className="mt-1 text-base font-bold">
            {affiliation.title || roleTypeLabel(affiliation.role)}
          </h3>
          <p className="mt-1 text-sm text-white/55">{affiliation.org.name}</p>
        </div>
        <StatusChip
          label={affiliationStatusText(affiliation)}
          className={STATUS_STYLES[affiliation.status]}
        />
      </div>
      <SkillChips skills={affiliation.skills} />

      {(canAccept || canWithdraw) && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {canAccept ? (
            <>
              <button
                type="button"
                disabled={isPending}
                onClick={accept}
                className="bg-beedero-yellow px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.1em] text-beedero-black transition hover:opacity-90 disabled:opacity-50"
              >
                {isPending ? "…" : "Accept"}
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={withdrawById}
                className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/35 transition hover:text-red-300 disabled:opacity-50"
              >
                Withdraw
              </button>
            </>
          ) : (
            <form
              action={deleteAction}
              onSubmit={(event) => {
                if (!window.confirm("Withdraw this affiliation? This cannot be undone.")) {
                  event.preventDefault();
                }
              }}
            >
              <input type="hidden" name="affiliation_id" value={affiliation.id} />
              <button
                type="submit"
                disabled={pending}
                className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/35 transition hover:text-red-300 disabled:opacity-50"
              >
                {pending ? "Withdrawing…" : "Withdraw"}
              </button>
            </form>
          )}
          {actionError && <p className="text-xs text-red-300">{actionError}</p>}
        </div>
      )}
    </RecordRow>
  );
}

function AddExperienceForm({ onClose }: { onClose: () => void }) {
  const [selectedOrg, setSelectedOrg] = useState<OrgSummary | null>(null);
  const [role, setRole] = useState("");
  const [error, formAction, pending] = useActionState(createExperienceOrAffiliationAction, null);
  useActionToast(error, pending, { successMessage: "Experience added.", onSuccess: onClose });

  return (
    <form action={formAction} className="mt-6 border border-white/15 bg-white/[0.02] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black tracking-[-0.02em]">Add experience</h3>
          <p className="mt-1 max-w-md text-xs leading-5 text-white/45">
            Pick a real Beedero organisation for a verifiable affiliation — anything else is saved
            as self-declared.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-white/45 transition hover:text-white"
          aria-label="Close"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      <input type="hidden" name="org_slug" value={selectedOrg?.slug ?? ""} />

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className={`sm:col-span-2 ${labelDark}`}>
          Organisation
          <div className="mt-2">
            <OrgAutocomplete
              name="org_name"
              placeholder="Company or organisation"
              dark
              onSelect={(org) => {
                setSelectedOrg(org);
                setRole("");
              }}
            />
          </div>
        </label>

        {selectedOrg ? (
          <>
            <label className={labelDark}>
              Role
              <select
                name="role"
                required
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className={`mt-2 ${inputDark} bg-app-elevated`}
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
            <label className={labelDark}>
              Title <span className="normal-case tracking-normal text-white/25">(optional)</span>
              <input
                name="title"
                placeholder="e.g. Senior Engineer"
                className={`mt-2 ${inputDark} placeholder:text-white/35`}
              />
            </label>
            <p className="sm:col-span-2 border-l-2 border-beedero-yellow pl-3 text-xs leading-5 text-white/55">
              {role === "founder"
                ? "Founder status is verified via your company's registry certificate — it stays self-declared until then."
                : `${selectedOrg.name} will need to confirm this affiliation before it is marked verified.`}
            </p>
          </>
        ) : (
          <label className={`sm:col-span-2 ${labelDark}`}>
            Role <span className="normal-case tracking-normal text-white/25">(optional)</span>
            <input
              name="role"
              placeholder="e.g. Founder, Engineer, Advisor"
              className={`mt-2 ${inputDark} placeholder:text-white/35`}
            />
          </label>
        )}

        <label className={labelDark}>
          Started
          <input type="date" name="started_on" required className={`mt-2 ${inputDark}`} />
        </label>
        <label className={labelDark}>
          Ended <span className="normal-case tracking-normal text-white/25">(blank = ongoing)</span>
          <input type="date" name="ended_on" className={`mt-2 ${inputDark}`} />
        </label>

        <div className="sm:col-span-2">
          <p className={labelDark}>
            Skills <span className="normal-case tracking-normal text-white/25">(optional)</span>
          </p>
          <div className="mt-2">
            <SkillsInput initial={[]} dark />
          </div>
        </div>
      </div>

      <button type="submit" disabled={pending} className={`${btnPrimary} mt-5`}>
        {pending ? "Adding…" : "Add experience"}
      </button>
    </form>
  );
}

type ExperienceListItem =
  | { kind: "experience"; startedOn: string; type: string; experience: Experience }
  | { kind: "affiliation"; startedOn: string; type: string; affiliation: AffiliationSummary };

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
      type: SELF_DECLARED,
      experience,
    })),
    ...affiliations.map((affiliation): ExperienceListItem => ({
      kind: "affiliation",
      startedOn: affiliation.started_on,
      type: affiliation.role,
      affiliation,
    })),
  ].sort((a, b) => (a.startedOn < b.startedOn ? 1 : a.startedOn > b.startedOn ? -1 : 0));

  const [activeFilter, setActiveFilter] = useState("all");
  const [adding, setAdding] = useState(items.length === 0);
  const visible = activeFilter === "all" ? items : items.filter((item) => item.type === activeFilter);

  return (
    <section className="border border-white/10 bg-white/[0.025] p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-beedero-yellow">
            Professional record
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.045em]">Experience.</h2>
        </div>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className={btnPrimary}>
            <Plus size={14} aria-hidden /> Add experience
          </button>
        )}
      </div>

      {items.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setActiveFilter(filter.value)}
              className={chipClass(activeFilter === filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}

      {adding && <AddExperienceForm onClose={() => setAdding(false)} />}

      {items.length === 0 ? null : visible.length === 0 ? (
        <p className="mt-7 border border-dashed border-white/15 p-8 text-center text-sm text-white/45">
          Nothing filed under this filter yet.
        </p>
      ) : (
        <div className="mt-7">
          {visible.map((item, index) => {
            const isLast = index === visible.length - 1;
            return item.kind === "experience" ? (
              <ExperienceRecord
                key={`experience-${item.experience.id}`}
                experience={item.experience}
                isLast={isLast}
              />
            ) : (
              <AffiliationRecord
                key={`affiliation-${item.affiliation.id}`}
                affiliation={item.affiliation}
                isLast={isLast}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
