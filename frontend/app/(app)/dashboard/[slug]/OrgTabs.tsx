"use client";

import { useState } from "react";

import {
  closeRoundAction,
  deleteFieldAction,
  openRoundAction,
  postFeedAction,
  upsertFieldAction,
} from "../actions";
import { SECTION_LABELS } from "@/lib/types";

type SectionField = { id: number; key: string; value: unknown; visibility: string };
type Section = { id: number; kind: string; visibility: string; fields: SectionField[] };

const ACTIVITY_KINDS = ["news", "milestones", "events", "awards", "press"];
const IDENTITY_KINDS = ["about", "team", "products", "market_thesis"];
const FUNDRAISE_KINDS = ["valuation", "ask", "use_of_funds", "financials", "dataroom", "cap_table"];

const CURATED_LINKS: { key: string; label: string; placeholder: string }[] = [
  { key: "website", label: "Website", placeholder: "https://yourcompany.com" },
  { key: "twitter", label: "Twitter / X", placeholder: "https://x.com/yourhandle" },
  { key: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/company/..." },
  { key: "instagram", label: "Instagram", placeholder: "https://instagram.com/..." },
  { key: "facebook", label: "Facebook", placeholder: "https://facebook.com/..." },
];

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "profile", label: "Profile" },
  { id: "links", label: "Website & Social" },
  { id: "activity", label: "Activity" },
  { id: "fundraising", label: "Fundraising" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function SectionCard({ slug, section }: { slug: string; section: Section }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
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
                className="flex-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
              <select
                name="visibility"
                defaultValue={field.visibility}
                className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm"
              >
                <option value="public">public</option>
                <option value="restricted">restricted</option>
                <option value="private">private</option>
              </select>
              <button className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium hover:bg-zinc-50">
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
          className="w-28 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm"
        />
        <input
          name="value"
          placeholder="value"
          required
          className="flex-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm"
        />
        <select name="visibility" className="rounded-lg border border-zinc-300 px-2 py-1.5 text-sm">
          <option value="">(inherits)</option>
          <option value="public">public</option>
          <option value="restricted">restricted</option>
          <option value="private">private</option>
        </select>
        <button className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800">
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
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
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
                    className="flex-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                  <button className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium hover:bg-zinc-50">
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

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
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
                  className="flex-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm"
                />
                <button className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium hover:bg-zinc-50">
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
            className="w-32 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm"
          />
          <input name="value" placeholder="url" required className="flex-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm" />
          <button className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800">
            Add
          </button>
        </form>
      </div>
    </div>
  );
}

function OverviewTab({
  slug,
  isFundraising,
  canPostUpdates,
  profileFieldCount,
}: {
  slug: string;
  isFundraising: boolean;
  canPostUpdates: boolean;
  profileFieldCount: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
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
              <select name="stage" className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm">
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
                className="w-32 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
              Ask
              <input
                name="ask_amount"
                type="number"
                placeholder="Ask"
                className="w-32 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm"
              />
            </label>
            <button className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
              Open round
            </button>
          </form>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-zinc-900">Post update</h3>
        <p className="mt-1 text-sm text-zinc-500">
          {canPostUpdates
            ? "Your organization profile has enough detail to post updates."
            : `Add ${5 - profileFieldCount} more profile field${
                5 - profileFieldCount === 1 ? "" : "s"
              } before posting updates.`}
        </p>
        <form action={postFeedAction} className="mt-4 flex flex-wrap items-end gap-2">
          <input type="hidden" name="slug" value={slug} />
          <select name="kind" className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm">
            {ACTIVITY_KINDS.map((k) => (
              <option key={k} value={k}>
                {SECTION_LABELS[k]}
              </option>
            ))}
          </select>
          <input
            name="title"
            placeholder="Title"
            required
            className="rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm"
          />
          <input
            name="body"
            placeholder="Text"
            className="w-64 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm"
          />
          <button
            disabled={!canPostUpdates}
            className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Publish
          </button>
        </form>
      </div>
    </div>
  );
}

export function OrgTabs({
  slug,
  sections,
  isFundraising,
  profileFieldCount,
  canPostUpdates,
}: {
  slug: string;
  sections: Section[];
  isFundraising: boolean;
  profileFieldCount: number;
  canPostUpdates: boolean;
}) {
  const [active, setActive] = useState<TabId>("overview");

  const identitySections = sections.filter((s) => IDENTITY_KINDS.includes(s.kind));
  const activitySections = sections.filter((s) => ACTIVITY_KINDS.includes(s.kind));
  const fundraiseSections = sections.filter((s) => FUNDRAISE_KINDS.includes(s.kind));
  const linksSection = sections.find((s) => s.kind === "links");

  const visibleTabs = TABS.filter((tab) => tab.id !== "fundraising" || isFundraising);
  const activeTab: TabId = visibleTabs.some((t) => t.id === active) ? active : "overview";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-sm">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id ? "bg-emerald-700 text-white" : "text-zinc-600 hover:bg-zinc-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <OverviewTab
          slug={slug}
          isFundraising={isFundraising}
          canPostUpdates={canPostUpdates}
          profileFieldCount={profileFieldCount}
        />
      )}

      {activeTab === "profile" && (
        <div className="flex flex-col gap-4">
          {identitySections.map((section) => (
            <SectionCard key={section.id} slug={slug} section={section} />
          ))}
        </div>
      )}

      {activeTab === "links" && <LinksTab slug={slug} section={linksSection} />}

      {activeTab === "activity" && (
        <div className="flex flex-col gap-4">
          {activitySections.map((section) => (
            <SectionCard key={section.id} slug={slug} section={section} />
          ))}
        </div>
      )}

      {activeTab === "fundraising" && (
        <div className="flex flex-col gap-4">
          {fundraiseSections.length === 0 && (
            <p className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500">
              No fundraise sections yet.
            </p>
          )}
          {fundraiseSections.map((section) => (
            <SectionCard key={section.id} slug={slug} section={section} />
          ))}
        </div>
      )}
    </div>
  );
}
