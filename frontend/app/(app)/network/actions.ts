"use server";

import { revalidatePath } from "next/cache";

import { ApiError, apiFetch } from "@/lib/api";

export type ConnectionItem = {
  connection_id: number;
  user: {
    id: number;
    name: string;
    handle: string | null;
    headline: string;
    profile_picture: string | null;
    reputation_tier: string;
    attestations: { kind: string; label: string; detail: string; org_slug?: string }[];
  };
  created_at: string;
};

export type FollowItem = {
  type: "user" | "org";
  id: number | string;
  target: {
    id?: number;
    name?: string;
    handle?: string | null;
    slug?: string;
    profile_picture?: string | null;
    logo?: string | null;
    headline?: string;
    reputation_tier?: string;
  };
  created_at: string;
};

// Must never throw: invoked directly from client components, not a form
// bound to an error boundary — see connections/actions.ts.
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

export async function removeConnectionAction(
  connectionId: number
): Promise<{ ok: true } | { error: string }> {
  try {
    await apiFetch(`/network/connections/${connectionId}/`, { method: "DELETE" });
  } catch (err) {
    return { error: actionErrorMessage(err, "Could not remove this connection.") };
  }
  revalidatePath("/network");
  return { ok: true };
}

export async function unfollowUserAction(
  userId: number
): Promise<{ ok: true } | { error: string }> {
  try {
    await apiFetch(`/users/${userId}/follow/`, { method: "DELETE" });
  } catch (err) {
    return { error: actionErrorMessage(err, "Could not unfollow this person.") };
  }
  revalidatePath("/network");
  return { ok: true };
}

export async function unfollowOrgAction(slug: string): Promise<{ ok: true } | { error: string }> {
  try {
    await apiFetch(`/orgs/${slug}/follow/`, { method: "DELETE" });
  } catch (err) {
    return { error: actionErrorMessage(err, "Could not unfollow this organization.") };
  }
  revalidatePath("/network");
  return { ok: true };
}
