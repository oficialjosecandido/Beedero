import Link from "next/link";
import { notFound } from "next/navigation";

import {
  closeRoundAction,
  deleteFieldAction,
  openRoundAction,
  postFeedAction,
  upsertFieldAction,
} from "../actions";
import { ApiError, apiFetch } from "@/lib/api";
import { SECTION_LABELS } from "@/lib/types";

type SectionField = { id: number; key: string; value: unknown; visibility: string };
type Section = { id: number; kind: string; visibility: string; fields: SectionField[] };
type OrgSummary = { org: { slug: string; name: string; is_fundraising: boolean } };

const ACTIVITY_KINDS = ["news", "milestones", "events", "awards", "press"];
const IDENTITY_KINDS = ["about", "team", "products", "market_thesis"];

export default async function DashboardOrgPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let profile: OrgSummary;
  let sections: Section[];
  try {
    [profile, sections] = await Promise.all([
      apiFetch(`/orgs/${slug}/`),
      apiFetch(`/orgs/${slug}/sections/`),
    ]);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) notFound();
    throw err;
  }
  const profileFieldCount = sections
    .filter((section) => IDENTITY_KINDS.includes(section.kind))
    .reduce((count, section) => count + section.fields.length, 0);
  const canPostUpdates = profileFieldCount >= 5;

  return (
    <div className="flex flex-1 justify-center px-6 py-16">
      <div className="flex w-full max-w-3xl flex-col gap-10">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{profile.org.name}</h1>
            <Link
              href={`/dashboard/${slug}/access`}
              className="mt-2 inline-flex text-sm font-medium text-emerald-700 underline"
            >
              Manage granted access
            </Link>
          </div>
          {profile.org.is_fundraising ? (
            <form action={closeRoundAction}>
              <input type="hidden" name="slug" value={slug} />
              <button className="rounded-full border border-red-300 px-4 py-1.5 text-sm text-red-700 hover:bg-red-50">
                Close round
              </button>
            </form>
          ) : (
            <form action={openRoundAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="slug" value={slug} />
              <select name="stage" className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
                <option value="pre_seed">Pre-seed</option>
                <option value="seed">Seed</option>
                <option value="series_a">Series A</option>
              </select>
              <input
                name="valuation"
                type="number"
                placeholder="Valuation"
                className="w-32 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              />
              <input
                name="ask_amount"
                type="number"
                placeholder="Ask"
                className="w-32 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
              />
              <button className="rounded-full bg-black px-4 py-1.5 text-sm text-white hover:bg-zinc-800">
                Open round
              </button>
            </form>
          )}
        </header>

        <section className="flex flex-col gap-4 border-t border-zinc-200 pt-6">
          <div>
            <h2 className="text-lg font-medium">Post update</h2>
            <p className="mt-1 text-sm text-zinc-500">
              {canPostUpdates
                ? "Your organization profile has enough detail to post updates."
                : `Add ${5 - profileFieldCount} more profile field${
                    5 - profileFieldCount === 1 ? "" : "s"
                  } before posting updates.`}
            </p>
          </div>
          <form action={postFeedAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="slug" value={slug} />
            <select name="kind" className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
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
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            />
            <input
              name="body"
              placeholder="Text"
              className="w-64 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            />
            <button
              disabled={!canPostUpdates}
              className="rounded-full bg-black px-4 py-1.5 text-sm text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Publish
            </button>
          </form>
        </section>

        <section className="flex flex-col gap-6 border-t border-zinc-200 pt-6">
          <h2 className="text-lg font-medium">Sections and fields</h2>
          {sections.map((section) => (
            <div key={section.id} className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{SECTION_LABELS[section.kind] ?? section.kind}</h3>
                <span className="text-xs text-zinc-500">section visibility: {section.visibility}</span>
              </div>
              <div className="flex flex-col gap-2">
                {section.fields.map((field) => (
                  <div key={field.id} className="flex items-center gap-2 text-sm">
                    <span className="w-28 shrink-0 text-zinc-500">{field.key}</span>
                    <form action={upsertFieldAction} className="flex flex-1 items-center gap-2">
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="kind" value={section.kind} />
                      <input type="hidden" name="key" value={field.key} />
                      <input
                        name="value"
                        defaultValue={
                          typeof field.value === "string" ? field.value : JSON.stringify(field.value)
                        }
                        className="flex-1 rounded-md border border-zinc-300 px-2 py-1 text-sm"
                      />
                      <select
                        name="visibility"
                        defaultValue={field.visibility}
                        className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
                      >
                        <option value="public">public</option>
                        <option value="restricted">restricted</option>
                        <option value="private">private</option>
                      </select>
                      <button className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50">
                        Save
                      </button>
                    </form>
                    <form action={deleteFieldAction}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="kind" value={section.kind} />
                      <input type="hidden" name="key" value={field.key} />
                      <button className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50">
                        Delete
                      </button>
                    </form>
                  </div>
                ))}
              </div>
              <form action={upsertFieldAction} className="flex items-center gap-2 border-t border-dashed border-zinc-200 pt-3">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="kind" value={section.kind} />
                <input
                  name="key"
                  placeholder="new key"
                  required
                  className="w-28 rounded-md border border-zinc-300 px-2 py-1 text-sm"
                />
                <input
                  name="value"
                  placeholder="value"
                  required
                  className="flex-1 rounded-md border border-zinc-300 px-2 py-1 text-sm"
                />
                <select name="visibility" className="rounded-md border border-zinc-300 px-2 py-1 text-sm">
                  <option value="">(inherits from section)</option>
                  <option value="public">public</option>
                  <option value="restricted">restricted</option>
                  <option value="private">private</option>
                </select>
                <button className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50">
                  Add
                </button>
              </form>
            </div>
          ))}
        </section>

      </div>
    </div>
  );
}
