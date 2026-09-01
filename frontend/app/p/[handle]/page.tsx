import Link from "next/link";
import { notFound } from "next/navigation";

import { PersonProfileActions } from "@/components/PersonProfileActions";
import { PersonProfileJsonLd } from "@/components/PersonProfileJsonLd";
import { PersonTimeline, type TimelineBand } from "@/components/PersonTimeline";
import { PersonSkillsSection, type AggregatedSkill } from "@/components/PersonSkillsSection";
import { PostsShowcase } from "@/components/PostsShowcase";
import { ApiError, apiFetch, publicFetch } from "@/lib/api";
import { COUNTRIES } from "@/lib/countries";
import { formatDate } from "@/lib/format";
import { formatAtHandle } from "@/lib/handles";
import type { ResolvedMention } from "@/lib/richtext";
import { missingPageMetadata, personProfileMetadata } from "@/lib/site-metadata";
import { getAccessToken } from "@/lib/session";
import { engagementLabel, expertiseLabel } from "@/lib/advisory-options";
import { sectorLabel, stageLabel } from "@/lib/org-filters";

type PublicPerson = {
  person: {
    handle: string;
    full_name: string;
    headline: string;
    is_verified: boolean;
    profile_picture?: string | null;
    bio?: string;
    country?: string;
  };
  attestations: {
    kind: string;
    label: string;
    detail: string;
    org_slug?: string;
    org_name?: string;
    org_logo?: string | null;
  }[];
  posts: {
    id: number;
    kind: string;
    title: string;
    body: string;
    occurred_at: string;
    mentions?: ResolvedMention[];
  }[];
  timeline: TimelineBand[];
  skills?: {
    free: string[];
    aggregated: AggregatedSkill[];
  };
  credentials?: {
    title: string;
    issuer: string;
    identifier: string;
    verified_at: string | null;
  }[];
  advisor?: {
    is_available: boolean;
    expertise: string[];
    stages: string[];
    sectors: string[];
    engagement_types: string[];
  };
  viewer_actions?: {
    can_message: boolean;
    connection_status: "none" | "pending_sent" | "pending_received" | "connected";
    user_id: number;
  };
};

const COUNTRY_NAMES = Object.fromEntries(COUNTRIES);

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  try {
    const data = (await publicFetch(`/public/people/${handle}/`)) as PublicPerson;
    return personProfileMetadata(data.person);
  } catch {
    return missingPageMetadata("Profile");
  }
}

