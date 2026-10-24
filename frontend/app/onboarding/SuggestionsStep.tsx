"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { OnboardingSuggestions, SuggestedOrg, SuggestedPerson } from "@/lib/types";

import { connectWithPersonAction, finishOnboardingAction, followOrgAction } from "./actions";

/**
 * §6.3's closing screen — "sugestões para seguir (5 pessoas/orgs da mesma
 * cidade e área) para o feed não aparecer vazio".
 *
 * Two different verbs, deliberately not flattened into one: an org is followed
 * and its updates are in the feed immediately, while a person gets a
 * connection request that they have to accept first. Labelling both "Follow"
 * would promise a feed that the second one does not deliver.
 *
 * Acting on a card is also not required to leave. The whole screen is a
 * suggestion, and the continue button is always live.
 */
export function SuggestionsStep({ data }: { data: OnboardingSuggestions }) {
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [finishing, startFinishing] = useTransition();

  const hasLocal = data.orgs.some((org) => org.is_local) || data.people.length > 0;
  // A brand-new profile is below the ladder's gate (photo, a few lines, one
  // role and three skills), so "Connect" would fail. The people still show —
  // they are the reason to finish — with "View" instead.
  const canConnect = data.can_connect ?? true;

  async function act(key: string, run: () => Promise<{ ok: true } | { error: string }>) {
    setBusy(key);
    const result = await run();
    setBusy(null);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setDone((previous) => ({ ...previous, [key]: true }));
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-zinc-600">
        {hasLocal && data.city
          ? `People and startups in ${data.city}. Follow a few and your feed starts with something in it.`
          : /* Said plainly rather than dressed up as local: the backend tells
               us whether this city has a scene yet, and implying one it does
               not have is the kind of detail that costs trust later. */
            "Nobody from your city is on Beedero yet. These are worth following in the meantime."}
      </p>

      {data.orgs.length > 0 && (
        <ul className="flex flex-col gap-3">
          {data.orgs.map((org) => (
            <OrgCard
              key={org.slug}
              org={org}
              done={Boolean(done[`org:${org.slug}`])}
              busy={busy === `org:${org.slug}`}
              onFollow={() => act(`org:${org.slug}`, () => followOrgAction(org.slug))}
            />
          ))}
        </ul>
      )}

      {data.people.length > 0 && !canConnect && (
        <p className="rounded-2xl border-2 border-beedero-yellow bg-beedero-yellow/10 px-4 py-3 text-sm text-zinc-700">
          You can ask people to connect once your profile has a photo, a few lines about your work
          and three skills. Your profile page shows what&apos;s left.
        </p>
      )}

      {data.people.length > 0 && (
        <ul className="flex flex-col gap-3">
          {data.people.map((person) => (
            <PersonCard
              key={person.handle}
              person={person}
              done={Boolean(done[`person:${person.handle}`])}
              busy={busy === `person:${person.handle}`}
              canConnect={canConnect}
              onConnect={() =>
                act(`person:${person.handle}`, () => connectWithPersonAction(person.user_id))
              }
            />
          ))}
        </ul>
      )}

      {data.orgs.length === 0 && data.people.length === 0 && (
        <p className="rounded-2xl border-2 border-beedero-border bg-beedero-white px-4 py-6 text-sm text-zinc-600">
          Nothing to suggest yet — you&apos;re early. Your feed will fill as organisations
          publish.
        </p>
      )}

      <form action={() => startFinishing(() => finishOnboardingAction())}>
        <button
          type="submit"
          disabled={finishing}
          className="rounded-xl bg-beedero-black px-5 py-2.5 text-sm font-bold text-beedero-yellow transition hover:bg-beedero-yellow hover:text-beedero-black disabled:opacity-60"
        >
          {finishing ? "Finishing…" : "Done"}
        </button>
      </form>
    </div>
  );
}

function Card({
  avatar,
  initial,
  rounded,
  title,
  subtitle,
  meta,
  action,
}: {
  avatar: string | null;
  initial: string;
  rounded: string;
  title: React.ReactNode;
  subtitle: string;
  meta: React.ReactNode;
  action: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border-2 border-beedero-border bg-beedero-white p-4">
      {avatar ? (
        // Plain <img>, as everywhere else that shows uploads: avatars live on
        // the storage host, which next/image is not configured for — and since
        // the ladder's gate, every suggested person has a photo.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar}
          alt=""
          width={44}
          height={44}
          loading="lazy"
          className={`size-11 shrink-0 object-cover ${rounded}`}
        />
      ) : (
        <span
          aria-hidden
          className={`flex size-11 shrink-0 items-center justify-center bg-beedero-yellow text-sm font-black text-beedero-black ${rounded}`}
        >
          {initial}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-zinc-950">{title}</p>
        {subtitle && <p className="truncate text-xs text-zinc-600">{subtitle}</p>}
        {meta}
      </div>
      {action}
    </li>
  );
}

const ACTION_CLASS =
  "shrink-0 rounded-xl border-2 border-beedero-border px-3.5 py-2 text-xs font-bold text-beedero-black transition hover:bg-beedero-yellow/25 disabled:opacity-60";

function OrgCard({
  org,
  done,
  busy,
  onFollow,
}: {
  org: SuggestedOrg;
  done: boolean;
  busy: boolean;
  onFollow: () => void;
}) {
  return (
    <Card
      avatar={org.logo}
      initial={org.name.slice(0, 1).toUpperCase()}
      rounded="rounded-xl"
      title={
        <>
          {org.name}
          {org.is_verified && (
            <span className="ml-2 rounded-full bg-beedero-yellow px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-beedero-black">
              Verified
            </span>
          )}
        </>
      }
      subtitle={org.one_liner}
      meta={
        org.is_local ? (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Hiring team in your city
          </p>
        ) : null
      }
      action={
        <button type="button" onClick={onFollow} disabled={busy || done} className={ACTION_CLASS}>
          {done ? "Following" : busy ? "…" : "Follow"}
        </button>
      }
    />
  );
}

function PersonCard({
  person,
  done,
  busy,
  canConnect,
  onConnect,
}: {
  person: SuggestedPerson;
  done: boolean;
  busy: boolean;
  canConnect: boolean;
  onConnect: () => void;
}) {
  return (
    <Card
      avatar={person.avatar}
      initial={(person.name || person.handle).slice(0, 1).toUpperCase()}
      rounded="rounded-full"
      title={person.name || `@${person.handle}`}
      subtitle={person.headline}
      meta={
        person.skills.length > 0 ? (
          <p className="truncate text-[11px] text-zinc-400">{person.skills.join(" · ")}</p>
        ) : null
      }
      action={
        canConnect ? (
          <button type="button" onClick={onConnect} disabled={busy || done} className={ACTION_CLASS}>
            {done ? "Requested" : busy ? "…" : "Connect"}
          </button>
        ) : (
          <Link href={`/p/${person.handle}`} target="_blank" className={ACTION_CLASS}>
            View
          </Link>
        )
      }
    />
  );
}
