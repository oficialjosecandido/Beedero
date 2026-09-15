"use client";

import Link from "next/link";

import { PROMPT_FIELDS, sectorLabel, strengthLabel, type BuilderCard } from "@/lib/cofounder-options";
import { formatAtHandle } from "@/lib/handles";

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-beedero-border px-2.5 py-1 text-xs font-medium text-zinc-700">
      {children}
    </span>
  );
}

/** The card itself. The verification seal sits next to the name, above the
 * fold and above everything else on the card (doc §9) — it's the reason to
 * take the person seriously, so it isn't buried under a bio. */
export function BuilderCardView({ card, compact = false }: { card: BuilderCard; compact?: boolean }) {
  const prompts = PROMPT_FIELDS.filter((field) => card.prompts?.[field.key]);

  return (
    <article className="flex flex-col gap-4 rounded-3xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm sm:p-6">
      <header className="flex items-start gap-3">
        {card.profile_picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            loading="lazy"
            src={card.profile_picture}
            alt=""
            className="size-14 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-lg font-semibold text-zinc-500">
            {card.name.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {card.handle ? (
              <Link
                href={`/p/${card.handle}`}
                className="text-base font-bold text-zinc-950 hover:underline"
              >
                {card.name}
              </Link>
            ) : (
              <p className="text-base font-bold text-zinc-950">{card.name}</p>
            )}
            {card.is_verified && (
              <span className="rounded-full bg-beedero-yellow px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-beedero-black">
                Verified identity
              </span>
            )}
          </div>
          {card.handle && (
            <p className="text-xs font-medium text-zinc-500">{formatAtHandle(card.handle)}</p>
          )}
          {card.headline && <p className="mt-1 text-sm text-zinc-600">{card.headline}</p>}
        </div>
      </header>

      {card.attestations?.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-2xl bg-zinc-50/70 px-4 py-3">
          {card.attestations.slice(0, 3).map((attestation) => (
            <li key={`${attestation.kind}-${attestation.label}`} className="text-xs text-zinc-600">
              <span className="font-semibold text-zinc-800">{attestation.label}</span>
              {attestation.detail ? ` — ${attestation.detail}` : ""}
            </li>
          ))}
        </ul>
      )}

      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Brings</dt>
          <dd className="mt-1 text-sm font-semibold text-zinc-900">
            {card.primary_strength_label || strengthLabel(card.primary_strength)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Looking for</dt>
          <dd className="mt-1 text-sm font-semibold text-zinc-900">
            {(card.looking_for ?? []).map(strengthLabel).join(", ") || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Commitment</dt>
          <dd className="mt-1 text-sm font-semibold text-zinc-900">
            {card.commitment_label || "—"}
          </dd>
        </div>
        {card.country && (
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Based in</dt>
            <dd className="mt-1 text-sm font-semibold text-zinc-900">{card.country}</dd>
          </div>
        )}
      </dl>

      {card.has_idea && card.idea_pitch && (
        <div className="rounded-2xl border border-beedero-border px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
            Already working on something
          </p>
          <p className="mt-1 text-sm leading-6 text-zinc-800">{card.idea_pitch}</p>
        </div>
      )}

      {!compact && prompts.length > 0 && (
        <div className="flex flex-col gap-3">
          {prompts.map((field) => (
            <div key={field.key}>
              <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                {field.label}
              </p>
              <p className="mt-1 text-sm leading-6 text-zinc-800">{card.prompts[field.key]}</p>
            </div>
          ))}
        </div>
      )}

      {(card.skills?.length > 0 || card.sectors?.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {(card.skills ?? []).slice(0, 8).map((skill) => (
            <Chip key={`skill-${skill}`}>{skill}</Chip>
          ))}
          {(card.sectors ?? []).map((sector) => (
            <Chip key={`sector-${sector}`}>{sectorLabel(sector)}</Chip>
          ))}
        </div>
      )}
    </article>
  );
}
