import Link from "next/link";

import { CredibilityBadge } from "@/components/CredibilityBadge";
import type { PublicJob } from "@/lib/types";

/**
 * One open role on the public board — the light palette of /startups rather
 * than the app's dark one, because this card is read by people with no account.
 *
 * The whole card is one link to the job. The org name is not a second link:
 * two targets inside a card is a coin toss on a phone, and this page exists to
 * get someone to the role, not to the company.
 */
export function PublicJobCard({ job }: { job: PublicJob }) {
  const where = job.location_city
    ? `${job.location_label} · ${job.location_city}`
    : job.location_label;

  return (
    <article className="rounded-2xl border-2 border-beedero-border bg-beedero-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Link href={`/jobs/${job.id}`} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {job.org.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              loading="lazy"
              src={job.org.logo}
              alt={`${job.org.name} logo`}
              className="size-10 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-sm font-semibold text-zinc-500">
              {job.org.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-zinc-950">{job.title}</h2>
            <p className="truncate text-xs text-zinc-600">
              {job.org.name}
              {job.role_area && ` · ${job.role_area}`}
            </p>
            <p className="truncate text-xs text-zinc-500">
              {job.engagement_label} · {where}
              {job.salary_text && ` · ${job.salary_text}`}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <CredibilityBadge level={job.org.credibility_level} />
          {job.org.is_verified && (
            <span className="rounded-full bg-beedero-yellow px-2 py-0.5 text-xs font-bold text-beedero-black">
              Verified
            </span>
          )}
        </div>
      </Link>
    </article>
  );
}
