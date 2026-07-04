"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { apiFetch, ApiError } from "@/lib/api";

export async function createOrgAction(_prevState: string | null, formData: FormData) {
  let org: { slug: string; name: string };
  try {
    org = await apiFetch("/orgs/", {
      method: "POST",
      body: {
        name: formData.get("name"),
        stage: formData.get("stage") ?? "",
        sector: formData.get("sector") ?? "",
        geo: formData.get("geo") ?? "",
        about: formData.get("about") ?? "",
        team: formData.get("team") ?? "",
        products: formData.get("products") ?? "",
        market_thesis: formData.get("market_thesis") ?? "",
      },
    });
  } catch {
    return "Could not create the organization.";
  }
  revalidatePath("/dashboard");
  redirect(`/dashboard/${org.slug}`);
}

export async function updateProfileAction(_prevState: string | null, formData: FormData) {
  const body = new FormData();
  body.set("full_name", formData.get("full_name") ?? "");
  body.set("headline", formData.get("headline") ?? "");
  body.set("bio", formData.get("bio") ?? "");
  body.set("country", formData.get("country") ?? "");
  const picture = formData.get("profile_picture");
  if (picture instanceof File && picture.size > 0) {
    body.set("profile_picture", picture);
  }

  try {
    await apiFetch("/investors/me/", { method: "PUT", body });
  } catch {
    return "Could not save your profile.";
  }
  revalidatePath("/dashboard");
  return null;
}

export async function followOrgAction(formData: FormData) {
  const slug = String(formData.get("slug"));
  await apiFetch(`/orgs/${slug}/follow/`, { method: "POST" });
  revalidatePath("/dashboard");
  revalidatePath("/feed");
}

export async function followUserAction(formData: FormData) {
  const userId = String(formData.get("user_id"));
  await apiFetch(`/users/${userId}/follow/`, { method: "POST" });
  revalidatePath("/dashboard");
  revalidatePath("/feed");
}

export async function upsertFieldAction(formData: FormData) {
  const slug = String(formData.get("slug"));
  const kind = String(formData.get("kind"));
  const key = String(formData.get("key"));
  const value = String(formData.get("value"));
  const visibility = String(formData.get("visibility") ?? "");

  await apiFetch(`/orgs/${slug}/sections/${kind}/fields/${key}/`, {
    method: "PUT",
    body: { value, ...(visibility ? { visibility } : {}) },
  });
  revalidatePath(`/dashboard/${slug}`);
}

export async function deleteFieldAction(formData: FormData) {
  const slug = String(formData.get("slug"));
  const kind = String(formData.get("kind"));
  const key = String(formData.get("key"));

  await apiFetch(`/orgs/${slug}/sections/${kind}/fields/${key}/`, { method: "DELETE" });
  revalidatePath(`/dashboard/${slug}`);
}

export async function openRoundAction(formData: FormData) {
  const slug = String(formData.get("slug"));
  await apiFetch(`/orgs/${slug}/rounds/`, {
    method: "POST",
    body: {
      stage: formData.get("stage"),
      valuation: Number(formData.get("valuation") || 0) || null,
      ask_amount: Number(formData.get("ask_amount") || 0) || null,
      use_of_funds: formData.get("use_of_funds") ?? "",
    },
  });
  revalidatePath(`/dashboard/${slug}`);
}

export async function closeRoundAction(formData: FormData) {
  const slug = String(formData.get("slug"));
  await apiFetch(`/orgs/${slug}/rounds/close/`, { method: "POST" });
  revalidatePath(`/dashboard/${slug}`);
}

function firstErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) throw err;
  const body = err.body as Record<string, string[] | string> | null;
  const detail = body?.detail;
  const first = Array.isArray(detail) ? detail[0] : detail ?? (body && Object.values(body)[0]);
  const value = Array.isArray(first) ? first[0] : first;
  return typeof value === "string" ? value : fallback;
}

