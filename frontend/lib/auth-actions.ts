"use server";

import { redirect } from "next/navigation";

import { ApiError, anonFetch } from "./api";
import { clearSession, setSession } from "./session";

export async function loginAction(_prevState: string | null, formData: FormData) {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  let tokens: { access: string; refresh: string };
  try {
    tokens = await anonFetch("/auth/token/", { username, password });
  } catch (err) {
    if (err instanceof ApiError) return "Invalid credentials.";
    throw err;
  }

  await setSession(tokens.access, tokens.refresh);
  redirect("/dashboard");
}

export async function registerAction(_prevState: string | null, formData: FormData) {
  const username = String(formData.get("username") ?? "");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    await anonFetch("/auth/register/", { username, email, password });
  } catch (err) {
    if (err instanceof ApiError) {
      const body = err.body as Record<string, string[]> | null;
      const first = body && Object.values(body)[0]?.[0];
      return first ?? "Could not create the account.";
    }
    throw err;
  }

  const tokens: { access: string; refresh: string } = await anonFetch("/auth/token/", {
    username,
    password,
  });
  await setSession(tokens.access, tokens.refresh);
  redirect("/dashboard");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}
