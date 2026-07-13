"use server";

import { apiFetch } from "@/lib/api";
import type { Comment, FeedItem } from "./types";

export async function loadMoreFeedAction(cursor: string): Promise<{
  items: FeedItem[];
  next_cursor: string | null;
}> {
  return apiFetch(`/feed/?cursor=${encodeURIComponent(cursor)}`);
}

export async function reactAction(
  activityId: number,
  kind: string
): Promise<{ reaction_count: number }> {
  return apiFetch(`/activities/${activityId}/reactions/`, { method: "POST", body: { kind } });
}

export async function unreactAction(activityId: number): Promise<{ reaction_count: number }> {
  return apiFetch(`/activities/${activityId}/reactions/`, { method: "DELETE" });
}

export async function loadCommentsAction(
  activityId: number,
  cursor?: string
): Promise<{ items: Comment[]; next_cursor: string | null }> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  return apiFetch(`/activities/${activityId}/comments/${query}`);
}

export async function postCommentAction(
  activityId: number,
  body: string,
  parentId?: number | null
): Promise<Comment> {
  return apiFetch(`/activities/${activityId}/comments/`, {
    method: "POST",
    body: { body, parent_id: parentId ?? null },
  });
}

export async function deleteCommentAction(commentId: number): Promise<void> {
  await apiFetch(`/comments/${commentId}/`, { method: "DELETE" });
}
