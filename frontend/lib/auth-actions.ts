"use server";

import { redirect } from "next/navigation";

import { ApiError, apiFetch } from "./api";
import { clearSession } from "./session";

export async function logoutAction() {
  await clearSession();
  redirect("/");
}

export async function deleteAccountAction(_prevState: string | null, formData: FormData) {
  if (String(formData.get("confirmation") ?? "") !== "DELETE") {
    return "Type DELETE to confirm.";
  }
  try {
    await apiFetch("/auth/me/", { method: "DELETE" });
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    return "Could not delete your account. Try again in a moment.";
  }
  await clearSession();
  redirect("/");
}
