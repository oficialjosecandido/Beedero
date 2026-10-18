import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JobPostingJsonLd } from "@/components/jobs/JobPostingJsonLd";
import { ShareJobButton } from "@/components/jobs/ShareJobButton";
import { CredibilityBadge } from "@/components/CredibilityBadge";
import { ApiError, publicFetch } from "@/lib/api";
import { compensationKindLabel } from "@/lib/job-options";
import { getAccessToken } from "@/lib/session";
import { missingPageMetadata, OG_IMAGE, pageMetadata } from "@/lib/site-metadata";
import { refFor, registerUrl, safeRef } from "@/lib/signup-ref";
import type { PublicJob } from "@/lib/types";

/**
 * One open role, readable by anyone — doc §3.2 and §3.3.
 *
 * The API only ever serves open, unexpired jobs from a live org, so a closed
 * role arrives here as a 404 and this page renders `notFound()`. §3.3 allows a
 * "vaga encerrada" page with `noindex` instead; 404 is the stronger of the two,
 * because it is the only answer that makes Google drop the role from its job
 * search rather than keep showing a position nobody can be hired for.
 */

async function loadJob(id: string): Promise<PublicJob> {
  try {
    return await publicFetch<PublicJob>(`/public/jobs/${id}/`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  let job: PublicJob;
  try {
    job = await publicFetch<PublicJob>(`/public/jobs/${id}/`);
  } catch {
    return missingPageMetadata("Role");
  }

  const where = job.location_city
    ? `${job.location_label} · ${job.location_city}`
    : job.location_label;

  return pageMetadata({
    // §3.2's "Cargo · Org · Beedero" — the template in site-metadata adds the
    // last part, so this title carries the first two.
    title: `${job.title} · ${job.org.name}`,
    description:
      `${job.org.name} is hiring a ${job.title} — ${job.engagement_label}, ${where}. ` +
      (job.org.one_liner || "See the company's verified profile and apply on Beedero."),
    path: `/jobs/${job.id}`,
    image: job.org.logo
      ? { url: job.org.logo, alt: `${job.org.name} logo` }
      : OG_IMAGE,
    keywords: [job.title, job.org.name, "startup job", job.engagement_label, ...job.skills.slice(0, 5)],
  });
}

export default async function PublicJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ref?: string }>;
}) {
  const [{ id }, { ref }] = await Promise.all([params, searchParams]);
  const job = await loadJob(id);
  const signedIn = Boolean(await getAccessToken());

  const applyPath = `/jobs/${job.id}/apply`;
  // §3.2 specifies `ref=job:<id>`. An inbound ref outranks it: someone who
  // arrived on `?ref=share:acme` was brought here by that org's own sharing,
  // and overwriting it with the job id would credit the channel to Beedero.
  const applyHref = signedIn
    ? applyPath
    : registerUrl(safeRef(ref) || refFor("job", job.id), applyPath);

  const where = job.location_city
    ? `${job.location_label} · ${job.location_city}`
    : job.location_label;
  const closes = job.expires_at
    ? new Date(job.expires_at).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <>
      <JobPostingJsonLd job={job} />
      <main className="flex flex-1 flex-col items-center px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex w-full max-w-3xl flex-col gap-8">
          <nav aria-label="Breadcrumb" className="text-xs text-zinc-500">
            <Link href="/jobs" className="font-semibold underline hover:text-beedero-black">
              Open roles
            </Link>{" "}
            / {job.title}
          </nav>

          <header className="rounded-3xl border-2 border-beedero-border bg-beedero-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-3">
              {job.org.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={job.org.logo}
                  alt={`${job.org.name} logo`}
                  className="size-12 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-base font-semibold text-zinc-500">
                  {job.org.name.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <Link
                  href={`/o/${job.org.slug}`}
                  className="font-semibold text-zinc-950 hover:underline"
                >
                  {job.org.name}
                </Link>
                {job.org.one_liner && (
                  <p className="truncate text-xs text-zinc-600">{job.org.one_liner}</p>
                )}
              </div>
              <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">
                <CredibilityBadge level={job.org.credibility_level} />
                {job.org.is_verified && (
                  <span className="rounded-full bg-beedero-yellow px-2 py-0.5 text-xs font-bold text-beedero-black">
                    Verified
                  </span>
                )}
              </div>
            </div>

            <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-zinc-950 sm:text-4xl">
              {job.title}
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              {job.engagement_label} · {where}
              {job.role_area && ` · ${job.role_area}`}
              {job.salary_text && ` · ${job.salary_text}`}
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href={applyHref}
                className="rounded-xl bg-beedero-yellow px-5 py-2.5 text-sm font-bold text-beedero-black transition hover:opacity-90"
              >
                Apply for this role
              </Link>
              <ShareJobButton
                jobId={job.id}
                jobTitle={job.title}
                orgSlug={job.org.slug}
                orgName={job.org.name}
                tone="light"
              />
            </div>
            {!signedIn && (
              <p className="mt-3 text-xs text-zinc-500">
                No account yet? Applying creates one with your email — name, city and a one-line
                title is all the profile you need.
              </p>
            )}
          </header>

          <section className="rounded-3xl border-2 border-beedero-border bg-beedero-white p-6 shadow-sm sm:p-8">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-beedero-black">
              About the role
            </h2>
            {/* Plain text from the org, rendered as text: paragraphs are kept,
                markup is not, because nothing sanitises this on the way in. */}
            <div className="mt-4 flex flex-col gap-3 text-sm leading-6 text-zinc-700">
              {job.description
                .split(/\n{2,}/)
                .map((paragraph) => paragraph.trim())
                .filter(Boolean)
                .map((paragraph, index) => (
                  <p key={index} className="whitespace-pre-line">
                    {paragraph}
                  </p>
                ))}
            </div>

            {job.skills.length > 0 && (
              <div className="mt-6">
                <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                  Skills
                </h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {job.skills.map((skill) => (
                    <li
                      key={skill}
                      className="rounded-full border border-beedero-border px-3 py-1 text-xs font-semibold text-zinc-700"
                    >
                      {skill}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {job.compensation.length > 0 && (
              <div className="mt-6">
                <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                  Compensation
                </h3>
                <ul className="mt-2 flex flex-col gap-1 text-sm text-zinc-700">
                  {job.compensation.map((item) => (
                    <li key={item.kind}>
                      <b className="font-semibold">{compensationKindLabel(item.kind)}</b>
                      {item.detail && ` — ${item.detail}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {closes && (
              <p className="mt-6 text-xs text-zinc-500">
                This posting is open until {closes}. Roles on Beedero last seven days and are
                renewed by the organisation, so what you see here is still being hired for.
              </p>
            )}
          </section>

          <div className="rounded-2xl border border-beedero-border bg-zinc-50 px-5 py-4 text-sm text-zinc-600">
            Not the right role?{" "}
            <Link href="/jobs" className="font-semibold text-beedero-black underline">
              See every open position
            </Link>{" "}
            or{" "}
            <Link href={`/o/${job.org.slug}`} className="font-semibold text-beedero-black underline">
              read {job.org.name}&apos;s profile
            </Link>
            .
          </div>
        </div>
      </main>
    </>
  );
}
