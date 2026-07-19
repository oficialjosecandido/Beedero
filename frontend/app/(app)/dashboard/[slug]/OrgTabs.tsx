"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useActionState } from "react";
import { QRCodeSVG } from "qrcode.react";

import {
  activateOrgAction,
  closeRoundAction,
  connectStripeTractionAction,
  createInviteAction,
  deleteActivityAction,
  deleteFieldAction,
  openRoundAction,
  postFeedAction,
  removeMemberAction,
  revokeInviteAction,
  submitVerificationAction,
  updateMemberRoleAction,
  updateOrgProfileAction,
  upsertFieldAction,
} from "../actions";
import { CredibilityBadge } from "@/components/CredibilityBadge";
import { BadgeEmbedPanel, PresenceSignalsPanel, VitalityChecklistPanel } from "@/components/BadgePanels";
import { EventsCalendar } from "@/components/EventsCalendar";
import { CREDIBILITY_LEVEL_LABELS, credibilityLevelHeading } from "@/lib/credibility";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { SITE_URL } from "@/lib/site-metadata";
import { SECTION_LABELS } from "@/lib/types";
import { useActionToast } from "@/lib/use-action-toast";

type SectionField = {
  id: number;
  key: string;
  value: unknown;
  visibility: string;
  created_at?: string;
};
type Section = { id: number; kind: string; visibility: string; fields: SectionField[] };
type OrgBasics = { slug: string; name: string; one_liner: string; stage: string; sector: string; geo: string };
type FundraiseRound = {
  id: number;
  valuation: number | null;
  ask_amount: number | null;
  raised_amount: number | null;
  use_of_funds: string;
  stage: string;
  is_open: boolean;
  opened_at: string;
  closed_at: string | null;
};
type Stats = {
  followers_count: number;
  visitors_count: number;
  range_days?: number;
  new_followers?: number;
  profile_views?: number;
};
type Member = {
  id: number;
  email: string;
  full_name: string;
  profile_picture?: string | null;
  role: string;
};
type Invite = {
  id: number;
  token: string;
  role: string;
  created_at: string;
  revoked_at: string | null;
  uses_count: number;
  is_active: boolean;
};
type Onboarding = {
  status: "draft" | "live";
  completeness: number;
  refund_eligible: boolean;
  publish_ready: boolean;
  checklist: { key: string; done: boolean; hint: string }[];
  fee: { amount_cents: number; status: string; refund_as_credit: boolean } | null;
};
type PostValue = {
  title?: string;
  body?: string;
  occurred_at?: string;
  ends_at?: string | null;
  image?: string | null;
};
type OrgActivity = {
  id: number;
  kind: string;
  created_at: string;
  value: PostValue;
};
type CalendarEvent = {
  id: number | string;
  title: string;
  occurred_at: string;
  ends_at?: string | null;
  body?: string;
};
type VerificationInfo = {
  status: "pending" | "verified" | "rejected" | "expired";
  valid_until: string | null;
  submitted_at?: string;
  reviewed_at?: string | null;
  rejection_reason?: string;
  payload?: Record<string, unknown>;
};
type CredibilityInfo = { level: number; verifications: Record<string, VerificationInfo> };
type VitalityInfo = {
  items: { key: string; label: string; done: boolean; hint: string }[];
  done_count: number;
  total_count: number;
  presence: {
    investor_views: number;
    new_followers: number;
    interest: number;
    since_days: number;
    has_signal: boolean;
  };
  badge: {
    level: number;
    visual_status: "verified" | "expiring" | "expired" | "unverified";
    valid_until: string | null;
    days_until_expiry: number | null;
  };
};
type BadgeEmbedInfo = {
  html: string;
  verify_url: string;
  badge_url: string;
  json_url: string;
};

const FUNDRAISE_KINDS = ["valuation", "ask", "use_of_funds", "financials", "dataroom", "cap_table"];
const ROLE_OPTIONS = ["owner", "admin", "member"];

const POST_KIND_OPTIONS = [
  { value: "milestones", label: "Milestone" },
  { value: "events", label: "Event" },
  { value: "news", label: "Update" },
];

import { GEO_FIELD_HELP, GEO_FIELD_LABEL, GEO_OPTIONS, SECTOR_OPTIONS, STAGE_OPTIONS } from "@/lib/org-filters";

const CURATED_LINKS: { key: string; label: string; placeholder: string }[] = [
  { key: "website", label: "Website", placeholder: "https://yourcompany.com" },
  { key: "twitter", label: "Twitter / X", placeholder: "https://x.com/yourhandle" },
  { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/company/..." },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/..." },
  { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/..." },
];

const ABOUT_FIELDS = [
  {
    key: "summary",
    label: "About",
    placeholder: "Explain what the organization does in simple language.",
    rows: 5,
  },
  {
    key: "mission",
    label: "Mission",
    placeholder: "What problem are you here to solve?",
  },
  {
    key: "vision",
    label: "Vision",
    placeholder: "What future do you want to create?",
  },
  {
    key: "values",
    label: "Values",
    placeholder: "What principles guide the team?",
  },
] as const;

const PRODUCTS_FIELDS = [
  {
    key: "overview",
    label: "Products & services",
    placeholder: "What do you sell or offer? List your main products or services.",
    rows: 4,
  },
] as const;

const MARKET_THESIS_FIELDS = [
  {
    key: "problem",
    label: "Problem",
    placeholder: "What pain point are you solving?",
    rows: 3,
  },
  {
    key: "market",
    label: "Market",
    placeholder: "Who is the target market, how big is the opportunity, and where you operate or sell?",
    rows: 3,
  },
  {
    key: "why_now",
    label: "Why now",
    placeholder: "What makes this the right moment?",
    rows: 3,
  },
] as const;

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "calendar", label: "View calendar" },
  { id: "activity", label: "Activity" },
  { id: "profile", label: "Profile" },
  { id: "fundraising", label: "Fundraising" },
  { id: "credibility", label: "Credibility" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function SectionFieldRow({ slug, kind, field }: { slug: string; kind: string; field: SectionField }) {
  const [saveError, saveAction, savePending] = useActionState(upsertFieldAction, null);
  const [deleteError, deleteAction, deletePending] = useActionState(deleteFieldAction, null);
  useActionToast(saveError, savePending, { successMessage: "Saved." });
  useActionToast(deleteError, deletePending, { successMessage: "Removed." });

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-28 shrink-0 truncate text-zinc-500">{field.key}</span>
      <form action={saveAction} className="flex flex-1 items-center gap-2">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="key" value={field.key} />
        <input
          name="value"
          defaultValue={typeof field.value === "string" ? field.value : JSON.stringify(field.value)}
          className="flex-1 rounded-lg border border-beedero-border px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
        />
        <select
          name="visibility"
          defaultValue={field.visibility}
          className="rounded-lg border border-beedero-border px-2 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
        >
          <option value="public">public</option>
          <option value="restricted">restricted</option>
          <option value="private">private</option>
        </select>
        <button
          disabled={savePending}
          className="rounded-lg border border-beedero-border px-2.5 py-1.5 text-xs font-medium hover:bg-beedero-yellow disabled:opacity-50"
        >
          {savePending ? "Saving..." : "Save"}
        </button>
      </form>
      <form action={deleteAction}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="key" value={field.key} />
        <button
          disabled={deletePending}
          className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          {deletePending ? "Removing..." : "Delete"}
        </button>
      </form>
    </div>
  );
}

