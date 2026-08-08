"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";

export async function updateAdvisorProfileAction(_prevState: string | null, formData: FormData) {
  const parseList = (name: string) =>
    formData
      .getAll(name)
      .map((value) => String(value).trim())
      .filter(Boolean);

  const body = {
    is_available: formData.get("is_available") === "on",
    expertise: parseList("expertise"),
    stages: parseList("stages"),
    sectors: parseList("sectors"),
    engagement_types: parseList("engagement_types"),
  };

  try {
    await apiFetch("/advisory/me/", { method: "PUT", body });
  } catch {
    return "Could not save your advisory preferences.";
  }
  revalidatePath("/dashboard");
  return null;
}
