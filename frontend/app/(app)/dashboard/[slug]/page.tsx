import { notFound } from "next/navigation";

import {
  closeRoundAction,
  createGrantAction,
  deleteFieldAction,
  deleteGrantAction,
  openRoundAction,
  postFeedAction,
  upsertFieldAction,
} from "../actions";
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
type OrgSummary = { org: { slug: string; name: string; is_fundraising: boolean } };

const ACTIVITY_KINDS = ["news", "milestones", "events", "awards", "press"];

export default async function DashboardOrgPage({
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
    <div className="flex flex-1 justify-center px-6 py-16">
      <div className="flex w-full max-w-3xl flex-col gap-10">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{profile.org.name}</h1>
          {profile.org.is_fundraising ? (
            <form action={closeRoundAction}>
              <input type="hidden" name="slug" value={slug} />
              <button className="rounded-full border border-red-300 px-4 py-1.5 text-sm text-red-700 hover:bg-red-50">
                Fechar ronda
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
                Abrir ronda
              </button>
            </form>
          )}
        </header>

        <section className="flex flex-col gap-4 border-t border-zinc-200 pt-6">
          <h2 className="text-lg font-medium">Publicar novidade</h2>
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
              placeholder="Título"
              required
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            />
            <input
              name="body"
              placeholder="Texto"
              className="w-64 rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            />
            <button className="rounded-full bg-black px-4 py-1.5 text-sm text-white hover:bg-zinc-800">
              Publicar
            </button>
          </form>
        </section>

        <section className="flex flex-col gap-6 border-t border-zinc-200 pt-6">
          <h2 className="text-lg font-medium">Secções e campos</h2>
          {sections.map((section) => (
            <div key={section.id} className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{SECTION_LABELS[section.kind] ?? section.kind}</h3>
                <span className="text-xs text-zinc-500">visibilidade da secção: {section.visibility}</span>
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
                        Guardar
                      </button>
                    </form>
                    <form action={deleteFieldAction}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="kind" value={section.kind} />
                      <input type="hidden" name="key" value={field.key} />
                      <button className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50">
                        Apagar
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
                  placeholder="nova chave"
                  required
                  className="w-28 rounded-md border border-zinc-300 px-2 py-1 text-sm"
                />
                <input
                  name="value"
                  placeholder="valor"
                  required
                  className="flex-1 rounded-md border border-zinc-300 px-2 py-1 text-sm"
                />
                <select name="visibility" className="rounded-md border border-zinc-300 px-2 py-1 text-sm">
                  <option value="">(herda da secção)</option>
                  <option value="public">public</option>
                  <option value="restricted">restricted</option>
                  <option value="private">private</option>
                </select>
                <button className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50">
                  Adicionar
                </button>
              </form>
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-4 border-t border-zinc-200 pt-6">
          <h2 className="text-lg font-medium">Acessos concedidos</h2>
          <div className="flex flex-col gap-2">
            {grants.length === 0 && <p className="text-sm text-zinc-500">Nenhum grant ativo.</p>}
            {grants.map((g) => (
              <div key={g.id} className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 text-sm">
                <span>
                  {g.principal_type}:{g.principal_id} → {g.section ? `secção #${g.section}` : `campo #${g.field}`}
                </span>
                <form action={deleteGrantAction}>
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="grant_id" value={g.id} />
                  <button className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50">
                    Revogar
                  </button>
                </form>
              </div>
            ))}
          </div>
          <form action={createGrantAction} className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="slug" value={slug} />
            <select name="principal_type" className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
              <option value="user">user</option>
              <option value="org">org</option>
              <option value="role">role</option>
            </select>
            <input
              name="principal_id"
              placeholder="id ou 'verified_investor'"
              required
              className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
            />
            <select name="section" className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
              <option value="">(secção)</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {SECTION_LABELS[s.kind] ?? s.kind}
                </option>
              ))}
            </select>
            <select name="field" className="rounded-md border border-zinc-300 px-2 py-1.5 text-sm">
              <option value="">(ou campo)</option>
              {sections.flatMap((s) =>
                s.fields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {s.kind}.{f.key}
                  </option>
                ))
              )}
            </select>
            <button className="rounded-full bg-black px-4 py-1.5 text-sm text-white hover:bg-zinc-800">
              Conceder acesso
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
