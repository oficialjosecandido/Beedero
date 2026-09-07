import Link from "next/link";

import { CredibilityBadge } from "@/components/CredibilityBadge";
import { compensationKindLabel, engagementTypeLabel, locationTypeLabel } from "@/lib/job-options";
import type { JobSummary } from "@/lib/types";

import { ApplyButton } from "./ApplyButton";

export function JobCard({ job }: { job: JobSummary }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-beedero-border bg-beedero-white px-5 py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-zinc-950">{job.title}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
            <Link href={`/o/${job.org.slug}`} className="font-medium text-beedero-black hover:underline">
              {job.org.name}
            </Link>
            <CredibilityBadge level={job.org.credibility_level ?? 0} />
            {job.org.is_verified && (
              <span className="rounded-full bg-beedero-yellow px-2 py-0.5 text-xs font-bold text-beedero-black">
                Verified
              </span>
            )}
          </div>
        </div>
        <ApplyButton jobId={job.id} jobTitle={job.title} />
      </div>

      <p className="text-xs text-zinc-500">
        {engagementTypeLabel(job.engagement_type)} · {locationTypeLabel(job.location_type)}
        {job.location_city ? ` · ${job.location_city}` : ""}
        {job.salary_text ? ` · ${job.salary_text}` : ""}
      </p>

      <p className="line-clamp-3 text-sm leading-6 text-zinc-600">{job.description}</p>

      {job.compensation.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {job.compensation.map((comp) => (
            <span
              key={comp.kind}
              title={comp.detail || undefined}
              className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600"
            >
              {compensationKindLabel(comp.kind)}
            </span>
          ))}
        </div>
      )}

      {job.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {job.skills.map((skill) => (
            <span
              key={skill}
              className="rounded-full border border-beedero-border px-2 py-0.5 text-xs text-zinc-600"
            >
              {skill}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