function SectionAddFieldForm({ slug, kind }: { slug: string; kind: string }) {
  const [error, formAction, pending] = useActionState(upsertFieldAction, null);
  useActionToast(error, pending, { successMessage: "Added." });

  return (
    <form
      action={formAction}
      className="flex items-center gap-2 border-t border-dashed border-beedero-border pt-3"
    >
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="kind" value={kind} />
      <input
        name="key"
        placeholder="new key"
        required
        className="w-28 rounded-lg border border-beedero-border px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
      />
      <input
        name="value"
        placeholder="value"
        required
        className="flex-1 rounded-lg border border-beedero-border px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
      />
      <select name="visibility" className="rounded-lg border border-beedero-border px-2 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60">
        <option value="">(inherits)</option>
        <option value="public">public</option>
        <option value="restricted">restricted</option>
        <option value="private">private</option>
      </select>
      <button
        disabled={pending}
        className="rounded-lg bg-beedero-yellow px-3 py-1.5 text-xs font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
      >
        {pending ? "Adding..." : "Add"}
      </button>
    </form>
  );
}

function SectionCard({ slug, section }: { slug: string; section: Section }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-extrabold text-zinc-900">{SECTION_LABELS[section.kind] ?? section.kind}</h3>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500">
          {section.visibility}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {section.fields.length === 0 && <p className="text-sm text-zinc-400">No fields yet.</p>}
        {section.fields.map((field) => (
          <SectionFieldRow key={field.id} slug={slug} kind={section.kind} field={field} />
        ))}
      </div>
      <SectionAddFieldForm slug={slug} kind={section.kind} />
    </div>
  );
}

function CuratedFieldForm({
  slug,
  kind,
  item,
  field,
}: {
  slug: string;
  kind: string;
  item: { key: string; label: string; placeholder: string; rows?: number };
  field?: SectionField;
}) {
  const [saveError, saveAction, savePending] = useActionState(upsertFieldAction, null);
  const [deleteError, deleteAction, deletePending] = useActionState(deleteFieldAction, null);
  useActionToast(saveError, savePending, { successMessage: "Saved." });
  useActionToast(deleteError, deletePending, { successMessage: "Cleared." });

  return (
    <form action={saveAction} className="flex flex-col gap-2">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="key" value={item.key} />
      <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
        {item.label}
        <textarea
          name="value"
          rows={item.rows ?? 3}
          placeholder={item.placeholder}
          defaultValue={typeof field?.value === "string" ? field.value : ""}
          className="rounded-xl border border-beedero-border bg-white px-3 py-2 text-sm text-beedero-black outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
        />
      </label>
      <div className="flex items-center gap-2">
        <button
          disabled={savePending}
          className="rounded-lg bg-beedero-yellow px-3 py-1.5 text-xs font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
        >
          {savePending ? "Saving..." : `Save ${item.label}`}
        </button>
        {field && (
          <button
            formAction={deleteAction}
            disabled={deletePending}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {deletePending ? "Clearing..." : "Clear"}
          </button>
        )}
      </div>
    </form>
  );
}

function CuratedProfileSection({
  slug,
  section,
  kind,
  title,
  description,
  fields,
  optional = false,
}: {
  slug: string;
  section?: Section;
  kind: string;
  title: string;
  description?: string;
  fields: readonly { key: string; label: string; placeholder: string; rows?: number }[];
  optional?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-extrabold text-zinc-900">{title}</h3>
            {optional && (
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500">
                Optional
              </span>
            )}
          </div>
          {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
        </div>
        <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500">
          public
        </span>
      </div>
      <div className="grid gap-4">
        {fields.map((item) => {
          const field = section?.fields.find((f) => f.key === item.key);
          return <CuratedFieldForm key={item.key} slug={slug} kind={kind} item={item} field={field} />;
        })}
      </div>
    </div>
  );
}

function AboutProfileSection({ slug, section }: { slug: string; section?: Section }) {
  return (
    <CuratedProfileSection
      slug={slug}
      section={section}
      kind="about"
      title="About"
      fields={ABOUT_FIELDS}
    />
  );
}

function CuratedLinkRow({
  slug,
  linkKey,
  label,
  placeholder,
  field,
}: {
  slug: string;
  linkKey: string;
  label: string;
  placeholder: string;
  field?: SectionField;
}) {
  const [saveError, saveAction, savePending] = useActionState(upsertFieldAction, null);
  const [deleteError, deleteAction, deletePending] = useActionState(deleteFieldAction, null);
  useActionToast(saveError, savePending, { successMessage: "Saved." });
  useActionToast(deleteError, deletePending, { successMessage: "Cleared." });

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-24 shrink-0 font-medium text-zinc-600">{label}</span>
      <form action={saveAction} className="flex flex-1 items-center gap-2">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="kind" value="links" />
        <input type="hidden" name="key" value={linkKey} />
        <input
          name="value"
          placeholder={placeholder}
          defaultValue={typeof field?.value === "string" ? field.value : ""}
          className="flex-1 rounded-lg border border-beedero-border px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
        />
        <button
          disabled={savePending}
          className="rounded-lg border border-beedero-border px-2.5 py-1.5 text-xs font-medium hover:bg-beedero-yellow disabled:opacity-50"
        >
          {savePending ? "Saving..." : "Save"}
        </button>
      </form>
      {field && (
        <form action={deleteAction}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="kind" value="links" />
          <input type="hidden" name="key" value={linkKey} />
          <button
            disabled={deletePending}
            className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {deletePending ? "Clearing..." : "Clear"}
          </button>
        </form>
      )}
    </div>
  );
}

