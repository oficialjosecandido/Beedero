"use server";

import { revalidatePath } from "next/cache";

import { apiFetch, ApiError } from "@/lib/api";
import type { JobSummary } from "@/lib/types";

// Must never throw: invoked directly from a client component (ApplyButton)
// via useTransition, not a form bound to an error boundary.
function actionErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const body = err.body as Record<string, string[] | string> | null;
    const detail = body?.detail;
    const first = Array.isArray(detail) ? detail[0] : (detail ?? (body && Object.values(body)[0]));
    const value = Array.isArray(first) ? first[0] : first;
    if (typeof value === "string") return value;
  }
  return fallback;
}

export async function loadMoreJobsAction(
  query: string,
  offset: number
): Promise<{ items: JobSummary[]; next_offset: number | null }> {
  const params = new URLSearchParams(query);
  params.set("offset", String(offset));
  return apiFetch<{ items: JobSummary[]; next_offset: number | null }>(`/jobs/?${params.toString()}`);
}

export async function applyToJobAction(
  jobId: number,
  note: string,
  externalLink: string
): Promise<{ ok: true } | { error: string }> {
  try {
    await apiFetch(`/jobs/${jobId}/apply/`, {
      method: "POST",
      body: { note, external_link: externalLink },
    });
  } catch (err) {
    return { error: actionErrorMessage(err, "Could not submit your application.") };
  }
  revalidatePath("/jobs");
  return { ok: true };
}
