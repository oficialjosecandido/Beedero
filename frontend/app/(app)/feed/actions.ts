"use server";

import { ApiError, apiFetch } from "@/lib/api";
import type { Comment, ConversationSummary, FeedItem, MessageItem } from "./types";

function actionErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) throw err;
  const body = err.body as Record<string, string[] | string> | null;
  const detail = body?.detail;
  const first = Array.isArray(detail) ? detail[0] : detail ?? (body && Object.values(body)[0]);
  const value = Array.isArray(first) ? first[0] : first;
  return typeof value === "string" ? value : fallback;
}

export async function startConversationAction(
  userId: number
): Promise<{ conversation: ConversationSummary } | { error: string }> {
  try {
    const conversation = (await apiFetch("/conversations/", {
      method: "POST",
      body: { user_id: userId },
    })) as ConversationSummary;
    return { conversation };
  } catch (err) {
    return { error: actionErrorMessage(err, "Could not start the conversation.") };
  }
}

export async function sendMessageAction(
  conversationId: number,
  body: string
): Promise<{ message: MessageItem } | { error: string }> {
  try {
    const message = (await apiFetch(`/conversations/${conversationId}/messages/`, {
      method: "POST",
      body: { body },
    })) as MessageItem;
    return { message };
  } catch (err) {
    return { error: actionErrorMessage(err, "Could not send your message.") };
  }
}

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