function CustomLinkRow({ slug, field }: { slug: string; field: SectionField }) {
  const [saveError, saveAction, savePending] = useActionState(upsertFieldAction, null);
  const [deleteError, deleteAction, deletePending] = useActionState(deleteFieldAction, null);
  useActionToast(saveError, savePending, { successMessage: "Saved." });
  useActionToast(deleteError, deletePending, { successMessage: "Removed." });

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-28 shrink-0 truncate text-zinc-500">{field.key}</span>
      <form action={saveAction} className="flex flex-1 items-center gap-2">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="kind" value="links" />
        <input type="hidden" name="key" value={field.key} />
        <input
          name="value"
          defaultValue={typeof field.value === "string" ? field.value : JSON.stringify(field.value)}
          className="flex-1 rounded-lg border border-beedero-border px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
        />
        <button
          disabled={savePending}
          className="rounded-lg border border-beedero-border px-2.5 py-1.5 text-xs font-medium hover:bg-beedero-yellow disabled:opacity-50"
        >
          {savePending ? "Saving..." : "Save"}
        </button>
      </form>
      <form action={deleteAction}>
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="kind" value="links" />
        <input type="hidden" name="key" value={field.key} />
        <button
          disabled={deletePending}
          className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          {deletePending ? "Removing..." : "Delete"}
        </button>
      </form>
    </div>
  );
}

function AddCustomLinkForm({ slug }: { slug: string }) {
  const [error, formAction, pending] = useActionState(upsertFieldAction, null);
  useActionToast(error, pending, { successMessage: "Added." });

  return (
    <form
      action={formAction}
      className="mt-3 flex items-center gap-2 border-t border-dashed border-beedero-border pt-3"
    >
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="kind" value="links" />
      <input
        name="key"
        placeholder="label, e.g. crunchbase"
        required
        className="w-32 rounded-lg border border-beedero-border px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
      />
      <input name="value" placeholder="url" required className="flex-1 rounded-lg border border-beedero-border px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60" />
      <button
        disabled={pending}
        className="rounded-lg bg-beedero-yellow px-3 py-1.5 text-xs font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
      >
        {pending ? "Adding..." : "Add"}
      </button>
    </form>
  );
}

