"use server";

import { revalidatePath } from "next/cache";

import { apiFetch, ApiError } from "@/lib/api";
import { dateBoundsError } from "@/lib/date-bounds";

function firstErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) throw err;
  const body = err.body as Record<string, string[] | string> | null;
  const detail = body?.detail;
  const first = Array.isArray(detail) ? detail[0] : (detail ?? (body && Object.values(body)[0]));
  const value = Array.isArray(first) ? first[0] : first;
  return typeof value === "string" ? value : fallback;
}

/** Person edits their own roster card from My profile — demotes verified badge. */
export async function updateMyMembershipDetailsAction(
  _prevState: string | null,
  formData: FormData
) {
  const slug = String(formData.get("org_slug") ?? "").trim();
  const memberId = String(formData.get("membership_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const startedOn = String(formData.get("started_on") ?? "");
  const endedOn = String(formData.get("ended_on") ?? "");

  if (!slug || !memberId || !startedOn) {
    return "Organisation and start date are required.";
  }
  const startedErr = dateBoundsError(startedOn, "Start date");
  if (startedErr) return startedErr;
  const endedErr = dateBoundsError(endedOn, "End date");
  if (endedErr) return endedErr;

  try {
    await apiFetch(`/orgs/${slug}/members/${memberId}/`, {
      method: "PATCH",
      body: {
        as_member: true,
        title,
        started_on: startedOn,
        ended_on: endedOn || null,
      },
    });
  } catch (err) {
    return firstErrorMessage(err, "Could not update this role.");
  }
  revalidatePath("/profile");
  revalidatePath(`/dashboard/${slug}`);
  return null;
}

export async function confirmMembershipDetailsAction(
  _prevState: string | null,
  formData: FormData
) {
  const slug = String(formData.get("slug") ?? "").trim();
  const memberId = String(formData.get("member_id") ?? "").trim();
  if (!slug || !memberId) return "Missing membership.";

  const result = await confirmMembershipDetailsByIds(slug, memberId);
  return "error" in result ? result.error : null;
}

/** Idempotent confirm used from the Team tab and notification Accept. */
export async function confirmMembershipDetailsByIds(
  slug: string,
  memberId: string | number
): Promise<{ ok: true } | { error: string }> {
  try {
    await apiFetch(`/orgs/${slug}/members/${memberId}/confirm-details/`, { method: "POST" });
  } catch (err) {
    return { error: firstErrorMessage(err, "Could not confirm these details.") };
  }
  revalidatePath(`/dashboard/${slug}`);
  revalidatePath("/profile");
  return { ok: true };
}

export async function updateAffiliationDetailsAction(
  _prevState: string | null,
  formData: FormData
) {
  const id = String(formData.get("affiliation_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const startedOn = String(formData.get("started_on") ?? "");
  const endedOn = String(formData.get("ended_on") ?? "");
  const skills = formData
    .getAll("skills")
    .map((value) => String(value).trim())
    .filter(Boolean);

  if (!id || !startedOn) return "Start date is required.";
  const startedErr = dateBoundsError(startedOn, "Start date");
  if (startedErr) return startedErr;
  const endedErr = dateBoundsError(endedOn, "End date");
  if (endedErr) return endedErr;

  try {
    await apiFetch(`/affiliations/${id}/`, {
      method: "PATCH",
      body: {
        title,
        started_on: startedOn,
        ended_on: endedOn || null,
        skills,
      },
    });
  } catch (err) {
    return firstErrorMessage(err, "Could not update this affiliation.");
  }
  revalidatePath("/profile");
  return null;
}
