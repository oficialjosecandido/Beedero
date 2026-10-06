import Link from "next/link";

import { Seal } from "@/components/app-shell/ui";
import { credibilityLevelHeading } from "@/lib/credibility";
import { compensationKindLabel, engagementTypeLabel, locationTypeLabel } from "@/lib/job-options";
import type { JobSummary } from "@/lib/types";

import { ApplyButton } from "./ApplyButton";

export function JobCard({ job }: { job: JobSummary }) {
  const level = job.org.credibility_level ?? 0;

  return (
    <article className="border border-white/10 bg-white/[0.025] p-5">
      <div className="flex flex-wrap items-center gap-5">
        {job.org.is_verified ? (
          <Seal />
        ) : (
          <span
            aria-hidden
            className="grid size-5 shrink-0 place-items-center border border-white/20 text-[9px] font-black text-white/35 [clip-path:polygon(25%_6%,75%_6%,100%_50%,75%_94%,25%_94%,0_50%)]"
          >
            ·
          </span>
        )}

        <div className="min-w-[200px] flex-1">
          <h2 className="text-sm font-bold">{job.title}</h2>
          <p className="mt-1 text-sm text-white/55">
            <Link href={`/o/${job.org.slug}`} className="hover:text-white hover:underline">
              {job.org.name}
            </Link>
            {job.org.is_verified && <> · <span className="text-emerald-400">Verified</span></>}
            {level > 0 && (
              <>
                {" "}
                ·{" "}
                <span className="text-white/40" title={credibilityLevelHeading(level)}>
                  Level {level}
                </span>
              </>
            )}
          </p>
        </div>

        <p className="text-sm text-white/55">
          {job.location_city ? `${job.location_city} · ` : ""}
          {locationTypeLabel(job.location_type)} · {engagementTypeLabel(job.engagement_type)}
        </p>

        {job.salary_text && <p className="text-sm text-white/80">{job.salary_text}</p>}

        <ApplyButton jobId={job.id} jobTitle={job.title} />
      </div>

      {job.description && (
        <p className="mt-4 line-clamp-3 border-l-2 border-beedero-yellow pl-3 text-sm leading-6 text-white/60">
          {job.description}
        </p>
      )}

      {(job.compensation.length > 0 || job.skills.length > 0) && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {job.compensation.map((comp) => (
            <span
              key={comp.kind}
              title={comp.detail || undefined}
              className="border border-beedero-yellow/40 px-2 py-0.5 text-[10px] font-bold text-beedero-yellow"
            >
              {compensationKindLabel(comp.kind)}
            </span>
          ))}
          {job.skills.map((skill) => (
            <span
              key={skill}
              className="border border-white/15 px-2 py-0.5 text-[10px] font-bold text-white/55"
            >
              {skill}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
