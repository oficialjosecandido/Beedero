import Link from "next/link";
import { notFound } from "next/navigation";

import { createGrantAction, deleteGrantAction } from "../../actions";
import { ApiError, apiFetch } from "@/lib/api";
import { SECTION_LABELS } from "@/lib/types";

type SectionField = { id: number; key: string; value: unknown; visibility: string };
type Section = { id: number; kind: string; visibility: string; fields: SectionField[] };
type Grant = {
  id: number;
  section: number | null;
  field: number | null;
  principal_type: string;
  principal_id: string;
  expires_at: string | null;
};
type OrgSummary = { org: { slug: string; name: string } };

export default async function AccessPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let profile: OrgSummary;
  let sections: Section[];
  let grants: Grant[];
  try {
    [profile, sections, grants] = await Promise.all([
      apiFetch(`/orgs/${slug}/`),
      apiFetch(`/orgs/${slug}/sections/`),
      apiFetch(`/orgs/${slug}/grants/`),
    ]);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) notFound();
    throw err;
  }

  return (
    <main className="flex flex-1 justify-center px-6 py-12">
      <div className="flex w-full max-w-3xl flex-col gap-8">
        <header>
          <Link
            href={`/dashboard/${slug}`}
            className="text-sm font-semibold text-beedero-black underline decoration-beedero-yellow decoration-2 underline-offset-4"
          >
            Back to organization
          </Link>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            Granted access for {profile.org.name}
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Manage who can see restricted sections or fields.
          </p>
        </header>

        <section className="grid gap-3">
          {grants.length === 0 && (
            <p className="rounded-2xl border-2 border-beedero-border bg-beedero-white p-4 text-sm text-zinc-500">
              No active grants.
            </p>
          )}
          {grants.map((grant) => (
            <div
              key={grant.id}
              className="flex items-center justify-between rounded-2xl border-2 border-beedero-border bg-beedero-white px-4 py-3 text-sm shadow-sm"
            >
              <span>
                {grant.principal_type}:{grant.principal_id} {"->"}{" "}
                {grant.section ? `section #${grant.section}` : `field #${grant.field}`}
              </span>
              <form action={deleteGrantAction}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="grant_id" value={grant.id} />
                <button className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">
                  Revoke
                </button>
              </form>
            </div>
          ))}
        </section>

        <form
          action={createGrantAction}
          className="grid gap-4 rounded-3xl border-2 border-beedero-border bg-beedero-white p-6 shadow-sm md:grid-cols-2"
        >
          <input type="hidden" name="slug" value={slug} />
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
            Principal type
            <select name="principal_type" className="rounded-xl border border-beedero-border bg-white px-3 py-2 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60">
              <option value="user">user</option>
              <option value="org">org</option>
              <option value="role">role</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
            Principal id
            <input
              name="principal_id"
              placeholder="id or 'verified_investor'"
              required
              className="rounded-xl border border-beedero-border bg-white px-3 py-2 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
            Section
            <select name="section" className="rounded-xl border border-beedero-border bg-white px-3 py-2 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60">
              <option value="">(section)</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {SECTION_LABELS[section.kind] ?? section.kind}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-700">
            Field
            <select name="field" className="rounded-xl border border-beedero-border bg-white px-3 py-2 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60">
              <option value="">(or field)</option>
              {sections.flatMap((section) =>
                section.fields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {section.kind}.{field.key}
                  </option>
                ))
              )}
            </select>
          </label>
          <button className="rounded-xl bg-beedero-yellow px-4 py-2 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white md:col-span-2">
            Grant access
          </button>
        </form>
      </div>
    </main>
  );
}
