"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ApiError, apiFetch, publicPost } from "@/lib/api";

function message(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const body = err.body as Record<string, unknown> | null;
    for (const value of Object.values(body ?? {})) {
      if (typeof value === "string") return value;
      if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    }
    return fallback;
  }
  throw err;
}

export async function acceptTeamInviteAction(_prev: string | null, formData: FormData) {
  const token = String(formData.get("token"));
  try {
    await apiFetch(`/team-invites/${token}/accept/`, { method: "POST" });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect(`/register?next=${encodeURIComponent(`/invite/team/${token}`)}`);
    }
    return message(err, "This invite can no longer be accepted.");
  }
  // A new verified affiliation changes the credibility ladder, which the
  // `(app)` layout renders — so invalidate the layout, not just the page.
  revalidatePath("/", "layout");
  redirect("/profile");
}

/**
 * Declining needs no session (§2.4) — the token in the inbox is the
 * authorisation. `block` is the "and never again" half of the same click.
 */
export async function declineTeamInviteAction(_prev: string | null, formData: FormData) {
  const token = String(formData.get("token"));
  const block = formData.get("block") === "on";
  try {
    await publicPost(`/public/team-invites/${token}/decline/`, { block });
  } catch (err) {
    return message(err, "This invite has already been answered.");
  }
  // Back to the same page, which is uncached and will now render the
  // "you declined this" state — a plain confirmation that it worked.
  redirect(`/invite/team/${token}`);
}

/**
 * Reporting the invite: declines it, blocks that org, and files a complaint
 * for a person at Beedero to read.
 *
 * Also session-free, and for the sharper version of the same reason: the
 * complaint is about having been emailed without an account, so an account
 * requirement would put it out of reach of exactly the people entitled to
 * make it. Works on an already-declined or expired invite too — someone who
 * opens the email late still gets to object.
 */
export async function reportTeamInviteAction(_prev: string | null, formData: FormData) {
  const token = String(formData.get("token"));
  const reason = String(formData.get("reason") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 2000);
  if (!reason) return "Pick what went wrong.";
  try {
    await publicPost(`/public/team-invites/${token}/report/`, { reason, note });
  } catch (err) {
    return message(err, "We couldn't file that report. Try again in a moment.");
  }
  redirect(`/invite/team/${token}?reported=1`);
}
