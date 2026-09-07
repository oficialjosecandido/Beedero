"use client";

import { useState } from "react";

import { closeJobAction, deleteJobAction, renewJobAction } from "@/app/(app)/dashboard/job-actions";
import { EmptyState } from "@/components/EmptyState";
import { formatDate } from "@/lib/format";
import { engagementTypeLabel, locationTypeLabel } from "@/lib/job-options";
import type { JobSummary } from "@/lib/types";

import { ApplicationsList } from "./ApplicationsList";
import { JobForm } from "./JobForm";

const STATUS_LABELS: Record<JobSummary["status"], string> = { draft: "Draft", open: "Open", closed: "Closed" };
const STATUS_STYLES: Record<JobSummary["status"], string> = {
  draft: "bg-zinc-200 text-zinc-600",
  open: "bg-beedero-yellow text-beedero-black",
  closed: "bg-zinc-800 text-beedero-white",
};

function JobRow({ slug, job }: { slug: string; job: JobSummary }) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (editing) {
    return <JobForm slug={slug} job={job} onDone={() => setEditing(false)} />;
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-beedero-border bg-beedero-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-zinc-950">{job.title}</p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLES[job.status]}`}>
              {STATUS_LABELS[job.status]}
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            {engagementTypeLabel(job.engagement_type)} · {locationTypeLabel(job.location_type)}
            {job.location_city ? ` · ${job.location_city}` : ""}
          </p>
          {job.expires_at && (
            <p className="text-xs text-zinc-400">
              {job.status === "open" ? "Expires" : "Expired"} {formatDate(job.expires_at)}
              {job.renewal_count > 0 ? ` · renewed ${job.renewal_count}×` : ""}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="rounded-lg border border-beedero-border px-2.5 py-1.5 text-xs font-medium hover:bg-beedero-yellow/20"
          >
            {expanded ? "Hide applicants" : "View applicants"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg border border-beedero-border px-2.5 py-1.5 text-xs font-medium hover:bg-beedero-yellow/20"
          >
            Edit
          </button>
          {job.status !== "closed" && (
            <form action={closeJobAction}>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="job_id" value={job.id} />
              <button className="rounded-lg border border-beedero-border px-2.5 py-1.5 text-xs font-medium hover:bg-beedero-yellow/20">
                Close
              </button>
            </form>
          )}
          {job.status !== "open" && (
            <form action={renewJobAction}>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="job_id" value={job.id} />
              <button className="rounded-lg bg-beedero-yellow px-2.5 py-1.5 text-xs font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white">
                Renew
              </button>
            </form>
          )}
          <form action={deleteJobAction}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="job_id" value={job.id} />
            <button className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-danger-strong hover:bg-danger-surface">
              Delete
            </button>
          </form>
        </div>
      </div>
      {expanded && <ApplicationsList slug={slug} jobId={job.id} />}
    </div>
  );
}

export function JobsTab({ slug, jobs, canManage }: { slug: string; jobs: JobSummary[]; canManage: boolean }) {
  const [creating, setCreating] = useState(false);

  if (!canManage) {
    return (
      <EmptyState
        title="Jobs"
        description="Job management is only available to organization owners and admins."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {creating ? (
        <JobForm slug={slug} onDone={() => setCreating(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="self-start rounded-xl bg-beedero-black px-5 py-2.5 text-sm font-bold text-beedero-yellow shadow-sm hover:bg-beedero-yellow hover:text-beedero-black"
        >
          + New job
        </button>
      )}

      {jobs.length === 0 ? (
        <EmptyState
          title="No jobs yet"
          description="Publish your first job to start receiving applications."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {jobs.map((job) => (
            <JobRow key={job.id} slug={slug} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
