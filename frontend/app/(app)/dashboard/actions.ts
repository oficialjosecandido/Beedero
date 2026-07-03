"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { apiFetch } from "@/lib/api";

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

export async function postFeedAction(formData: FormData) {
  const slug = String(formData.get("slug"));
  await apiFetch(`/orgs/${slug}/feed/`, {
    method: "POST",
    body: {
      kind: formData.get("kind"),
      title: formData.get("title"),
      body: formData.get("body") ?? "",
      occurred_at: new Date().toISOString(),
    },
  });
  revalidatePath(`/dashboard/${slug}`);
  revalidatePath("/feed");
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
