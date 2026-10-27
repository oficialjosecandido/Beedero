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
import {
  updateAffiliationDetailsAction,
  updateMyMembershipDetailsAction,
} from "@/app/(app)/dashboard/membership-actions";
import { btnPrimary, inputDark, labelDark } from "@/components/app-shell/ui";
import { DateInput } from "@/components/DateInput";
import { affiliationStatusLabel, ROLE_TYPE_OPTIONS, roleTypeLabel } from "@/lib/affiliation-options";
import {
  aggregateSkillTime,
  recordDuration,
  type AggregatedSkillTime,
} from "@/lib/skill-duration";
import type { AffiliationSummary, OrgSummary } from "@/lib/types";
import { useActionToast } from "@/lib/use-action-toast";

import { OrgAutocomplete } from "./OrgAutocomplete";
import { SkillsInput } from "./profile/fields";

export type Experience = {
  id: number;
  kind?: "work" | "education";
  org_name: string;
  role?: string;
  description?: string;
  started_on: string;
  ended_on?: string | null;
  skills?: string[];
};

/** Platform OrgMembership — roster fact; details may await org re-confirmation. */
export type OrgMembershipExperience = {
  id: number;
  org: string;
  orgName: string;
  orgLogo?: string | null;
  orgStatus?: string;
  role: string;
  roleLabel?: string;
  title?: string;
  description?: string;
  started_on: string;
  ended_on?: string | null;
  details_status?: "confirmed" | "pending";
  /** Someone other than this member confirmed the details — the only thing
   *  that earns the verified badge (backend: OrgMembership.attested_by_other). */
  attestedByOther?: boolean;
  skills: { id: number; skill: string; status: string }[];
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
 * Filter chips match the Figma professional-record categories. Platform role
 * types are grouped underneath (e.g. founder + employee → Work).
 */
const SELF_DECLARED = "self_declared";
const FILTERS: { value: string; label: string; types: string[] }[] = [
  { value: "all", label: "All", types: [] },
  { value: "work", label: "Work", types: ["founder", "employee"] },
  // Self-declared education (SelfDeclaredExperience.kind = "education").
  { value: "academic", label: "Academic", types: ["academic"] },
  { value: "volunteer", label: "Volunteer", types: ["volunteer"] },
  { value: "project", label: "Project", types: ["contractor"] },
  { value: "investment", label: "Investment", types: ["advisor"] },
  { value: SELF_DECLARED, label: "Self-declared", types: [SELF_DECLARED] },
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
    return affiliation.verified_via === "registry"
      ? "Verified by registry"
      : "Verified by organisation";
  }
  return affiliationStatusLabel(affiliation.status);
}

function normalizeOrgKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

const MEMBERSHIP_FILTER_TYPES: Record<string, string> = {
  owner: "founder",
  admin: "employee",
  member: "employee",
  advisor: "advisor",
  board: "advisor",
  fractional: "employee",
};

/**
 * Each skill carries the span of the record it sits on — the design's point
 * being that a skill means more when you can see how long it was practised.
 */