export default async function PublicPersonPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;

  let data: PublicPerson;
  try {
    const token = await getAccessToken();
    data = token
      ? await apiFetch<PublicPerson>(`/public/people/${handle}/`)
      : await publicFetch<PublicPerson>(`/public/people/${handle}/`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const { person, attestations, posts, timeline, skills, advisor, credentials, viewer_actions } = data;

  return (
    <>
      <PersonProfileJsonLd person={person} />
      <main className="flex flex-1 justify-center px-4 py-12 lg:px-6 lg:py-16">
        <div className="w-full max-w-2xl">
          <div className="rounded-3xl border-2 border-beedero-border bg-beedero-white p-6 shadow-sm sm:p-8">
            <header className="flex items-start gap-5">
              {person.profile_picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={person.profile_picture}
                  alt={`${person.full_name} profile photo`}
                  className="size-20 shrink-0 rounded-full object-cover ring-2 ring-beedero-border/50"
                />
              ) : (
                <span className="flex size-20 shrink-0 items-center justify-center rounded-full bg-beedero-yellow/35 text-3xl font-extrabold text-beedero-black ring-2 ring-beedero-border/50">
                  {person.full_name.charAt(0)}
                </span>
              )}
              <div className="min-w-0 pt-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 sm:text-[1.65rem]">
                    {person.full_name}
                  </h1>
                  {person.is_verified && (
                    <span className="rounded-full bg-beedero-yellow px-2.5 py-0.5 text-xs font-bold text-beedero-black">
                      Verified
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm font-semibold text-zinc-500">{formatAtHandle(person.handle)}</p>
                {person.headline && (
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{person.headline}</p>
                )}
                {person.country && (
                  <p className="mt-1 text-xs text-zinc-400">
                    {COUNTRY_NAMES[person.country] ?? person.country}
                  </p>
                )}
              </div>
            </header>

            <section className="mt-6">
              <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">Intro</h2>
              {person.bio ? (
                <p className="mt-2 text-sm leading-7 text-zinc-700">{person.bio}</p>
              ) : (
                <p className="mt-2 text-sm text-zinc-400">No intro</p>
              )}
            </section>

            {viewer_actions && (
              <div className="mt-6">
                <PersonProfileActions
                  userId={viewer_actions.user_id}
                  name={person.full_name}
                  canMessage={viewer_actions.can_message}
                  connectionStatus={viewer_actions.connection_status}
                />
              </div>
            )}

            {attestations.length > 0 && (
              <section className="mt-8 border-t border-zinc-100 pt-8">
                <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">
                  Platform-attested
                </h2>
              <ul className="mt-3 flex flex-col gap-2">
                {attestations.map((item) => (
                  <li
                    key={`${item.kind}-${item.label}`}
                    className="flex items-center gap-3 rounded-xl border border-beedero-border/70 bg-zinc-50 px-4 py-3"
                  >
                    {item.org_slug ? (
                      item.org_logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img loading="lazy"
                          src={item.org_logo}
                          alt={`${item.org_name ?? item.label} logo`}
                          className="size-10 shrink-0 rounded-xl border border-beedero-border/60 object-cover"
                        />
                      ) : (
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-beedero-border/60 bg-beedero-white text-sm font-bold text-beedero-black">
                          {(item.org_name ?? item.label).charAt(0).toUpperCase()}
                        </span>
                      )
                    ) : null}
                    <div className="min-w-0 flex-1">
                      {item.org_slug ? (
                        <Link
                          href={`/o/${item.org_slug}`}
                          className="font-semibold text-beedero-black hover:underline"
                        >
                          {item.label}
                        </Link>
                      ) : (
                        <p className="font-semibold text-beedero-black">{item.label}</p>
                      )}
                      <p className="text-xs text-zinc-500">{item.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {credentials && credentials.length > 0 && (
            <section className="mt-8 border-t border-zinc-100 pt-8">
              <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">
                Professional credentials
              </h2>
              <ul className="mt-3 flex flex-col gap-2">
                {credentials.map((credential) => (
                  <li
                    key={`${credential.issuer}-${credential.identifier}`}
                    className="rounded-xl border border-beedero-border/70 bg-zinc-50 px-4 py-3"
                  >
                    <p className="font-semibold text-beedero-black">{credential.title}</p>
                    <p className="text-xs text-zinc-500">
                      {credential.identifier} confirmed with {credential.issuer}
                      {credential.verified_at ? ` on ${formatDate(credential.verified_at)}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <PersonTimeline bands={timeline} />

          {advisor?.is_available && (
            <section className="mt-8 border-t border-zinc-100 pt-8">
              <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">
                Advisory &amp; board
              </h2>
              <div className="mt-3 rounded-xl border border-beedero-border/70 bg-zinc-50 px-4 py-3">
                <p className="text-sm font-semibold text-beedero-black">Open to advisory work</p>
                {advisor.engagement_types.length > 0 && (
                  <p className="mt-1 text-xs text-zinc-500">
                    {advisor.engagement_types.map(engagementLabel).join(", ")}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {advisor.expertise.map((value) => (
                    <span
                      key={`expertise-${value}`}
                      className="rounded-full bg-beedero-white px-2.5 py-1 text-xs font-medium text-zinc-600 ring-1 ring-beedero-border/70"
                    >
                      {expertiseLabel(value)}
                    </span>
                  ))}
                  {advisor.stages.map((value) => (
                    <span
                      key={`stage-${value}`}
                      className="rounded-full bg-beedero-white px-2.5 py-1 text-xs font-medium text-zinc-600 ring-1 ring-beedero-border/70"
                    >
                      {stageLabel(value)}
                    </span>
                  ))}
                  {advisor.sectors.map((value) => (
                    <span
                      key={`sector-${value}`}
                      className="rounded-full bg-beedero-white px-2.5 py-1 text-xs font-medium text-zinc-600 ring-1 ring-beedero-border/70"
                    >
                      {sectorLabel(value)}
                    </span>
                  ))}
                </div>
              </div>
            </section>
          )}

          {skills && <PersonSkillsSection free={skills.free} aggregated={skills.aggregated} />}

          <PostsShowcase posts={posts} />

          <div className="mt-10 flex flex-col gap-4 border-t-2 border-beedero-border/30 pt-8 sm:flex-row sm:items-center sm:justify-between">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/pbadge/${handle}.svg`}
              alt={`${person.full_name} on Beedero`}
              className="h-11 w-auto"
            />
            <p className="text-sm text-zinc-500">
              Profile on{" "}
              <Link
                href="/"
                className="font-semibold text-beedero-black underline decoration-beedero-yellow decoration-2 underline-offset-2"
              >
                Beedero
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
    </>
  );
}
