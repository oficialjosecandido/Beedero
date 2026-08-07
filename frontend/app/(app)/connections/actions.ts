"use server";

import { revalidatePath } from "next/cache";

import { ApiError, apiFetch } from "@/lib/api";

export type ConnectionRequestItem = {
  id: number;
  requester: {
    id: number;
    name: string;
    handle: string | null;
    headline: string;
    profile_picture: string | null;
    reputation_tier: string;
    attestations: { kind: string; label: string; detail: string; org_slug?: string }[];
  };
  note: string;
  status: string;
  created_at: string;
};

// Must never throw: these actions are invoked directly from client
// components, not a form bound to an error boundary — a rethrow here
// escapes as an uncaught Server Action failure.
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

export async function sendConnectionRequestAction(
  recipientId: number,
  note: string
): Promise<{ ok: true } | { error: string }> {
  try {
    await apiFetch("/connections/requests/", {
      method: "POST",
      body: { recipient_id: recipientId, note },
    });
  } catch (err) {
    return { error: actionErrorMessage(err, "Could not send the connection request.") };
  }
  revalidatePath("/connections");
  return { ok: true };
}

export async function acceptConnectionRequestAction(
  requestId: number
): Promise<{ conversationId: number | null } | { error: string }> {
  try {
    const result = await apiFetch<{
      connection: { id: number };
      conversation: { id: number } | null;
    }>(`/connections/requests/${requestId}/accept/`, { method: "POST" });
    revalidatePath("/connections");
    revalidatePath("/feed");
    return { conversationId: result.conversation?.id ?? null };
  } catch (err) {
    return { error: actionErrorMessage(err, "Could not accept this request.") };
  }
}

export async function sendOrgConnectionRequestAction(
  slug: string,
  note: string
): Promise<{ ok: true } | { error: string }> {
  try {
    await apiFetch(`/orgs/${slug}/connections/requests/`, {
      method: "POST",
      body: { note },
    });
  } catch (err) {
    return { error: actionErrorMessage(err, "Could not send the connection request.") };
  }
  return { ok: true };
}

export async function declineConnectionRequestAction(
  requestId: number
): Promise<{ ok: true } | { error: string }> {
  try {
    await apiFetch(`/connections/requests/${requestId}/decline/`, { method: "POST" });
  } catch (err) {
    return { error: actionErrorMessage(err, "Could not decline this request.") };
  }
  revalidatePath("/connections");
  return { ok: true };
}