function SkillChips({
  skills,
  startedOn,
  endedOn,
}: {
  skills: string[];
  startedOn: string;
  endedOn?: string | null;
}) {
  if (skills.length === 0) return null;
  const duration = recordDuration(startedOn, endedOn);
  return (
    <div className="mt-4 flex flex-wrap gap-1.5">
      {skills.map((skill) => (
        <span
          key={skill}
          className="inline-flex items-center gap-1.5 border border-white/15 bg-white/[0.025] px-2 py-1 text-[10px] text-white/65"
        >
          <b className="font-bold text-white/85">{skill}</b>
          <span className="text-beedero-yellow">{duration}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * The aggregate under the timeline: one chip per skill, with the total time
 * across every record it appears on.
 */
function CapabilityRecord({ skills }: { skills: AggregatedSkillTime[] }) {
  if (skills.length === 0) return null;
  return (
    <section className="mt-7 border-t border-white/10 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-beedero-yellow">
            Capability record
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.045em]">Skills.</h2>
        </div>
        <p className="max-w-xs text-[11px] leading-5 text-white/40 sm:text-right">
          Time reflects the experience where each skill was developed. Roles held at the same time
          count once.
        </p>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {skills.map((skill) => (
          <span
            key={skill.skill}
            className="inline-flex items-center gap-2 border border-beedero-yellow/30 bg-beedero-yellow/[0.06] px-3 py-2 text-xs font-bold text-white"
          >
            <span>{skill.skill}</span>
            <span className="border-l border-beedero-yellow/30 pl-2 text-[10px] font-black uppercase tracking-[0.08em] text-beedero-yellow">
              {skill.duration}
            </span>
          </span>
        ))}
      </div>
    </section>
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
  logoUrl,
  isLast,
  children,
}: {
  icon: LucideIcon;
  /** When set (verified org rows), replaces the generic role icon. */
  logoUrl?: string | null;
  isLast: boolean;
  children: React.ReactNode;
}) {
  return (
    <article className={`grid grid-cols-[28px_1fr] gap-4 ${isLast ? "" : "pb-8"}`}>
      <span
        aria-hidden
        className={`grid size-7 place-items-center overflow-hidden bg-[#252a34] text-beedero-yellow ${
          isLast ? "" : "record-line"
        }`}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img loading="lazy" src={logoUrl} alt="" className="size-7 object-cover" />
        ) : (
          <Icon size={14} />
        )}
      </span>
      <div className={`min-w-0 ${isLast ? "" : "border-b border-white/[0.08] pb-8"}`}>
        {children}
      </div>
    </article>
  );
}

function KindSelect({ defaultValue = "work" }: { defaultValue?: Experience["kind"] }) {
  return (
    <label className={`sm:col-span-2 ${labelDark}`}>
      Type
      <select name="kind" defaultValue={defaultValue} className={`mt-2 ${inputDark} bg-app-elevated`}>
        <option value="work">Work</option>
        <option value="education">Education</option>
      </select>
    </label>
  );
}

function ExperienceFields({ experience }: { experience?: Experience }) {
  return (
    <>
      <KindSelect defaultValue={experience?.kind ?? "work"} />
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
      <label className={`sm:col-span-2 ${labelDark}`}>
        What you did{" "}
        <span className="normal-case tracking-normal text-white/25">(short description)</span>
        <textarea
          name="description"
          defaultValue={experience?.description ?? ""}
          rows={3}
          maxLength={500}
          placeholder="A few lines on what you worked on and shipped."
          className={`mt-2 ${inputDark} min-h-[5.5rem] resize-y placeholder:text-white/35`}
        />
      </label>
      <label className={labelDark}>
        Started
        <DateInput
          name="started_on"
          defaultValue={experience?.started_on}
          required
          className={`mt-2 ${inputDark}`}
        />
      </label>
      <label className={labelDark}>
        Ended <span className="normal-case tracking-normal text-white/25">(blank = ongoing)</span>
        <DateInput
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
          <SkillsInput initial={experience?.skills ?? []} />
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

  const icon = experience.kind === "education" ? GraduationCap : BriefcaseBusiness;

  if (editing) {
    return (
      <RecordRow icon={icon} isLast={isLast}>
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
    <RecordRow icon={icon} isLast={isLast}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/35">
            Self-declared{experience.kind === "education" ? " · Education" : ""} ·{" "}
            {formatPeriod(experience.started_on, experience.ended_on)}
          </p>
          <h3 className="mt-1 text-base font-bold">{experience.role || experience.org_name}</h3>
          {experience.role && <p className="mt-1 text-sm text-white/55">{experience.org_name}</p>}
          {experience.description && (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">{experience.description}</p>
          )}
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
      <SkillChips
        skills={experience.skills ?? []}
        startedOn={experience.started_on}
        endedOn={experience.ended_on}
      />
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

function MembershipRecord({
  membership,
  isLast,
}: {
  membership: OrgMembershipExperience;
  isLast: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, formAction, pending] = useActionState(updateMyMembershipDetailsAction, null);
  useActionToast(error, pending, {
    successMessage: "Saved — waiting for the organisation to confirm.",
    onSuccess: () => {
      setEditing(false);
      router.refresh();
    },
  });

  // Three states, not two: a confirmed row whose confirmer was the member
  // themselves (you get one by creating the org) is no better evidence than a
  // self-declared record, and the ladder's rung 6 treats it the same way.
  const awaitingOrg = membership.details_status === "pending";
  const attested = membership.attestedByOther === true;
  const headline = membership.title || membership.roleLabel || membership.role;
  const period = formatPeriod(membership.started_on, membership.ended_on);
  const statusLabel = attested
    ? "Verified by organisation"
    : awaitingOrg
      ? "Pending confirmation"
      : "Self-declared";
  const statusClass = attested
    ? STATUS_STYLES.verified
    : awaitingOrg
      ? STATUS_STYLES.pending
      : STATUS_STYLES.self_declared;
  const statusTextClass = attested
    ? "text-emerald-400/80"
    : awaitingOrg
      ? "text-sky-300/80"
      : "text-white/55";

  const membershipIcon =
    ROLE_ICONS[MEMBERSHIP_FILTER_TYPES[membership.role] ?? ""] ?? BriefcaseBusiness;
  // The org's mark stands behind the row until the member edits it themselves.
  const membershipLogo = awaitingOrg ? null : membership.orgLogo;

  if (editing) {
    return (
      <RecordRow icon={membershipIcon} logoUrl={membershipLogo} isLast={isLast}>
        <form action={formAction} className="border border-white/15 bg-white/[0.02] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-sm font-black tracking-[-0.02em]">Edit {membership.orgName}</h3>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-white/45 transition hover:text-white"
              aria-label="Cancel editing"
            >
              <X size={16} aria-hidden />
            </button>
          </div>
          <p className="mb-4 text-xs text-white/45">
            Saving removes the verified badge until {membership.orgName} confirms your changes.
          </p>
          <input type="hidden" name="org_slug" value={membership.org} />
          <input type="hidden" name="membership_id" value={membership.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={`sm:col-span-2 ${labelDark}`}>
              Role / title
              <input
                name="title"
                defaultValue={membership.title ?? ""}
                placeholder="e.g. Founder, Engineer"
                className={`mt-2 ${inputDark} placeholder:text-white/35`}
              />
            </label>
            <label className={`sm:col-span-2 ${labelDark}`}>
              What you did{" "}
              <span className="normal-case tracking-normal text-white/25">(short description)</span>
              <textarea
                name="description"
                defaultValue={membership.description ?? ""}
                rows={3}
                maxLength={500}
                placeholder="A few lines on what you worked on and shipped."
                className={`mt-2 ${inputDark} min-h-[5.5rem] resize-y placeholder:text-white/35`}
              />
            </label>
            <label className={labelDark}>
              Started
              <DateInput
                name="started_on"
                defaultValue={membership.started_on}
                required
                className={`mt-2 ${inputDark}`}
              />
            </label>
            <label className={labelDark}>
              Ended <span className="normal-case tracking-normal text-white/25">(blank = ongoing)</span>
              <DateInput
                name="ended_on"
                defaultValue={membership.ended_on ?? ""}
                className={`mt-2 ${inputDark}`}
              />
            </label>
            <div className="sm:col-span-2">
              <p className={labelDark}>
                Skills <span className="normal-case tracking-normal text-white/25">(optional)</span>
              </p>
              <div className="mt-2">
                <SkillsInput initial={membership.skills.map((skill) => skill.skill)} max={10} />
              </div>
            </div>
          </div>
          <button type="submit" disabled={pending} className={`${btnPrimary} mt-4`}>
            {pending ? "Saving…" : "Save changes"}
          </button>
        </form>
      </RecordRow>
    );
  }

  return (
    <RecordRow icon={membershipIcon} logoUrl={membershipLogo} isLast={isLast}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={`text-[10px] font-black uppercase tracking-[0.14em] ${statusTextClass}`}
          >
            {statusLabel}
            {period ? ` · ${period}` : ""}
          </p>
          <h3 className="mt-1 text-base font-bold">{headline}</h3>
          <p className="mt-1 text-sm text-white/55">{membership.orgName}</p>
          {membership.description && (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">{membership.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <StatusChip label={statusLabel} className={statusClass} />
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={iconButtonClass}
            aria-label={`Edit ${headline} at ${membership.orgName}`}
          >
            <Pencil size={12} aria-hidden />
          </button>
        </div>
      </div>
      <SkillChips
        skills={membership.skills.map((skill) => skill.skill)}
        startedOn={membership.started_on}
        endedOn={membership.ended_on}
      />
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
  const [editing, setEditing] = useState(false);
  const [error, deleteAction, pending] = useActionState(withdrawAffiliationAction, null);
  const [editError, editAction, editPending] = useActionState(updateAffiliationDetailsAction, null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  useActionToast(error, pending, { successMessage: "Affiliation withdrawn." });
  useActionToast(editError, editPending, {
    successMessage:
      affiliation.status === "verified"
        ? "Saved — waiting for the organisation to confirm."
        : "Affiliation updated.",
    onSuccess: () => {
      setEditing(false);
      router.refresh();
    },
  });
  const canWithdraw = affiliation.status !== "verified";
  const canAccept = affiliation.status === "pending" && affiliation.is_org_added;
  const canEdit = affiliation.status !== "disputed";

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

  const statusText = affiliationStatusText(affiliation);
  const verified = affiliation.status === "verified";
  const affiliationIcon = ROLE_ICONS[affiliation.role] ?? BriefcaseBusiness;
  const affiliationLogo = verified ? affiliation.org.logo : null;

  if (editing) {
    return (
      <RecordRow icon={affiliationIcon} logoUrl={affiliationLogo} isLast={isLast}>
        <form action={editAction} className="border border-white/15 bg-white/[0.02] p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-sm font-black tracking-[-0.02em]">Edit affiliation</h3>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-white/45 transition hover:text-white"
              aria-label="Cancel editing"
            >
              <X size={16} aria-hidden />
            </button>
          </div>
          {verified && (
            <p className="mb-4 text-xs text-white/45">
              Saving removes the verified badge until {affiliation.org.name} confirms your changes.
            </p>
          )}
          <input type="hidden" name="affiliation_id" value={affiliation.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={`sm:col-span-2 ${labelDark}`}>
              Title
              <input
                name="title"
                defaultValue={affiliation.title}
                className={`mt-2 ${inputDark} placeholder:text-white/35`}
              />
            </label>
            <label className={`sm:col-span-2 ${labelDark}`}>
              What you did{" "}
              <span className="normal-case tracking-normal text-white/25">(short description)</span>
              <textarea
                name="description"
                defaultValue={affiliation.description ?? ""}
                rows={3}
                maxLength={500}
                placeholder="A few lines on what you worked on and shipped."
                className={`mt-2 ${inputDark} min-h-[5.5rem] resize-y placeholder:text-white/35`}
              />
            </label>
            <label className={labelDark}>
              Started
              <DateInput
                name="started_on"
                defaultValue={affiliation.started_on}
                required
                className={`mt-2 ${inputDark}`}
              />
            </label>
            <label className={labelDark}>
              Ended <span className="normal-case tracking-normal text-white/25">(blank = ongoing)</span>
              <DateInput
                name="ended_on"
                defaultValue={affiliation.ended_on ?? ""}
                className={`mt-2 ${inputDark}`}
              />
            </label>
            <div className="sm:col-span-2">
              <p className={labelDark}>
                Skills <span className="normal-case tracking-normal text-white/25">(optional)</span>
              </p>
              <div className="mt-2">
                <SkillsInput initial={affiliation.skills} />
              </div>
            </div>
          </div>
          <button type="submit" disabled={editPending} className={`${btnPrimary} mt-4`}>
            {editPending ? "Saving…" : "Save changes"}
          </button>
        </form>
      </RecordRow>
    );
  }

  return (
    <RecordRow icon={affiliationIcon} logoUrl={affiliationLogo} isLast={isLast}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className={`text-[10px] font-black uppercase tracking-[0.14em] ${
              verified ? "text-emerald-400/80" : "text-white/35"
            }`}
          >
            {verified ? statusText : roleTypeLabel(affiliation.role)} ·{" "}
            {formatPeriod(affiliation.started_on, affiliation.ended_on)}
          </p>
          <h3 className="mt-1 text-base font-bold">
            {affiliation.title || roleTypeLabel(affiliation.role)}
          </h3>
          <p className="mt-1 text-sm text-white/55">{affiliation.org.name}</p>
          {affiliation.description && (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">{affiliation.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <StatusChip label={statusText} className={STATUS_STYLES[affiliation.status]} />
          {canEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className={iconButtonClass}
              aria-label={`Edit ${affiliation.title || affiliation.role}`}
            >
              <Pencil size={12} aria-hidden />
            </button>
          )}
        </div>
      </div>
      <SkillChips
        skills={affiliation.skills}
        startedOn={affiliation.started_on}
        endedOn={affiliation.ended_on}
      />

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
          <>
            <KindSelect />
            <label className={`sm:col-span-2 ${labelDark}`}>
              Role or degree{" "}
              <span className="normal-case tracking-normal text-white/25">(optional)</span>
              <input
                name="role"
                placeholder="e.g. Founder, Engineer, MSc Management"
                className={`mt-2 ${inputDark} placeholder:text-white/35`}
              />
            </label>
          </>
        )}

        <label className={`sm:col-span-2 ${labelDark}`}>
          What you did{" "}
          <span className="normal-case tracking-normal text-white/25">(short description)</span>
          <textarea
            name="description"
            rows={3}
            maxLength={500}
            placeholder="A few lines on what you worked on and shipped."
            className={`mt-2 ${inputDark} min-h-[5.5rem] resize-y placeholder:text-white/35`}
          />
        </label>

        <label className={labelDark}>
          Started
          <DateInput name="started_on" required className={`mt-2 ${inputDark}`} />
        </label>
        <label className={labelDark}>
          Ended <span className="normal-case tracking-normal text-white/25">(blank = ongoing)</span>
          <DateInput name="ended_on" className={`mt-2 ${inputDark}`} />
        </label>

        <div className="sm:col-span-2">
          <p className={labelDark}>
            Skills <span className="normal-case tracking-normal text-white/25">(optional)</span>
          </p>
          <div className="mt-2">
            <SkillsInput initial={[]} />
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
  | { kind: "experience"; startedOn: string; types: string[]; experience: Experience }
  | { kind: "affiliation"; startedOn: string; types: string[]; affiliation: AffiliationSummary }
  | { kind: "membership"; startedOn: string; types: string[]; membership: OrgMembershipExperience };

export function ExperienceManager({
  experiences,
  affiliations,
  memberships = [],
  showCapabilities = true,
  headerAside,
}: {
  experiences: Experience[];
  affiliations: AffiliationSummary[];
  memberships?: OrgMembershipExperience[];
  /** e.g. the visibility pill for the record ("memberships"). */
  headerAside?: React.ReactNode;
  /** The one-page profile shows these in its Skills section instead. */
  showCapabilities?: boolean;
}) {
  // Free-text rows that duplicate a roster membership (same org name) stay
  // out of the list — the membership is the verified source of truth.
  const membershipOrgKeys = new Set(memberships.map((m) => normalizeOrgKey(m.orgName)));
  const membershipSlugs = new Set(memberships.map((m) => m.org));
  const visibleExperiences = experiences.filter(
    (experience) => !membershipOrgKeys.has(normalizeOrgKey(experience.org_name))
  );
  // Founder affiliations stay self_declared until registry review, but an
  // Owner/Admin membership on that same org already proves the relationship.
  const visibleAffiliations = affiliations.filter((affiliation) => {
    if (membershipSlugs.has(affiliation.org.slug) && affiliation.role === "founder") {
      return false;
    }
    return true;
  });

  const items: ExperienceListItem[] = [
    ...memberships.map((membership): ExperienceListItem => ({
      kind: "membership",
      startedOn: membership.started_on,
      types: [MEMBERSHIP_FILTER_TYPES[membership.role] ?? "employee"],
      membership,
    })),
    ...visibleExperiences.map((experience): ExperienceListItem => ({
      kind: "experience",
      startedOn: experience.started_on,
      // Education is still self-declared, so it answers to both chips.
      types: experience.kind === "education" ? [SELF_DECLARED, "academic"] : [SELF_DECLARED],
      experience,
    })),
    ...visibleAffiliations.map((affiliation): ExperienceListItem => ({
      kind: "affiliation",
      startedOn: affiliation.started_on,
      types: [affiliation.role],
      affiliation,
    })),
  ].sort((a, b) => (a.startedOn < b.startedOn ? 1 : a.startedOn > b.startedOn ? -1 : 0));

  const [activeFilter, setActiveFilter] = useState("all");
  const [adding, setAdding] = useState(items.length === 0);
  const activeTypes = FILTERS.find((filter) => filter.value === activeFilter)?.types ?? [];
  const visible =
    activeFilter === "all"
      ? items
      : items.filter((item) => item.types.some((type) => activeTypes.includes(type)));

  // Aggregated over every record, not just the filtered ones: the capability
  // row answers "what can this person do", which a type filter shouldn't crop.
  const capabilities = aggregateSkillTime(
    items.map((item) => {
      if (item.kind === "experience") return item.experience;
      if (item.kind === "membership") {
        return {
          skills: item.membership.skills.map((skill) => skill.skill),
          started_on: item.membership.started_on,
          ended_on: item.membership.ended_on,
        };
      }
      return {
        skills: item.affiliation.skills,
        started_on: item.affiliation.started_on,
        ended_on: item.affiliation.ended_on,
      };
    })
  );

  return (
    <section className="border border-white/10 bg-white/[0.025] p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-beedero-yellow">
            Professional record
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.045em]">Experience.</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {headerAside}
          {!adding && (
            <button type="button" onClick={() => setAdding(true)} className={btnPrimary}>
              <Plus size={14} aria-hidden /> Add experience
            </button>
          )}
        </div>
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
            if (item.kind === "membership") {
              return (
                <MembershipRecord
                  key={`membership-${item.membership.id}`}
                  membership={item.membership}
                  isLast={isLast}
                />
              );
            }
            if (item.kind === "experience") {
              return (
                <ExperienceRecord
                  key={`experience-${item.experience.id}`}
                  experience={item.experience}
                  isLast={isLast}
                />
              );
            }
            return (
              <AffiliationRecord
                key={`affiliation-${item.affiliation.id}`}
                affiliation={item.affiliation}
                isLast={isLast}
              />
            );
          })}
        </div>
      )}

      {showCapabilities && <CapabilityRecord skills={capabilities} />}
    </section>
  );
}
