"use server";

import { revalidatePath } from "next/cache";

import { apiFetch, ApiError } from "@/lib/api";
import type { OrgSummary } from "@/lib/types";

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

function parseSkills(formData: FormData) {
  return formData
    .getAll("skills")
    .map((value) => String(value).trim())
    .filter(Boolean);
}

export async function searchOrgsAction(query: string): Promise<{ items: OrgSummary[] }> {
  if (!query.trim()) return { items: [] };
  return apiFetch<{ items: OrgSummary[] }>(`/orgs/search/?q=${encodeURIComponent(query)}`);
}

export async function createAffiliationAction(_prevState: string | null, formData: FormData) {
  const orgSlug = String(formData.get("org_slug") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  const startedOn = String(formData.get("started_on") ?? "");
  const endedOn = String(formData.get("ended_on") ?? "");

  if (!orgSlug || !role || !startedOn) {
    return "Organization, role, and start date are required.";
  }

  try {
    await apiFetch("/affiliations/", {
      method: "POST",
      body: {
        org_slug: orgSlug,
        role,
        title: String(formData.get("title") ?? "").trim(),
        started_on: startedOn,
        ended_on: endedOn || null,
        skills: parseSkills(formData),
      },
    });
  } catch (err) {
    return firstErrorMessage(err, "Could not declare this affiliation.");
  }
  revalidatePath("/dashboard");
  return null;
}

export async function withdrawAffiliationAction(_prevState: string | null, formData: FormData) {
  const id = String(formData.get("affiliation_id"));
  try {
    await apiFetch(`/affiliations/${id}/`, { method: "DELETE" });
  } catch (err) {
    return firstErrorMessage(err, "Could not withdraw this affiliation.");
  }
  revalidatePath("/dashboard");
  return null;
}

export async function acceptAffiliationAction(
  affiliationId: number
): Promise<{ ok: true } | { error: string }> {
  try {
    await apiFetch(`/affiliations/${affiliationId}/accept/`, { method: "POST" });
  } catch (err) {
    return { error: actionErrorMessage(err, "Could not accept this affiliation.") };
  }
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function confirmAffiliationAction(
  slug: string,
  affiliationId: number
): Promise<{ ok: true } | { error: string }> {
  try {
    await apiFetch(`/orgs/${slug}/affiliations/${affiliationId}/confirm/`, { method: "POST" });
  } catch (err) {
    return { error: actionErrorMessage(err, "Could not confirm this affiliation.") };
  }
  revalidatePath(`/dashboard/${slug}`);
  return { ok: true };
}

export async function disputeAffiliationAction(
  slug: string,
  affiliationId: number
): Promise<{ ok: true } | { error: string }> {
  try {
    await apiFetch(`/orgs/${slug}/affiliations/${affiliationId}/dispute/`, { method: "POST" });
  } catch (err) {
    return { error: actionErrorMessage(err, "Could not dispute this affiliation.") };
  }
  revalidatePath(`/dashboard/${slug}`);
  return { ok: true };
}

export async function addTeamMemberAction(_prevState: string | null, formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const handle = String(formData.get("handle") ?? "")
    .trim()
    .replace(/^@+/, "");
  const title = String(formData.get("title") ?? "").trim().slice(0, 100);
  const startedOn = String(formData.get("started_on") ?? "");
  const endedOn = String(formData.get("ended_on") ?? "");

  if (!handle || !title || !startedOn) {
    return "Username, role, and start date are required.";
  }

  try {
    await apiFetch(`/orgs/${slug}/affiliations/`, {
      method: "POST",
      body: {
        handle,
        // Categorical type required by the API; free-text role is stored as title.
        role: "employee",
        title,
        started_on: startedOn,
        ended_on: endedOn || null,
      },
    });
  } catch (err) {
    return firstErrorMessage(err, "Could not add this team member.");
  }
  revalidatePath(`/dashboard/${slug}`);
  return null;
}
