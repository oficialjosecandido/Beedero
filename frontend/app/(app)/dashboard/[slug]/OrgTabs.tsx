"use client";

import Link from "next/link";
import { useState } from "react";
import { useActionState } from "react";

import {
  activateOrgAction,
  closeRoundAction,
  createInviteAction,
  deleteFieldAction,
  openRoundAction,
  postFeedAction,
  removeMemberAction,
  revokeInviteAction,
  updateMemberRoleAction,
  updateOrgProfileAction,
  upsertFieldAction,
} from "../actions";
import { VerifyEmailBanner } from "@/components/VerifyEmailBanner";
import { SECTION_LABELS } from "@/lib/types";

type SectionField = {
  id: number;
  key: string;
  value: unknown;
  visibility: string;
  created_at?: string;
};
type Section = { id: number; kind: string; visibility: string; fields: SectionField[] };
type OrgBasics = { slug: string; name: string; one_liner: string; stage: string; sector: string; geo: string };
type Stats = { followers_count: number; visitors_count: number };
type Member = { id: number; email: string; role: string };
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
  checklist: { key: string; done: boolean; hint: string }[];
  fee: { amount_cents: number; status: string; refund_as_credit: boolean } | null;
};
type PostValue = { title?: string; body?: string; occurred_at?: string; image?: string };

const ACTIVITY_KINDS = ["news", "milestones", "events", "awards", "press"];
const IDENTITY_KINDS = ["about", "team", "products", "market_thesis"];
const FUNDRAISE_KINDS = ["valuation", "ask", "use_of_funds", "financials", "dataroom", "cap_table"];
const ROLE_OPTIONS = ["owner", "admin", "member"];

const POST_KIND_OPTIONS = [
  { value: "milestones", label: "Milestone" },
  { value: "events", label: "Event" },
  { value: "news", label: "Update" },
];

const STAGES = ["idea", "pre_seed", "seed", "series_a", "growth"];
const SECTORS = ["software", "fintech", "health", "climate", "consumer", "marketplace", "other"];
const GEOGRAPHIES = ["portugal", "europe", "north_america", "latin_america", "remote", "other"];

const CURATED_LINKS: { key: string; label: string; placeholder: string }[] = [
  { key: "website", label: "Website", placeholder: "https://yourcompany.com" },
  { key: "twitter", label: "Twitter / X", placeholder: "https://x.com/yourhandle" },
  { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/company/..." },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/..." },
  { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/..." },
];

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "activity", label: "Activity" },
  { id: "configurations", label: "Configurations" },
  { id: "profile", label: "Profile" },
  { id: "fundraising", label: "Fundraising" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function collectPosts(sections: Section[]) {
  return sections
    .filter((s) => ACTIVITY_KINDS.includes(s.kind))
    .flatMap((section) =>
      section.fields
        .filter((f) => f.key.startsWith("post_"))
        .map((field) => ({ section, field, value: field.value as PostValue }))
    )
    .sort((a, b) => (b.value.occurred_at ?? "").localeCompare(a.value.occurred_at ?? ""));
}

function SectionCard({ slug, section }: { slug: string; section: Section }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-beedero-black/10 bg-beedero-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-zinc-900">{SECTION_LABELS[section.kind] ?? section.kind}</h3>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500">
          {section.visibility}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {section.fields.length === 0 && <p className="text-sm text-zinc-400">No fields yet.</p>}
        {section.fields.map((field) => (
          <div key={field.id} className="flex items-center gap-2 text-sm">
            <span className="w-28 shrink-0 truncate text-zinc-500">{field.key}</span>
            <form action={upsertFieldAction} className="flex flex-1 items-center gap-2">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="kind" value={section.kind} />
              <input type="hidden" name="key" value={field.key} />
              <input
                name="value"
                defaultValue={typeof field.value === "string" ? field.value : JSON.stringify(field.value)}
                className="flex-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
              />
              <select
                name="visibility"
                defaultValue={field.visibility}
                className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
              >
                <option value="public">public</option>
                <option value="restricted">restricted</option>
                <option value="private">private</option>
              </select>
              <button className="rounded-lg border border-beedero-black/15 px-2.5 py-1.5 text-xs font-medium hover:bg-beedero-yellow">
                Save
              </button>
            </form>
            <form action={deleteFieldAction}>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="kind" value={section.kind} />
              <input type="hidden" name="key" value={field.key} />
              <button className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">
                Delete
              </button>
            </form>
          </div>
        ))}
      </div>
      <form
        action={upsertFieldAction}
        className="flex items-center gap-2 border-t border-dashed border-zinc-200 pt-3"
      >
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="kind" value={section.kind} />
        <input
          name="key"
          placeholder="new key"
          required
          className="w-28 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
        />
        <input
          name="value"
          placeholder="value"
          required
          className="flex-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
        />
        <select name="visibility" className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60">
          <option value="">(inherits)</option>
          <option value="public">public</option>
          <option value="restricted">restricted</option>
          <option value="private">private</option>
        </select>
        <button className="rounded-lg bg-beedero-yellow px-3 py-1.5 text-xs font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white">
          Add
        </button>
      </form>
    </div>
  );
}

