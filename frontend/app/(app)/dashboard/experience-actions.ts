"use server";

import { revalidatePath } from "next/cache";

import { apiFetch, ApiError } from "@/lib/api";

function firstErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) throw err;
  const body = err.body as Record<string, string[] | string> | null;
  const detail = body?.detail;
  const first = Array.isArray(detail) ? detail[0] : (detail ?? (body && Object.values(body)[0]));
  const value = Array.isArray(first) ? first[0] : first;
  return typeof value === "string" ? value : fallback;
}

function parseSkills(formData: FormData) {
  return formData
    .getAll("skills")
    .map((value) => String(value).trim())
    .filter(Boolean);
}

export async function createExperienceAction(_prevState: string | null, formData: FormData) {
  const orgName = String(formData.get("org_name") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const startedOn = String(formData.get("started_on") ?? "");
  const endedOn = String(formData.get("ended_on") ?? "");

  if (!orgName || !startedOn) {
    return "Organization name and start date are required.";
  }

  try {
    await apiFetch("/experience/", {
      method: "POST",
      body: {
        org_name: orgName,
        role,
        started_on: startedOn,
        ended_on: endedOn || null,
        skills: parseSkills(formData),
      },
    });
  } catch (err) {
    return firstErrorMessage(err, "Could not add this experience.");
  }
  revalidatePath("/dashboard");
  return null;
}

export async function updateExperienceAction(_prevState: string | null, formData: FormData) {
  const id = String(formData.get("experience_id"));
  const orgName = String(formData.get("org_name") ?? "").trim();
  const startedOn = String(formData.get("started_on") ?? "");
  const endedOn = String(formData.get("ended_on") ?? "");

  if (!orgName || !startedOn) {
    return "Organization name and start date are required.";
  }

  try {
    await apiFetch(`/experience/${id}/`, {
      method: "PATCH",
      body: {
        org_name: orgName,
        role: String(formData.get("role") ?? "").trim(),
        started_on: startedOn,
        ended_on: endedOn || null,
        skills: parseSkills(formData),
      },
    });
  } catch (err) {
    return firstErrorMessage(err, "Could not update this experience.");
  }
  revalidatePath("/dashboard");
  return null;
}

export async function deleteExperienceAction(formData: FormData) {
  const id = String(formData.get("experience_id"));
  await apiFetch(`/experience/${id}/`, { method: "DELETE" });
  revalidatePath("/dashboard");
}