function LinksTab({ slug, section }: { slug: string; section?: Section }) {
  const fields = section?.fields ?? [];
  const curatedKeys = new Set(CURATED_LINKS.map((l) => l.key));
  const customFields = fields.filter((f) => !curatedKeys.has(f.key));

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm">
        <h3 className="font-extrabold text-zinc-900">Website &amp; social media</h3>
        <p className="mt-1 text-sm text-zinc-500">
          Shown on your public profile so investors and partners can find you.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          {CURATED_LINKS.map(({ key, label, placeholder }) => {
            const field = fields.find((f) => f.key === key);
            return (
              <CuratedLinkRow
                key={key}
                slug={slug}
                linkKey={key}
                label={label}
                placeholder={placeholder}
                field={field}
              />
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm">
        <h3 className="font-extrabold text-zinc-900">Other links</h3>
        <div className="mt-3 flex flex-col gap-2">
          {customFields.length === 0 && <p className="text-sm text-zinc-400">No custom links yet.</p>}
          {customFields.map((field) => (
            <CustomLinkRow key={field.id} slug={slug} field={field} />
          ))}
        </div>
        <AddCustomLinkForm slug={slug} />
      </div>
    </div>
  );
}

const CHECKLIST_LABELS: Record<string, string> = {
  logo: "Logo",
  one_liner: "One-liner",
  stage: "Stage",
  sector: "Sector",
  geo: "Based in",
  about: "About (summary, mission, vision, values)",
  team: "Team",
  products: "Products",
  market: "Market thesis",
};

/** Profile setup items only — not blockers for posting (first post / credibility are boosts). */
const PROFILE_SETUP_CHECKLIST_KEYS = new Set([
  "logo",
  "one_liner",
  "stage",
  "sector",
  "geo",
  "about",
  "team",
  "products",
  "market",
]);

function OnboardingPanel({
  slug,
  onboarding,
  canManage,
}: {
  slug: string;
  onboarding: Onboarding;
  canManage: boolean;
}) {
  const [error, formAction, pending] = useActionState(activateOrgAction, null);
  useActionToast(error, pending, { successMessage: "Organization published!" });

  return (
    <div className="rounded-2xl border-2 border-beedero-border bg-beedero-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-extrabold text-zinc-900">Profile strength</h3>
        <span className="text-sm font-medium text-zinc-500">{onboarding.completeness}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-2 rounded-full bg-beedero-yellow transition-all"
          style={{ width: `${onboarding.completeness}%` }}
        />
      </div>
      <div
        className={`mt-4 grid gap-4 ${onboarding.status === "live" ? "lg:grid-cols-[minmax(0,1fr)_240px]" : ""}`}
      >
        {onboarding.checklist.some(
          (item) => !item.done && PROFILE_SETUP_CHECKLIST_KEYS.has(item.key)
        ) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 lg:col-span-full">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-900">Still to do</p>
            <ul className="mt-1.5 flex flex-col gap-1">
              {onboarding.checklist
                .filter((item) => !item.done && PROFILE_SETUP_CHECKLIST_KEYS.has(item.key))
                .map((item) => (
                  <li key={item.key} className="text-sm font-medium text-amber-950">
                    {CHECKLIST_LABELS[item.key] ?? item.key}
                    <span className="font-normal text-amber-800/80"> — {item.hint}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}
        <ul className="flex flex-col gap-1.5">
          {onboarding.checklist.map((item) => (
            <li key={item.key} className="flex items-start gap-2 text-sm">
              <span>{item.done ? "✅" : "⬜"}</span>
              <span className={item.done ? "text-zinc-400 line-through" : "text-zinc-700"}>
                {CHECKLIST_LABELS[item.key] ?? item.key}
              </span>
              {!item.done && <span className="text-xs text-zinc-400">— {item.hint}</span>}
            </li>
          ))}
        </ul>
        {onboarding.status === "live" && <PublicPageShare slug={slug} />}
      </div>
      {onboarding.status === "draft" && canManage ? (
        <form action={formAction} className="mt-4">
          <input type="hidden" name="slug" value={slug} />
          <button
            type="submit"
            disabled={pending || !onboarding.publish_ready}
            className="rounded-xl bg-beedero-yellow px-4 py-2 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
          >
            {pending ? "Publishing..." : "Publish organization"}
          </button>
          {!onboarding.publish_ready && (
            <p className="mt-2 text-xs text-zinc-500">
              Complete all required Profile fields before publishing. Market thesis is optional.
            </p>
          )}
          <p className="mt-2 text-xs text-zinc-400">Publishing is free.</p>
        </form>
      ) : onboarding.status === "live" ? (
        <p className="mt-4 rounded-xl bg-beedero-yellow/25 px-3 py-2 text-sm font-semibold text-beedero-black">
          Your organization is live and visible to investors 🎉
        </p>
      ) : (
        <p className="mt-4 text-xs text-zinc-500">
          Ask an owner or admin to publish once the required Profile fields are complete.
        </p>
      )}
    </div>
  );
}

function PublicPageShare({ slug }: { slug: string }) {
  const publicUrl = `${SITE_URL}/o/${slug}`;

  return (
    <div className="flex flex-col gap-3 rounded-xl border-2 border-beedero-border bg-zinc-50 p-3 lg:self-start">
      <QRCodeSVG value={publicUrl} size={72} className="mx-auto shrink-0 rounded-md bg-white p-1 lg:mx-0" />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-xs font-medium text-zinc-500">Public page</p>
        <a
          href={publicUrl}
          target="_blank"
          rel="noreferrer"
          className="truncate text-sm font-semibold text-beedero-black underline"
        >
          {publicUrl.replace(/^https?:\/\//, "")}
        </a>
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(publicUrl)}
          className="self-start text-xs font-semibold text-zinc-500 hover:text-beedero-black"
        >
          Copy link
        </button>
      </div>
    </div>
  );
}

function OverviewTab({
  slug,
  stats,
  onboarding,
  canManage,
  presence,
}: {
  slug: string;
  stats: Stats;
  onboarding: Onboarding;
  canManage: boolean;
  presence: VitalityInfo["presence"] | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <OnboardingPanel slug={slug} onboarding={onboarding} canManage={canManage} />
      {presence && <PresenceSignalsPanel presence={presence} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border-2 border-beedero-border bg-beedero-white p-6 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Followers</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{stats.followers_count}</p>
          {typeof stats.new_followers === "number" && (
            <p className="mt-1 text-xs font-semibold text-emerald-600">
              +{stats.new_followers} in the last {stats.range_days ?? 7} days
            </p>
          )}
        </div>
        <div className="rounded-2xl border-2 border-beedero-border bg-beedero-white p-6 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Profile visitors</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{stats.visitors_count}</p>
          <p className="mt-1 text-xs text-zinc-400">
            Distinct people outside your organization who viewed this profile.
          </p>
          {typeof stats.profile_views === "number" && (
            <p className="mt-1 text-xs font-semibold text-emerald-600">
              {stats.profile_views} views in the last {stats.range_days ?? 7} days
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function PostComposer({
  slug,
  canPostUpdates,
  hasPostedToday,
  suggestedTitle,
  suggestedBody,
}: {
  slug: string;
  canPostUpdates: boolean;
  hasPostedToday: boolean;
  suggestedTitle?: string;
  suggestedBody?: string;
}) {
  const [error, formAction, pending] = useActionState(postFeedAction, null);
  const [kind, setKind] = useState(suggestedTitle ? "milestones" : POST_KIND_OPTIONS[0].value);
  const allowsPhoto = kind === "events" || kind === "news";
  const isEvent = kind === "events";
  useActionToast(error, pending, { successMessage: "Update posted!" });

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-2xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm"
    >
      <input type="hidden" name="slug" value={slug} />
      <h3 className="font-extrabold text-zinc-900">Share an update</h3>
      {hasPostedToday ? (
        <div className="rounded-2xl border border-beedero-border bg-zinc-50 p-4">
          <p className="text-sm font-semibold text-beedero-black">
            You have already posted today.
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            To avoid noisy feeds, each profile can publish one update per day. Come back tomorrow.
          </p>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">
          Milestones, events, and updates appear in your followers&apos; feed.
        </p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
          Type
          <select
            name="kind"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
            className="rounded-lg border border-beedero-border px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
          >
            {POST_KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <input
          name="title"
          placeholder="Title"
          defaultValue={suggestedTitle}
          required
          className="min-w-[10rem] flex-1 rounded-lg border border-beedero-border px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
        />
      </div>
      {isEvent && (
        <div className="flex flex-wrap gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
            Start
            <input
              type="datetime-local"
              name="starts_at"
              required
              className="rounded-lg border border-beedero-border px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
            End
            <input
              type="datetime-local"
              name="ends_at"
              required
              className="rounded-lg border border-beedero-border px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
            />
          </label>
        </div>
      )}
      <textarea
        name="body"
        placeholder="Say more..."
        rows={3}
        defaultValue={suggestedBody}
        className="rounded-lg border border-beedero-border px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
      />
      {allowsPhoto ? (
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
          Photo (optional, max 1)
          <input
            type="file"
            name="image"
            accept="image/*"
            className="text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-beedero-yellow file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-beedero-black hover:file:bg-beedero-black hover:file:text-beedero-white"
          />
        </label>
      ) : (
        <p className="text-xs text-zinc-500">Milestones are text-only and cannot include photos.</p>
      )}
      <button
        disabled={!canPostUpdates || pending}
        title={!canPostUpdates ? "You can publish one update per day." : undefined}
        className="self-start rounded-xl bg-beedero-yellow px-4 py-2 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Publishing..." : "Publish"}
      </button>
    </form>
  );
}

function PostCard({ slug, activity }: { slug: string; activity: OrgActivity }) {
  const value = activity.value;
  return (
    <article className="flex flex-col gap-3 rounded-2xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500">
          {SECTION_LABELS[activity.kind] ?? activity.kind}
        </span>
        <form action={deleteActivityAction}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="activity_id" value={activity.id} />
          <button className="text-xs font-medium text-red-700 hover:underline">Delete</button>
        </form>
      </div>
      {value.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value.image} alt="" className="max-h-72 w-full rounded-xl object-cover" />
      )}
      <h3 className="text-lg font-extrabold text-zinc-900">{value.title ?? "Update"}</h3>
      {value.body && <p className="text-sm leading-6 text-zinc-600">{value.body}</p>}
      {activity.kind === "events" && value.occurred_at && value.ends_at ? (
        <p className="text-xs text-zinc-400">
          {formatDateTime(value.occurred_at)} – {formatDateTime(value.ends_at)}
        </p>
      ) : (
        value.occurred_at && <p className="text-xs text-zinc-400">{formatDate(value.occurred_at)}</p>
      )}
    </article>
  );
}

function ActivityTab({
  slug,
  activities,
  canPostUpdates,
  hasPostedToday,
  suggestedTitle,
  suggestedBody,
}: {
  slug: string;
  activities: OrgActivity[];
  canPostUpdates: boolean;
  hasPostedToday: boolean;
  suggestedTitle?: string;
  suggestedBody?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <PostComposer
        slug={slug}
        canPostUpdates={canPostUpdates}
        hasPostedToday={hasPostedToday}
        suggestedTitle={suggestedTitle}
        suggestedBody={suggestedBody}
      />
      {activities.length === 0 && (
        <p className="rounded-2xl border-2 border-beedero-border bg-beedero-white p-4 text-sm text-zinc-500">No posts yet.</p>
      )}
      {activities.map((activity) => (
        <PostCard key={activity.id} slug={slug} activity={activity} />
      ))}
    </div>
  );
}

function TeamMemberAvatar({ name, profilePicture }: { name: string; profilePicture?: string | null }) {
  if (profilePicture) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={profilePicture} alt="" className="size-9 shrink-0 rounded-full object-cover" />
    );
  }
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-500">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function TeamSection({ slug, members, canManage }: { slug: string; members: Member[]; canManage: boolean }) {
  return (
    <div className="rounded-2xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm">
      <h3 className="font-extrabold text-zinc-900">Team</h3>
      <div className="mt-3 flex flex-col gap-2">
        {members.map((member) => (
          <div key={member.id} className="flex items-center justify-between gap-2 text-sm">
            <div className="flex min-w-0 items-center gap-2.5">
              <TeamMemberAvatar name={member.full_name} profilePicture={member.profile_picture} />
              <span className="truncate font-medium text-zinc-900">{member.full_name}</span>
            </div>
            {canManage ? (
              <div className="flex items-center gap-2">
                <form action={updateMemberRoleAction}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="member_id" value={member.id} />
                  <select
                    name="role"
                    defaultValue={member.role}
                    onChange={(e) => e.currentTarget.form?.requestSubmit()}
                    className="rounded-lg border border-beedero-border px-2 py-1 text-xs outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </form>
                <form action={removeMemberAction}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="member_id" value={member.id} />
                  <button className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50">
                    Remove
                  </button>
                </form>
              </div>
            ) : (
              <span className="text-xs font-medium text-zinc-400">{member.role}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function InvitesSection({ slug, invites }: { slug: string; invites: Invite[] }) {
  return (
    <div className="rounded-2xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm">
      <h3 className="font-extrabold text-zinc-900">Invite links</h3>
      <p className="mt-1 text-sm text-zinc-500">Share a link to let someone join your team directly.</p>
      <div className="mt-3 flex flex-col gap-2">
        {invites.length === 0 && <p className="text-sm text-zinc-400">No active invite links.</p>}
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="flex flex-col gap-2 rounded-xl border border-beedero-border bg-zinc-50 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate font-mono text-xs text-zinc-600">/invite/{invite.token}</p>
              <p className="text-xs text-zinc-400">{invite.role} · single use</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/invite/${invite.token}`)}
                className="rounded-lg border border-beedero-border px-2.5 py-1.5 text-xs font-medium hover:bg-beedero-yellow"
              >
                Copy link
              </button>
              <form action={revokeInviteAction}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="invite_id" value={invite.id} />
                <button className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">
                  Revoke
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
      <form
        action={createInviteAction}
        className="mt-3 flex items-center gap-2 border-t border-dashed border-beedero-border pt-3"
      >
        <input type="hidden" name="slug" value={slug} />
        <select name="role" className="rounded-lg border border-beedero-border px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60">
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button className="rounded-lg bg-beedero-yellow px-3 py-1.5 text-xs font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white">
          Create invite link
        </button>
      </form>
    </div>
  );
}

function ProfileAdminSection({
  slug,
  members,
  invites,
  canManage,
  linksSection,
}: {
  slug: string;
  members: Member[];
  invites: Invite[];
  canManage: boolean;
  linksSection?: Section;
}) {
  return (
    <>
      <TeamSection slug={slug} members={members} canManage={canManage} />
      {canManage && <InvitesSection slug={slug} invites={invites} />}
      <div className="rounded-2xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm">
        <h3 className="font-extrabold text-zinc-900">Access</h3>
        <p className="mt-1 text-sm text-zinc-500">
          Grant restricted or private sections to specific people, organizations, or roles.
        </p>
        <Link
          href={`/dashboard/${slug}/access`}
          className="mt-3 inline-flex text-sm font-semibold text-beedero-black underline decoration-beedero-yellow decoration-2 underline-offset-4"
        >
          Manage granted access
        </Link>
      </div>
      <LinksTab slug={slug} section={linksSection} />
    </>
  );
}

const ROUND_STAGE_LABELS: Record<string, string> = {
  pre_seed: "Pre-seed",
  seed: "Seed",
  series_a: "Series A",
};

function FundraisingTab({
  slug,
  isFundraising,
  fundraiseSections,
  roundHistory,
}: {
  slug: string;
  isFundraising: boolean;
  fundraiseSections: Section[];
  roundHistory: FundraiseRound[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-zinc-900">Fundraising round</h3>
            <p className="mt-1 text-sm text-zinc-500">
              {isFundraising ? "A round is currently open." : "No round is open right now."}
            </p>
          </div>
          {isFundraising && (
            <form action={closeRoundAction} className="flex items-end gap-2">
              <input type="hidden" name="slug" value={slug} />
              <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
                Raised
                <input
                  name="raised_amount"
                  type="number"
                  placeholder="Raised amount"
                  className="w-32 rounded-lg border border-beedero-border px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
                />
              </label>
              <button className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
                Close round
              </button>
            </form>
          )}
        </div>
        {!isFundraising && (
          <form action={openRoundAction} className="mt-4 flex flex-wrap items-end gap-2">
            <input type="hidden" name="slug" value={slug} />
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
              Stage
              <select name="stage" className="rounded-lg border border-beedero-border px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60">
                <option value="pre_seed">Pre-seed</option>
                <option value="seed">Seed</option>
                <option value="series_a">Series A</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
              Valuation
              <input
                name="valuation"
                type="number"
                placeholder="Valuation"
                className="w-32 rounded-lg border border-beedero-border px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
              Ask
              <input
                name="ask_amount"
                type="number"
                placeholder="Ask"
                className="w-32 rounded-lg border border-beedero-border px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
              />
            </label>
            <button className="rounded-xl bg-beedero-yellow px-4 py-2 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white">
              Open round
            </button>
          </form>
        )}
      </div>

      <div className="rounded-2xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm">
        <h3 className="font-extrabold text-zinc-900">Round history</h3>
        {roundHistory.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No rounds opened yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-beedero-border text-xs font-medium uppercase tracking-wide text-zinc-500">
                  <th className="py-2 pr-4">Stage</th>
                  <th className="py-2 pr-4">Opened</th>
                  <th className="py-2 pr-4">Closed</th>
                  <th className="py-2 pr-4">Ask</th>
                  <th className="py-2 pr-4">Raised</th>
                </tr>
              </thead>
              <tbody>
                {roundHistory.map((round) => (
                  <tr key={round.id} className="border-b border-beedero-border last:border-0">
                    <td className="py-2 pr-4">
                      {ROUND_STAGE_LABELS[round.stage] ?? round.stage}
                      {round.is_open && (
                        <span className="ml-2 rounded-full bg-beedero-yellow px-2 py-0.5 text-[10px] font-bold text-beedero-black">
                          Open
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4">{formatDate(round.opened_at)}</td>
                    <td className="py-2 pr-4">{formatDate(round.closed_at)}</td>
                    <td className="py-2 pr-4">{formatCurrency(round.ask_amount)}</td>
                    <td className="py-2 pr-4">{formatCurrency(round.raised_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {fundraiseSections.length === 0 && (
        <p className="rounded-2xl border-2 border-beedero-border bg-beedero-white p-4 text-sm text-zinc-500">
          No fundraise sections yet.
        </p>
      )}
      {fundraiseSections.map((section) => (
        <SectionCard key={section.id} slug={slug} section={section} />
      ))}
    </div>
  );
}

function OrgBasicsForm({ org, canManage }: { org: OrgBasics; canManage: boolean }) {
  const [status, formAction, pending] = useActionState(updateOrgProfileAction, null);
  useActionToast(status, pending, {
    successMessage: "Saved.",
    isSuccess: (message) => message === "saved",
  });

  return (
    <form
      action={formAction}
      className="grid gap-3 rounded-2xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm sm:grid-cols-2"
    >
      <input type="hidden" name="slug" value={org.slug} />
      <div className="sm:col-span-2">
        <h3 className="font-extrabold text-zinc-900">Company details</h3>
        <p className="mt-1 text-sm text-zinc-500">Required to publish your organization profile.</p>
      </div>
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 sm:col-span-2">
        One-liner
        <input
          name="one_liner"
          defaultValue={org.one_liner}
          maxLength={140}
          required
          disabled={!canManage}
          className="rounded-lg border border-beedero-border px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60 disabled:bg-zinc-50"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 sm:col-span-2">
        <span>
          Stage{" "}
          <span className="font-normal text-zinc-400">— how far along is your company?</span>
        </span>
        <select
          name="stage"
          defaultValue={org.stage}
          required
          disabled={!canManage}
          className="rounded-lg border border-beedero-border px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60 disabled:bg-zinc-50"
        >
          <option value="" disabled>
            Choose your stage
          </option>
          {STAGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} — {option.description}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
        Sector
        <select
          name="sector"
          defaultValue={org.sector}
          required
          disabled={!canManage}
          className="rounded-lg border border-beedero-border px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60 disabled:bg-zinc-50"
        >
          <option value="" disabled>
            Select sector
          </option>
          {SECTOR_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 sm:col-span-2">
        <span>
          {GEO_FIELD_LABEL}{" "}
          <span className="font-normal text-zinc-400">— where your HQ and main team are</span>
        </span>
        <select
          name="geo"
          defaultValue={org.geo}
          required
          disabled={!canManage}
          className="rounded-lg border border-beedero-border px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60 disabled:bg-zinc-50"
        >
          <option value="" disabled>
            Choose where you&apos;re based
          </option>
          {GEO_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} — {option.description}
            </option>
          ))}
        </select>
        <span className="font-normal leading-relaxed text-zinc-400">{GEO_FIELD_HELP}</span>
      </label>
      {canManage && (
        <div className="flex items-center gap-3 sm:col-span-2">
          <button
            disabled={pending}
            className="self-start rounded-lg border border-beedero-border px-3 py-1.5 text-xs font-medium hover:bg-beedero-yellow disabled:opacity-50"
          >
            {pending ? "Saving..." : "Save"}
          </button>
        </div>
      )}
    </form>
  );
}

const LEVEL_RUNGS = [
  { level: 1, label: CREDIBILITY_LEVEL_LABELS[1] },
  { level: 2, label: CREDIBILITY_LEVEL_LABELS[2] },
  { level: 3, label: CREDIBILITY_LEVEL_LABELS[3] },
  { level: 4, label: CREDIBILITY_LEVEL_LABELS[4] },
];

type VerificationFieldSpec = {
  name: string;
  label: string;
  type: "text" | "date" | "number" | "file";
  required?: boolean;
};

const VERIFICATION_FORMS: Record<string, { label: string; level: number; fields: VerificationFieldSpec[] }> = {
  company_registry: {
    label: "Company registry",
    level: 1,
    fields: [
      { name: "nif", label: "NIF", type: "text", required: true },
      { name: "registry_access_code", label: "Registry access code", type: "text", required: true },
    ],
  },
  founder_role: {
    label: "Founder / role",
    level: 1,
    fields: [{ name: "role", label: "Your role at the company", type: "text", required: true }],
  },
  tax_clearance: {
    label: "Tax clearance (AT)",
    level: 2,
    fields: [
      { name: "valid_until", label: "Certificate valid until", type: "date", required: true },
      { name: "document", label: "Certificate (PDF)", type: "file", required: true },
    ],
  },
  ss_clearance: {
    label: "Social security clearance",
    level: 2,
    fields: [
      { name: "valid_until", label: "Certificate valid until", type: "date", required: true },
      { name: "document", label: "Certificate (PDF)", type: "file", required: true },
    ],
  },
  annual_accounts: {
    label: "Annual accounts",
    level: 3,
    fields: [
      { name: "fiscal_year", label: "Fiscal year", type: "number", required: true },
      { name: "revenue_fy", label: "Revenue", type: "number" },
      { name: "net_income_fy", label: "Net income", type: "number" },
      { name: "equity_fy", label: "Equity", type: "number" },
      { name: "occ_number", label: "OCC accountant number", type: "text", required: true },
      { name: "document", label: "Annual accounts (PDF)", type: "file", required: true },
    ],
  },
};

const STATUS_STYLES: Record<string, string> = {
  verified: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  rejected: "bg-red-100 text-red-700",
  expired: "bg-zinc-200 text-zinc-600",
};

function VerificationForm({ slug, type }: { slug: string; type: string }) {
  const spec = VERIFICATION_FORMS[type];
  const [error, formAction, pending] = useActionState(submitVerificationAction, null);
  useActionToast(error, pending, { successMessage: "Submitted for verification." });

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-2 border-t border-dashed border-beedero-border pt-3">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="type" value={type} />
      <div className="grid gap-2 sm:grid-cols-2">
        {spec.fields.map((field) => (
          <label key={field.name} className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
            {field.label}
            {field.type === "file" ? (
              <input
                type="file"
                name={field.name}
                accept="application/pdf"
                required={field.required}
                className="text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-beedero-yellow file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-beedero-black hover:file:bg-beedero-black hover:file:text-beedero-white"
              />
            ) : (
              <input
                type={field.type}
                name={field.name}
                required={field.required}
                className="rounded-lg border border-beedero-border px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
              />
            )}
          </label>
        ))}
      </div>
      <button
        disabled={pending}
        className="self-start rounded-lg bg-beedero-yellow px-3 py-1.5 text-xs font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
      >
        {pending ? "Submitting..." : "Submit for review"}
      </button>
    </form>
  );
}

function VerificationCard({
  slug,
  type,
  info,
  canManage,
}: {
  slug: string;
  type: string;
  info?: VerificationInfo;
  canManage: boolean;
}) {
  const spec = VERIFICATION_FORMS[type];
  const status = info?.status;
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="rounded-2xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-extrabold text-zinc-900">{spec.label}</h4>
        {status ? (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}>
            {status}
          </span>
        ) : (
          <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-500">
            not submitted
          </span>
        )}
      </div>
      {info?.valid_until && (
        <p className="mt-1 text-xs text-zinc-400">Valid until {formatDate(info.valid_until)}</p>
      )}
      {status === "rejected" && info?.rejection_reason && (
        <p className="mt-1 text-xs text-red-600">Rejected: {info.rejection_reason}</p>
      )}
      {canManage && (status === undefined || status === "rejected" || status === "expired") && !showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mt-3 rounded-lg border border-beedero-border px-2.5 py-1.5 text-xs font-medium hover:bg-beedero-yellow"
        >
          {status ? "Resubmit" : "Submit for review"}
        </button>
      )}
      {canManage && showForm && <VerificationForm slug={slug} type={type} />}
    </div>
  );
}

function CredibilityTab({
  slug,
  credibility,
  canManage,
  badgeEmbed,
  vitality,
}: {
  slug: string;
  credibility: CredibilityInfo;
  canManage: boolean;
  badgeEmbed: BadgeEmbedInfo | null;
  vitality: VitalityInfo | null;
}) {
  const [stripeError, stripeAction, stripePending] = useActionState(connectStripeTractionAction, null);
  useActionToast(stripeError, stripePending, { successMessage: "Stripe connected." });
  const stripeInfo = credibility.verifications["stripe_traction"];

  return (
    <div className="flex flex-col gap-4">
      {canManage && badgeEmbed && vitality && (
        <>
          <BadgeEmbedPanel slug={slug} embed={badgeEmbed} badge={vitality.badge} />
          <VitalityChecklistPanel
            items={vitality.items}
            doneCount={vitality.done_count}
            totalCount={vitality.total_count}
          />
        </>
      )}
      <div className="rounded-2xl border-2 border-beedero-border bg-beedero-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-zinc-900">Credibility ladder</h3>
          <CredibilityBadge level={credibility.level} />
        </div>
        <div className="mt-4 flex items-center gap-1">
          {LEVEL_RUNGS.map((rung) => (
            <div
              key={rung.level}
              title={rung.label}
              className={`h-2 flex-1 rounded-full ${
                credibility.level >= rung.level ? "bg-beedero-yellow" : "bg-zinc-100"
              }`}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          Levels are sequential — a rung only counts once every requirement below it is verified and current.
        </p>
      </div>

      {Object.entries(VERIFICATION_FORMS).map(([type, spec]) => (
        <div key={type} className="flex flex-col gap-2">
          {spec.level === 1 && type === "company_registry" && (
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-400">
              {credibilityLevelHeading(1)}
            </p>
          )}
          {spec.level === 2 && type === "tax_clearance" && (
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-400">
              {credibilityLevelHeading(2)}
            </p>
          )}
          {spec.level === 3 && (
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-400">
              {credibilityLevelHeading(3)}
            </p>
          )}
          <VerificationCard
            slug={slug}
            type={type}
            info={credibility.verifications[type]}
            canManage={canManage}
          />
        </div>
      ))}

      <div className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-400">
          {credibilityLevelHeading(4)}
        </p>
        <div className="rounded-2xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-extrabold text-zinc-900">Stripe</h4>
            {stripeInfo ? (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[stripeInfo.status]}`}>
                {stripeInfo.status}
              </span>
            ) : (
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-500">
                not connected
              </span>
            )}
          </div>
          {stripeInfo?.valid_until && (
            <p className="mt-1 text-xs text-zinc-400">Valid until {formatDate(stripeInfo.valid_until)}</p>
          )}
          {canManage && (
            <form action={stripeAction} className="mt-3">
              <input type="hidden" name="slug" value={slug} />
              <button
                disabled={stripePending}
                className="rounded-lg bg-beedero-yellow px-3 py-1.5 text-xs font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
              >
                {stripePending ? "Connecting..." : stripeInfo ? "Reconnect Stripe" : "Connect Stripe"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export function OrgTabs({
  slug,
  org,
  sections,
  activities,
  events,
  isFundraising,
  roundHistory,
  canPostUpdates,
  hasPostedToday,
  stats,
  members,
  invites,
  canManage,
  onboarding,
  credibility,
  badgeEmbed,
  vitality,
  suggestedTitle,
  suggestedBody,
  initialTab,
}: {
  slug: string;
  org: OrgBasics;
  sections: Section[];
  activities: OrgActivity[];
  events: CalendarEvent[];
  isFundraising: boolean;
  roundHistory: FundraiseRound[];
  canPostUpdates: boolean;
  hasPostedToday: boolean;
  stats: Stats;
  members: Member[];
  invites: Invite[];
  canManage: boolean;
  onboarding: Onboarding;
  credibility: CredibilityInfo;
  badgeEmbed: BadgeEmbedInfo | null;
  vitality: VitalityInfo | null;
  suggestedTitle?: string;
  suggestedBody?: string;
  initialTab?: TabId;
}) {
  const [active, setActive] = useState<TabId>(
    suggestedTitle ? "activity" : (initialTab ?? "overview")
  );
  const router = useRouter();

  useEffect(() => {
    if (initialTab) setActive(initialTab);
  }, [initialTab]);

  function selectTab(tabId: TabId) {
    setActive(tabId);
    router.replace(`/dashboard/${slug}?tab=${tabId}`, { scroll: false });
  }

  const aboutSection = sections.find((s) => s.kind === "about");
  const productsSection = sections.find((s) => s.kind === "products");
  const marketSection = sections.find((s) => s.kind === "market_thesis");
  const fundraiseSections = sections.filter((s) => FUNDRAISE_KINDS.includes(s.kind));
  const linksSection = sections.find((s) => s.kind === "links");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 overflow-x-auto rounded-2xl border-2 border-beedero-border bg-beedero-white p-1.5 shadow-sm">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => selectTab(tab.id)}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              active === tab.id
                ? "bg-beedero-black text-beedero-yellow"
                : "text-beedero-black/65 hover:bg-beedero-yellow hover:text-beedero-black"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === "overview" && (
        <OverviewTab
          slug={slug}
          stats={stats}
          onboarding={onboarding}
          canManage={canManage}
          presence={vitality?.presence ?? null}
        />
      )}

      {active === "calendar" && <EventsCalendar events={events} full />}

      {active === "activity" && (
        <ActivityTab
          slug={slug}
          activities={activities}
          canPostUpdates={canPostUpdates}
          hasPostedToday={hasPostedToday}
          suggestedTitle={suggestedTitle}
          suggestedBody={suggestedBody}
        />
      )}

      {active === "profile" && (
        <div className="flex flex-col gap-4">
          <OrgBasicsForm org={org} canManage={canManage} />
          <AboutProfileSection slug={slug} section={aboutSection} />
          <CuratedProfileSection
            slug={slug}
            section={productsSection}
            kind="products"
            title="Products"
            description="Help investors understand what you sell or offer."
            fields={PRODUCTS_FIELDS}
          />
          <CuratedProfileSection
            slug={slug}
            section={marketSection}
            kind="market_thesis"
            title="Market thesis"
            description="Explain the problem, market, and timing. Use Market to describe where you operate or sell — that is separate from Based in above."
            fields={MARKET_THESIS_FIELDS}
            optional
          />
          <ProfileAdminSection
            slug={slug}
            members={members}
            invites={invites}
            canManage={canManage}
            linksSection={linksSection}
          />
        </div>
      )}

      {active === "fundraising" && (
        <FundraisingTab
          slug={slug}
          isFundraising={isFundraising}
          fundraiseSections={fundraiseSections}
          roundHistory={roundHistory}
        />
      )}

      {active === "credibility" && (
        <CredibilityTab
          slug={slug}
          credibility={credibility}
          canManage={canManage}
          badgeEmbed={badgeEmbed}
          vitality={vitality}
        />
      )}
    </div>
  );
}