function LinksTab({ slug, section }: { slug: string; section?: Section }) {
  const fields = section?.fields ?? [];
  const curatedKeys = new Set(CURATED_LINKS.map((l) => l.key));
  const customFields = fields.filter((f) => !curatedKeys.has(f.key));

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-beedero-black/10 bg-beedero-white p-5 shadow-sm">
        <h3 className="font-semibold text-zinc-900">Website &amp; social media</h3>
        <p className="mt-1 text-sm text-zinc-500">
          Shown on your public profile so investors and partners can find you.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          {CURATED_LINKS.map(({ key, label, placeholder }) => {
            const field = fields.find((f) => f.key === key);
            return (
              <div key={key} className="flex items-center gap-2 text-sm">
                <span className="w-24 shrink-0 font-medium text-zinc-600">{label}</span>
                <form action={upsertFieldAction} className="flex flex-1 items-center gap-2">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="kind" value="links" />
                  <input type="hidden" name="key" value={key} />
                  <input
                    name="value"
                    placeholder={placeholder}
                    defaultValue={typeof field?.value === "string" ? field.value : ""}
                    className="flex-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
                  />
                  <button className="rounded-lg border border-beedero-black/15 px-2.5 py-1.5 text-xs font-medium hover:bg-beedero-yellow">
                    Save
                  </button>
                </form>
                {field && (
                  <form action={deleteFieldAction}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="kind" value="links" />
                    <input type="hidden" name="key" value={key} />
                    <button className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">
                      Clear
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-beedero-black/10 bg-beedero-white p-5 shadow-sm">
        <h3 className="font-semibold text-zinc-900">Other links</h3>
        <div className="mt-3 flex flex-col gap-2">
          {customFields.length === 0 && <p className="text-sm text-zinc-400">No custom links yet.</p>}
          {customFields.map((field) => (
            <div key={field.id} className="flex items-center gap-2 text-sm">
              <span className="w-28 shrink-0 truncate text-zinc-500">{field.key}</span>
              <form action={upsertFieldAction} className="flex flex-1 items-center gap-2">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="kind" value="links" />
                <input type="hidden" name="key" value={field.key} />
                <input
                  name="value"
                  defaultValue={typeof field.value === "string" ? field.value : JSON.stringify(field.value)}
                  className="flex-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
                />
                <button className="rounded-lg border border-beedero-black/15 px-2.5 py-1.5 text-xs font-medium hover:bg-beedero-yellow">
                  Save
                </button>
              </form>
              <form action={deleteFieldAction}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="kind" value="links" />
                <input type="hidden" name="key" value={field.key} />
                <button className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">
                  Delete
                </button>
              </form>
            </div>
          ))}
        </div>
        <form
          action={upsertFieldAction}
          className="mt-3 flex items-center gap-2 border-t border-dashed border-zinc-200 pt-3"
        >
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="kind" value="links" />
          <input
            name="key"
            placeholder="label, e.g. crunchbase"
            required
            className="w-32 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
          />
          <input name="value" placeholder="url" required className="flex-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60" />
          <button className="rounded-lg bg-beedero-yellow px-3 py-1.5 text-xs font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white">
            Add
          </button>
        </form>
      </div>
    </div>
  );
}

const CHECKLIST_LABELS: Record<string, string> = {
  logo: "Logo",
  about: "About",
  team: "Team",
  products: "Products",
  market: "Market thesis",
};

function OnboardingPanel({
  slug,
  onboarding,
  isEmailVerified,
}: {
  slug: string;
  onboarding: Onboarding;
  isEmailVerified: boolean;
}) {
  const [error, formAction, pending] = useActionState(activateOrgAction, null);

  return (
    <div className="rounded-2xl border border-beedero-black/10 bg-beedero-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-zinc-900">Profile strength</h3>
        <span className="text-sm font-medium text-zinc-500">{onboarding.completeness}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-2 rounded-full bg-beedero-yellow transition-all"
          style={{ width: `${onboarding.completeness}%` }}
        />
      </div>
      <ul className="mt-4 flex flex-col gap-1.5">
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
      {onboarding.status === "draft" ? (
        <>
          {!isEmailVerified && <VerifyEmailBanner />}
          <form action={formAction} className="mt-4">
            <input type="hidden" name="slug" value={slug} />
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-beedero-yellow px-4 py-2 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:opacity-50"
            >
              {pending ? "Publishing..." : "Publish organization"}
            </button>
            <p className="mt-2 text-xs text-zinc-400">
              Publishing is free. You just need a verified email.
            </p>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </form>
        </>
      ) : (
        <p className="mt-4 rounded-xl bg-beedero-yellow/25 px-3 py-2 text-sm font-semibold text-beedero-black">
          Your organization is live and visible to investors 🎉
        </p>
      )}
    </div>
  );
}

function OverviewTab({
  slug,
  stats,
  onboarding,
  isEmailVerified,
}: {
  slug: string;
  stats: Stats;
  onboarding: Onboarding | null;
  isEmailVerified: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {onboarding && (
        <OnboardingPanel slug={slug} onboarding={onboarding} isEmailVerified={isEmailVerified} />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-beedero-black/10 bg-beedero-white p-6 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Followers</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{stats.followers_count}</p>
        </div>
        <div className="rounded-2xl border border-beedero-black/10 bg-beedero-white p-6 shadow-sm">
          <p className="text-sm font-medium text-zinc-500">Profile visitors</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{stats.visitors_count}</p>
          <p className="mt-1 text-xs text-zinc-400">
            Distinct people outside your organization who viewed this profile.
          </p>
        </div>
      </div>
    </div>
  );
}

function PostComposer({
  slug,
  canPostUpdates,
  hasPostedToday,
  profileFieldCount,
}: {
  slug: string;
  canPostUpdates: boolean;
  hasPostedToday: boolean;
  profileFieldCount: number;
}) {
  const [error, formAction, pending] = useActionState(postFeedAction, null);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-2xl border border-beedero-black/10 bg-beedero-white p-5 shadow-sm"
    >
      <input type="hidden" name="slug" value={slug} />
      <h3 className="font-semibold text-zinc-900">Share an update</h3>
      <p className="text-sm text-zinc-500">
        {hasPostedToday
          ? "This profile has already shared today's post. Come back tomorrow."
          : canPostUpdates
            ? "Milestones, events, and updates appear in your followers' feed."
            : `Add ${5 - profileFieldCount} more profile field${
                5 - profileFieldCount === 1 ? "" : "s"
              } before posting updates.`}
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
          Type
          <select name="kind" className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60">
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
          required
          className="min-w-[10rem] flex-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
        />
      </div>
      <textarea
        name="body"
        placeholder="Say more..."
        rows={3}
        className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
      />
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
        Photo (optional)
        <input
          type="file"
          name="image"
          accept="image/*"
          className="text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-beedero-yellow file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-beedero-black hover:file:bg-beedero-black hover:file:text-beedero-white"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        disabled={!canPostUpdates || pending}
        className="self-start rounded-xl bg-beedero-yellow px-4 py-2 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Publishing..." : "Publish"}
      </button>
    </form>
  );
}

function PostCard({
  slug,
  kind,
  field,
  value,
}: {
  slug: string;
  kind: string;
  field: SectionField;
  value: PostValue;
}) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-beedero-black/10 bg-beedero-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-500">
          {SECTION_LABELS[kind] ?? kind}
        </span>
        <form action={deleteFieldAction}>
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="key" value={field.key} />
          <button className="text-xs font-medium text-red-700 hover:underline">Delete</button>
        </form>
      </div>
      {value.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value.image} alt="" className="max-h-72 w-full rounded-xl object-cover" />
      )}
      <h3 className="text-lg font-semibold text-zinc-900">{value.title ?? "Update"}</h3>
      {value.body && <p className="text-sm leading-6 text-zinc-600">{value.body}</p>}
      {value.occurred_at && (
        <p className="text-xs text-zinc-400">{new Date(value.occurred_at).toLocaleDateString()}</p>
      )}
    </article>
  );
}

function ActivityTab({
  slug,
  sections,
  canPostUpdates,
  hasPostedToday,
  profileFieldCount,
}: {
  slug: string;
  sections: Section[];
  canPostUpdates: boolean;
  hasPostedToday: boolean;
  profileFieldCount: number;
}) {
  const posts = collectPosts(sections);
  return (
    <div className="flex flex-col gap-4">
      <PostComposer
        slug={slug}
        canPostUpdates={canPostUpdates}
        hasPostedToday={hasPostedToday}
        profileFieldCount={profileFieldCount}
      />
      {posts.length === 0 && (
        <p className="rounded-2xl border border-beedero-black/10 bg-beedero-white p-4 text-sm text-zinc-500">No posts yet.</p>
      )}
      {posts.map(({ section, field, value }) => (
        <PostCard key={field.id} slug={slug} kind={section.kind} field={field} value={value} />
      ))}
    </div>
  );
}

function TeamSection({ slug, members, canManage }: { slug: string; members: Member[]; canManage: boolean }) {
  return (
    <div className="rounded-2xl border border-beedero-black/10 bg-beedero-white p-5 shadow-sm">
      <h3 className="font-semibold text-zinc-900">Team</h3>
      <div className="mt-3 flex flex-col gap-2">
        {members.map((member) => (
          <div key={member.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate text-zinc-700">{member.email}</span>
            {canManage ? (
              <div className="flex items-center gap-2">
                <form action={updateMemberRoleAction}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="member_id" value={member.id} />
                  <select
                    name="role"
                    defaultValue={member.role}
                    onChange={(e) => e.currentTarget.form?.requestSubmit()}
                    className="rounded-lg border border-zinc-300 px-2 py-1 text-xs outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
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
    <div className="rounded-2xl border border-beedero-black/10 bg-beedero-white p-5 shadow-sm">
      <h3 className="font-semibold text-zinc-900">Invite links</h3>
      <p className="mt-1 text-sm text-zinc-500">Share a link to let someone join your team directly.</p>
      <div className="mt-3 flex flex-col gap-2">
        {invites.length === 0 && <p className="text-sm text-zinc-400">No active invite links.</p>}
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="flex flex-col gap-2 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate font-mono text-xs text-zinc-600">/invite/{invite.token}</p>
              <p className="text-xs text-zinc-400">
                {invite.role} · used {invite.uses_count}x
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/invite/${invite.token}`)}
                className="rounded-lg border border-beedero-black/15 px-2.5 py-1.5 text-xs font-medium hover:bg-beedero-yellow"
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
        className="mt-3 flex items-center gap-2 border-t border-dashed border-zinc-200 pt-3"
      >
        <input type="hidden" name="slug" value={slug} />
        <select name="role" className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60">
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

function ConfigurationsTab({
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
    <div className="flex flex-col gap-4">
      <TeamSection slug={slug} members={members} canManage={canManage} />
      {canManage && <InvitesSection slug={slug} invites={invites} />}
      <div className="rounded-2xl border border-beedero-black/10 bg-beedero-white p-5 shadow-sm">
        <h3 className="font-semibold text-zinc-900">Access</h3>
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
    </div>
  );
}

function FundraisingTab({
  slug,
  isFundraising,
  fundraiseSections,
}: {
  slug: string;
  isFundraising: boolean;
  fundraiseSections: Section[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-beedero-black/10 bg-beedero-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-zinc-900">Fundraising round</h3>
            <p className="mt-1 text-sm text-zinc-500">
              {isFundraising ? "A round is currently open." : "No round is open right now."}
            </p>
          </div>
          {isFundraising && (
            <form action={closeRoundAction}>
              <input type="hidden" name="slug" value={slug} />
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
              <select name="stage" className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60">
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
                className="w-32 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
              Ask
              <input
                name="ask_amount"
                type="number"
                placeholder="Ask"
                className="w-32 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
              />
            </label>
            <button className="rounded-xl bg-beedero-yellow px-4 py-2 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white">
              Open round
            </button>
          </form>
        )}
      </div>

      {fundraiseSections.length === 0 && (
        <p className="rounded-2xl border border-beedero-black/10 bg-beedero-white p-4 text-sm text-zinc-500">
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
  return (
    <form
      action={updateOrgProfileAction}
      className="grid gap-3 rounded-2xl border border-beedero-black/10 bg-beedero-white p-5 shadow-sm sm:grid-cols-2"
    >
      <input type="hidden" name="slug" value={org.slug} />
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 sm:col-span-2">
        One-liner
        <input
          name="one_liner"
          defaultValue={org.one_liner}
          maxLength={140}
          disabled={!canManage}
          className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60 disabled:bg-zinc-50"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
        Stage
        <select
          name="stage"
          defaultValue={org.stage}
          disabled={!canManage}
          className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60 disabled:bg-zinc-50"
        >
          <option value="">—</option>
          {STAGES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
        Sector
        <select
          name="sector"
          defaultValue={org.sector}
          disabled={!canManage}
          className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60 disabled:bg-zinc-50"
        >
          <option value="">—</option>
          {SECTORS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 sm:col-span-2">
        Geography
        <select
          name="geo"
          defaultValue={org.geo}
          disabled={!canManage}
          className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60 disabled:bg-zinc-50"
        >
          <option value="">—</option>
          {GEOGRAPHIES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      {canManage && (
        <button className="self-start rounded-lg border border-beedero-black/15 px-3 py-1.5 text-xs font-medium hover:bg-beedero-yellow sm:col-span-2">
          Save
        </button>
      )}
    </form>
  );
}

export function OrgTabs({
  slug,
  org,
  sections,
  isFundraising,
  profileFieldCount,
  canPostUpdates,
  hasPostedToday,
  stats,
  members,
  invites,
  canManage,
  onboarding,
  isEmailVerified,
}: {
  slug: string;
  org: OrgBasics;
  sections: Section[];
  isFundraising: boolean;
  profileFieldCount: number;
  canPostUpdates: boolean;
  hasPostedToday: boolean;
  stats: Stats;
  members: Member[];
  invites: Invite[];
  canManage: boolean;
  onboarding: Onboarding | null;
  isEmailVerified: boolean;
}) {
  const [active, setActive] = useState<TabId>("overview");

  const identitySections = sections.filter((s) => IDENTITY_KINDS.includes(s.kind));
  const fundraiseSections = sections.filter((s) => FUNDRAISE_KINDS.includes(s.kind));
  const linksSection = sections.find((s) => s.kind === "links");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-beedero-black/10 bg-beedero-white p-1.5 shadow-sm">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
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
          isEmailVerified={isEmailVerified}
        />
      )}

      {active === "activity" && (
        <ActivityTab
          slug={slug}
          sections={sections}
          canPostUpdates={canPostUpdates}
          hasPostedToday={hasPostedToday}
          profileFieldCount={profileFieldCount}
        />
      )}

      {active === "configurations" && (
        <ConfigurationsTab
          slug={slug}
          members={members}
          invites={invites}
          canManage={canManage}
          linksSection={linksSection}
        />
      )}

      {active === "profile" && (
        <div className="flex flex-col gap-4">
          <OrgBasicsForm org={org} canManage={canManage} />
          {identitySections.map((section) => (
            <SectionCard key={section.id} slug={slug} section={section} />
          ))}
        </div>
      )}

      {active === "fundraising" && (
        <FundraisingTab slug={slug} isFundraising={isFundraising} fundraiseSections={fundraiseSections} />
      )}
    </div>
  );
}
