"use server";

import { revalidatePath } from "next/cache";

import { ApiError, apiFetch } from "@/lib/api";
import type { CofounderMatch } from "@/lib/cofounder-options";

// Same rule as connections/actions.ts: these are called straight from client
// components, so a rethrow would escape as an uncaught Server Action failure
// instead of a message the person can read.
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

export async function updateBuilderProfileAction(_prevState: string | null, formData: FormData) {
  const parseList = (name: string) =>
    formData
      .getAll(name)
      .map((value) => String(value).trim())
      .filter(Boolean);

  const prompts: Record<string, string> = {};
  for (const key of ["why_building", "superpower", "ideal_cofounder"]) {
    const value = String(formData.get(`prompt_${key}`) ?? "").trim();
    if (value) prompts[key] = value;
  }

  const body = {
    is_active: formData.get("is_active") === "on",
    adult_confirmed: formData.get("adult_confirmed") === "on",
    primary_strength: String(formData.get("primary_strength") ?? ""),
    looking_for: parseList("looking_for"),
    commitment: String(formData.get("commitment") ?? ""),
    sectors: parseList("sectors"),
    has_idea: formData.get("has_idea") === "on",
    idea_pitch: String(formData.get("idea_pitch") ?? "").trim(),
    prompts,
  };

  try {
    await apiFetch("/cofounder/profile/", { method: "PUT", body });
  } catch (err) {
    return actionErrorMessage(err, "Could not save your builder card.");
  }
  revalidatePath("/cofounder");
  return null;
}

/** "Interested" or "Pass" — two named decisions, never a swipe. */
export async function recordInterestAction(
  targetId: number,
  liked: boolean
): Promise<{ matched: boolean; match: CofounderMatch | null } | { error: string }> {
  try {
    const result = await apiFetch<{ matched: boolean; match: CofounderMatch | null }>(
      "/cofounder/interest/",
      { method: "POST", body: { target_id: targetId, liked } }
    );
    revalidatePath("/cofounder");
    return result;
  } catch (err) {
    return { error: actionErrorMessage(err, "Could not record your decision.") };
  }
}

export async function setMatchOutcomeAction(
  matchId: number,
  outcome: string
): Promise<{ ok: true } | { error: string }> {
  try {
    await apiFetch(`/cofounder/matches/${matchId}/outcome/`, {
      method: "POST",
      body: { outcome },
    });
  } catch (err) {
    return { error: actionErrorMessage(err, "Could not update this match.") };
  }
  revalidatePath("/cofounder");
  return { ok: true };
}

/** Reuses /api/reports/ — the same queue staff already review for DM
 * reports, so a card reported here lands in one list with everything else. */
export async function reportBuilderAction(
  userId: number,
  reason: string,
  details: string
): Promise<{ ok: true } | { error: string }> {
  try {
    await apiFetch("/reports/", {
      method: "POST",
      body: { user_id: userId, reason, details },
    });
  } catch (err) {
    return { error: actionErrorMessage(err, "Could not send this report.") };
  }
  return { ok: true };
}

/** Reuses /api/blocks/. A block is mutual-effect: neither side can start a
 * conversation afterwards, and the deck stops showing them to each other. */
export async function blockBuilderAction(userId: number): Promise<{ ok: true } | { error: string }> {
  try {
    await apiFetch("/blocks/", { method: "POST", body: { user_id: userId } });
  } catch (err) {
    return { error: actionErrorMessage(err, "Could not block this person.") };
  }
  revalidatePath("/cofounder");
  return { ok: true };
}

export async function createOrgFromMatchAction(
  matchId: number,
  name: string,
  oneLiner: string
): Promise<{ slug: string; inviteToken: string } | { error: string }> {
  try {
    const result = await apiFetch<{
      org: { slug: string; name: string };
      invite_token: string;
    }>(`/cofounder/matches/${matchId}/create-org/`, {
      method: "POST",
      body: { name, one_liner: oneLiner },
    });
    revalidatePath("/cofounder");
    revalidatePath("/dashboard");
    return { slug: result.org.slug, inviteToken: result.invite_token };
  } catch (err) {
    return { error: actionErrorMessage(err, "Could not create the organization.") };
  }
}
