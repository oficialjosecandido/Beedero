"use client";

import { useActionState, useState } from "react";

import { createJobAction, updateJobAction } from "@/app/(app)/dashboard/job-actions";
import { COMPENSATION_KIND_OPTIONS, ENGAGEMENT_TYPE_OPTIONS, LOCATION_TYPE_OPTIONS } from "@/lib/job-options";
import type { JobSummary } from "@/lib/types";
import { useActionToast } from "@/lib/use-action-toast";

const FIELD_CLASS =
  "rounded-lg border border-beedero-border px-2.5 py-1.5 text-sm outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60";

export function JobForm({
  slug,
  job,
  onDone,
}: {
  slug: string;
  job?: JobSummary;
  onDone?: () => void;
}) {
  const [error, formAction, pending] = useActionState(job ? updateJobAction : createJobAction, null);
  const compensationByKind = Object.fromEntries((job?.compensation ?? []).map((c) => [c.kind, c.detail]));
  const [checkedKinds, setCheckedKinds] = useState<Record<string, boolean>>(
    Object.fromEntries(COMPENSATION_KIND_OPTIONS.map((option) => [option.value, option.value in compensationByKind]))
  );
  useActionToast(error, pending, {
    successMessage: job ? "Job updated." : "Job published.",
    onSuccess: onDone,
  });

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-2xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm"
    >
      <input type="hidden" name="slug" value={slug} />
      {job && <input type="hidden" name="job_id" value={job.id} />}

      <input
        name="title"
        placeholder="Job title"
        defaultValue={job?.title}
        required
        maxLength={120}
        className={FIELD_CLASS}
      />
      <textarea
        name="description"
        placeholder="What does this role involve?"
        rows={4}
        defaultValue={job?.description}
        required
        maxLength={6000}
        className={FIELD_CLASS}
      />
      <input
        name="role_area"
        placeholder="Role area (e.g. Engineering, Sales) — optional"
        defaultValue={job?.role_area}
        className={FIELD_CLASS}
      />

      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
          Type
          <select name="engagement_type" defaultValue={job?.engagement_type ?? "full_time"} className={FIELD_CLASS}>
            {ENGAGEMENT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
          Location
          <select name="location_type" defaultValue={job?.location_type ?? "remote"} className={FIELD_CLASS}>
            {LOCATION_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600">
          City (optional)
          <input name="location_city" defaultValue={job?.location_city} className={FIELD_CLASS} />
        </label>
      </div>

      <input
        name="salary_text"
        placeholder="Salary range (free text, optional)"
        defaultValue={job?.salary_text}
        className={FIELD_CLASS}
      />
      <input
        name="skills"
        placeholder="Skills, comma separated (optional)"
        defaultValue={job?.skills?.join(", ")}
        className={FIELD_CLASS}
      />

      <div className="flex flex-col gap-2 rounded-xl border border-beedero-border p-3">
        <p className="text-xs font-medium text-zinc-600">Compensation — select all that apply</p>
        {COMPENSATION_KIND_OPTIONS.map((option) => (
          <div key={option.value} className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                name={`comp_${option.value}`}
                defaultChecked={checkedKinds[option.value]}
                onChange={(event) =>
                  setCheckedKinds((prev) => ({ ...prev, [option.value]: event.target.checked }))
                }
                className="size-4 accent-beedero-black"
              />
              {option.label}
            </label>
            {checkedKinds[option.value] && (
              <input
                name={`comp_${option.value}_detail`}
                placeholder="Detail (optional)"
                defaultValue={compensationByKind[option.value] ?? ""}
                maxLength={200}
                className="flex-1 rounded-lg border border-beedero-border px-2 py-1 text-xs outline-none focus:border-beedero-black focus:ring-2 focus:ring-beedero-yellow/60"
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          className="self-start rounded-xl bg-beedero-yellow px-4 py-2 text-sm font-bold text-beedero-black hover:bg-beedero-black hover:text-beedero-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Saving..." : job ? "Save changes" : "Publish job"}
        </button>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="text-sm font-medium text-zinc-500 hover:text-beedero-black"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
