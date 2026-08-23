"use server";

import { redirect } from "next/navigation";

import { ApiError, apiFetch } from "./api";

export async function logoutAction() {
  // Route handler ends Entra SSO (with id_token_hint) so "Create account"
  // afterwards is not silently SSO'd into the previous user.
  redirect("/api/auth/logout");
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
  redirect("/api/auth/logout");
}
