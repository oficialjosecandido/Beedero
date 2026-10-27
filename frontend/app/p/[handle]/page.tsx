import Link from "next/link";
import { notFound } from "next/navigation";

import { PersonProfileActions } from "@/components/PersonProfileActions";
import { PersonProfileJsonLd } from "@/components/PersonProfileJsonLd";
import { PersonTimeline, type TimelineBand } from "@/components/PersonTimeline";
import { PersonSkillsSection, type AggregatedSkill } from "@/components/PersonSkillsSection";
import { PersonTimelineTree } from "@/components/PersonTimelineTree";
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
    city?: string;
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
    /** False while the viewer is below the ladder's gate (rungs 1–4). */
    can_request?: boolean;
  };
};

const COUNTRY_NAMES = Object.fromEntries(COUNTRIES);

const sectionHeading =
  "text-[10px] font-black uppercase tracking-[0.18em] text-beedero-yellow";
const cardClass = "border border-white/10 bg-white/[0.025] px-4 py-3";

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
          <div className="border border-beedero-yellow/40 bg-app-surface p-6 sm:p-8">
            <header className="flex items-start gap-5">
              {person.profile_picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={person.profile_picture}
                  alt={`${person.full_name} profile photo`}
                  className="size-20 shrink-0 rounded-full object-cover ring-2 ring-beedero-yellow/40"
                />
              ) : (
                <span className="flex size-20 shrink-0 items-center justify-center rounded-full bg-beedero-yellow text-3xl font-black text-beedero-black ring-2 ring-beedero-yellow/40">
                  {person.full_name.charAt(0)}
                </span>
              )}
              <div className="min-w-0 pt-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-black tracking-[-0.02em] text-white sm:text-[1.65rem]">
                    {person.full_name}
                  </h1>
                  {person.is_verified && (
                    <span className="bg-beedero-yellow px-2.5 py-0.5 text-xs font-black text-beedero-black">
                      Verified
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm font-semibold text-white/45">{formatAtHandle(person.handle)}</p>
                {person.headline && (
                  <p className="mt-1.5 text-sm leading-relaxed text-white/65">{person.headline}</p>
                )}
                {(person.city || person.country) && (
                  <p className="mt-1 text-xs text-white/40">
                    {[person.city, person.country && (COUNTRY_NAMES[person.country] ?? person.country)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
            </header>

            <section className="mt-6">
              <h2 className={sectionHeading}>Intro</h2>
              {person.bio ? (
                <p className="mt-2 text-sm leading-7 text-white/75">{person.bio}</p>
              ) : (
                <p className="mt-2 text-sm text-white/40">No intro</p>
              )}
            </section>

            {viewer_actions && (
              <div className="mt-6">
                <PersonProfileActions
                  userId={viewer_actions.user_id}
                  name={person.full_name}
                  canMessage={viewer_actions.can_message}
                  connectionStatus={viewer_actions.connection_status}
                  canRequest={viewer_actions.can_request ?? true}
                />
              </div>
            )}

            {attestations.length > 0 && (
              <section className="mt-8 border-t border-white/10 pt-8">
                <h2 className={sectionHeading}>Platform-attested</h2>
                <ul className="mt-3 flex flex-col gap-2">
                  {attestations.map((item) => (
                    <li key={`${item.kind}-${item.label}`} className={`flex items-center gap-3 ${cardClass}`}>
                      {item.org_slug ? (
                        item.org_logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            loading="lazy"
                            src={item.org_logo}
                            alt={`${item.org_name ?? item.label} logo`}
                            className="size-10 shrink-0 border border-white/15 object-cover"
                          />
                        ) : (
                          <span className="flex size-10 shrink-0 items-center justify-center border border-white/15 bg-beedero-yellow text-sm font-black text-beedero-black">
                            {(item.org_name ?? item.label).charAt(0).toUpperCase()}
                          </span>
                        )
                      ) : null}
                      <div className="min-w-0 flex-1">
                        {item.org_slug ? (
                          <Link
                            href={`/o/${item.org_slug}`}
                            className="font-bold text-white hover:text-beedero-yellow"
                          >
                            {item.label}
                          </Link>
                        ) : (
                          <p className="font-bold text-white">{item.label}</p>
                        )}
                        <p className="text-xs text-white/45">{item.detail}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {credentials && credentials.length > 0 && (
              <section className="mt-8 border-t border-white/10 pt-8">
                <h2 className={sectionHeading}>Professional credentials</h2>
                <ul className="mt-3 flex flex-col gap-2">
                  {credentials.map((credential) => (
                    <li
                      key={`${credential.issuer}-${credential.identifier}`}
                      className={cardClass}
                    >
                      <p className="font-bold text-white">{credential.title}</p>
                      <p className="text-xs text-white/45">
                        {credential.identifier} confirmed with {credential.issuer}
                        {credential.verified_at ? ` on ${formatDate(credential.verified_at)}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <PersonTimelineTree bands={timeline} />

            <PersonTimeline bands={timeline} />

            {advisor?.is_available && (
              <section className="mt-8 border-t border-white/10 pt-8">
                <h2 className={sectionHeading}>Advisory &amp; board</h2>
                <div className={`mt-3 ${cardClass}`}>
                  <p className="text-sm font-bold text-white">Open to advisory work</p>
                  {advisor.engagement_types.length > 0 && (
                    <p className="mt-1 text-xs text-white/45">
                      {advisor.engagement_types.map(engagementLabel).join(", ")}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {advisor.expertise.map((value) => (
                      <span
                        key={`expertise-${value}`}
                        className="border border-white/15 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-white/70"
                      >
                        {expertiseLabel(value)}
                      </span>
                    ))}
                    {advisor.stages.map((value) => (
                      <span
                        key={`stage-${value}`}
                        className="border border-white/15 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-white/70"
                      >
                        {stageLabel(value)}
                      </span>
                    ))}
                    {advisor.sectors.map((value) => (
                      <span
                        key={`sector-${value}`}
                        className="border border-white/15 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-white/70"
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

            <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/pbadge/${handle}.svg`}
                alt={`${person.full_name} on Beedero`}
                className="h-11 w-auto"
              />
              <p className="text-sm text-white/45">
                Profile on{" "}
                <Link
                  href="/"
                  className="font-bold text-beedero-yellow underline decoration-beedero-yellow/50 decoration-2 underline-offset-2"
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
