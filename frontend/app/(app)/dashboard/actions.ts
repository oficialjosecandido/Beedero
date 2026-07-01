"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { apiFetch } from "@/lib/api";

export async function createOrgAction(_prevState: string | null, formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  try {
    await apiFetch("/orgs/", {
      method: "POST",
      body: {
        slug,
        name: formData.get("name"),
        stage: formData.get("stage") ?? "",
        sector: formData.get("sector") ?? "",
        geo: formData.get("geo") ?? "",
      },
    });
  } catch {
    return "Não foi possível criar a organização.";
  }
  revalidatePath("/dashboard");
  redirect(`/dashboard/${slug}`);
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
}

export async function deleteGrantAction(formData: FormData) {
  const slug = String(formData.get("slug"));
  const grantId = String(formData.get("grant_id"));
  await apiFetch(`/orgs/${slug}/grants/${grantId}/`, { method: "DELETE" });
  revalidatePath(`/dashboard/${slug}`);
}