export async function postFeedAction(_prevState: string | null, formData: FormData) {
  const slug = String(formData.get("slug"));
  const body = new FormData();
  body.set("kind", String(formData.get("kind")));
  body.set("title", String(formData.get("title")));
  body.set("body", String(formData.get("body") ?? ""));
  body.set("occurred_at", new Date().toISOString());
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    body.set("image", image);
  }

  try {
    await apiFetch(`/orgs/${slug}/feed/`, { method: "POST", body });
  } catch (err) {
    return firstErrorMessage(err, "Could not publish the update.");
  }
  revalidatePath(`/dashboard/${slug}`);
  revalidatePath("/feed");
  return null;
}

export async function uploadOrgLogoAction(formData: FormData) {
  const slug = String(formData.get("slug"));
  const logo = formData.get("logo");
  if (!(logo instanceof File) || logo.size === 0) return;

  const body = new FormData();
  body.set("logo", logo);
  await apiFetch(`/orgs/${slug}/logo/`, { method: "PUT", body });
  revalidatePath(`/dashboard/${slug}`);
  revalidatePath("/feed");
  revalidatePath("/discovery");
}

export async function createInviteAction(formData: FormData) {
  const slug = String(formData.get("slug"));
  await apiFetch(`/orgs/${slug}/invites/`, {
    method: "POST",
    body: { role: formData.get("role") },
  });
  revalidatePath(`/dashboard/${slug}`);
}

export async function revokeInviteAction(formData: FormData) {
  const slug = String(formData.get("slug"));
  const inviteId = String(formData.get("invite_id"));
  await apiFetch(`/orgs/${slug}/invites/${inviteId}/`, { method: "DELETE" });
  revalidatePath(`/dashboard/${slug}`);
}

export async function updateMemberRoleAction(formData: FormData) {
  const slug = String(formData.get("slug"));
  const memberId = String(formData.get("member_id"));
  await apiFetch(`/orgs/${slug}/members/${memberId}/`, {
    method: "PATCH",
    body: { role: formData.get("role") },
  });
  revalidatePath(`/dashboard/${slug}`);
}

export async function removeMemberAction(formData: FormData) {
  const slug = String(formData.get("slug"));
  const memberId = String(formData.get("member_id"));
  await apiFetch(`/orgs/${slug}/members/${memberId}/`, { method: "DELETE" });
  revalidatePath(`/dashboard/${slug}`);
}

export async function createInvestorPostAction(_prevState: string | null, formData: FormData) {
  const body = new FormData();
  body.set("kind", String(formData.get("kind")));
  body.set("title", String(formData.get("title")));
  body.set("body", String(formData.get("body") ?? ""));
  body.set("occurred_at", new Date().toISOString());
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    body.set("image", image);
  }

  try {
    await apiFetch("/investors/me/posts/", { method: "POST", body });
  } catch (err) {
    return firstErrorMessage(err, "Could not publish your post.");
  }
  revalidatePath("/dashboard");
  revalidatePath("/feed");
  return null;
}

export async function createGrantAction(formData: FormData) {
  const slug = String(formData.get("slug"));
  const section = formData.get("section");
  const field = formData.get("field");
  await apiFetch(`/orgs/${slug}/grants/`, {
    method: "POST",
    body: {
      section: section || null,
      field: field || null,
      principal_type: formData.get("principal_type"),
      principal_id: formData.get("principal_id"),
    },
  });
  revalidatePath(`/dashboard/${slug}`);
  revalidatePath(`/dashboard/${slug}/access`);
}

export async function deleteGrantAction(formData: FormData) {
  const slug = String(formData.get("slug"));
  const grantId = String(formData.get("grant_id"));
  await apiFetch(`/orgs/${slug}/grants/${grantId}/`, { method: "DELETE" });
  revalidatePath(`/dashboard/${slug}`);
  revalidatePath(`/dashboard/${slug}/access`);
}
