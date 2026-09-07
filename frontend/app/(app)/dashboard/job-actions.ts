"use server";

import { revalidatePath } from "next/cache";

import { apiFetch, ApiError } from "@/lib/api";
import { COMPENSATION_KIND_OPTIONS } from "@/lib/job-options";
import type { ApplicationSummary } from "@/lib/types";

function firstErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) throw err;
  const body = err.body as Record<string, string[] | string> | null;
  const detail = body?.detail;
  const first = Array.isArray(detail) ? detail[0] : (detail ?? (body && Object.values(body)[0]));
  const value = Array.isArray(first) ? first[0] : first;
  return typeof value === "string" ? value : fallback;
}

// Non-throwing sibling of firstErrorMessage — for actions invoked directly
// from a client component (via useTransition) rather than bound to a
// useActionState form, where a rethrow would escape as an uncaught failure.
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

function readJobFields(formData: FormData) {
  const skills = String(formData.get("skills") ?? "")
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);
  const compensation = COMPENSATION_KIND_OPTIONS.filter(
    (option) => formData.get(`comp_${option.value}`) === "on"
  ).map((option) => ({
    kind: option.value,
    detail: String(formData.get(`comp_${option.value}_detail`) ?? "").trim(),
  }));

  return {
    title: String(formData.get("title") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    role_area: String(formData.get("role_area") ?? "").trim(),
    engagement_type: String(formData.get("engagement_type")),
    location_type: String(formData.get("location_type")),
    location_city: String(formData.get("location_city") ?? "").trim(),
    salary_text: String(formData.get("salary_text") ?? "").trim(),
    skills,
    compensation,
  };
}

export async function createJobAction(_prevState: string | null, formData: FormData) {
  const slug = String(formData.get("slug"));
  try {
    await apiFetch(`/orgs/${slug}/jobs/`, { method: "POST", body: readJobFields(formData) });
  } catch (err) {
    return firstErrorMessage(err, "Could not publish this job.");
  }
  revalidatePath(`/dashboard/${slug}`);
  return null;
}

export async function updateJobAction(_prevState: string | null, formData: FormData) {
  const slug = String(formData.get("slug"));
  const jobId = String(formData.get("job_id"));
  try {
    await apiFetch(`/orgs/${slug}/jobs/${jobId}/`, { method: "PATCH", body: readJobFields(formData) });
  } catch (err) {
    return firstErrorMessage(err, "Could not update this job.");
  }
  revalidatePath(`/dashboard/${slug}`);
  return null;
}

export async function closeJobAction(formData: FormData) {
  const slug = String(formData.get("slug"));
  const jobId = String(formData.get("job_id"));
  await apiFetch(`/orgs/${slug}/jobs/${jobId}/`, { method: "PATCH", body: { status: "closed" } });
  revalidatePath(`/dashboard/${slug}`);
}

export async function deleteJobAction(formData: FormData) {
  const slug = String(formData.get("slug"));
  const jobId = String(formData.get("job_id"));
  await apiFetch(`/orgs/${slug}/jobs/${jobId}/`, { method: "DELETE" });
  revalidatePath(`/dashboard/${slug}`);
}

export async function renewJobAction(formData: FormData) {
  const slug = String(formData.get("slug"));
  const jobId = String(formData.get("job_id"));
  await apiFetch(`/jobs/${jobId}/renew/`, { method: "POST" });
  revalidatePath(`/dashboard/${slug}`);
}

export async function listJobApplicationsAction(
  slug: string,
  jobId: number
): Promise<{ items: ApplicationSummary[] }> {
  return apiFetch<{ items: ApplicationSummary[] }>(`/orgs/${slug}/jobs/${jobId}/applications/`);
}

export async function setApplicationStatusAction(
  slug: string,
  applicationId: number,
  status: string
): Promise<{ ok: true } | { error: string }> {
  try {
    await apiFetch(`/applications/${applicationId}/status/`, { method: "POST", body: { status } });
  } catch (err) {
    return { error: actionErrorMessage(err, "Could not update this application.") };
  }
  revalidatePath(`/dashboard/${slug}`);
  return { ok: true };
}
