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

export async function declareMembershipSkillAction(_prevState: string | null, formData: FormData) {
  const slug = String(formData.get("slug"));
  const memberId = String(formData.get("member_id"));
  const skill = String(formData.get("skill") ?? "").trim();
  if (!skill) return null;

  try {
    await apiFetch(`/orgs/${slug}/members/${memberId}/skills/`, {
      method: "POST",
      body: { skill },
    });
  } catch (err) {
    return firstErrorMessage(err, "Could not declare this skill.");
  }
  revalidatePath("/dashboard");
  return null;
}

export async function retractMembershipSkillAction(formData: FormData) {
  const slug = String(formData.get("slug"));
  const memberId = String(formData.get("member_id"));
  const skillId = String(formData.get("skill_id"));
  await apiFetch(`/orgs/${slug}/members/${memberId}/skills/${skillId}/`, { method: "DELETE" });
  revalidatePath("/dashboard");
}

export async function confirmMembershipSkillAction(formData: FormData) {
  const slug = String(formData.get("slug"));
  const memberId = String(formData.get("member_id"));
  const skillId = String(formData.get("skill_id"));
  await apiFetch(`/orgs/${slug}/members/${memberId}/skills/${skillId}/confirm/`, { method: "POST" });
  revalidatePath(`/dashboard/${slug}`);
}
