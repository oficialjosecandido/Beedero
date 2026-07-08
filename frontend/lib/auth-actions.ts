"use server";

import { redirect } from "next/navigation";

import { ApiError, ApiTimeoutError, anonFetch, apiFetch } from "./api";
import { clearSession, getRefreshToken, setSession } from "./session";

export async function loginAction(_prevState: string | null, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  let tokens: { access: string; refresh: string };
  try {
    tokens = await anonFetch("/auth/token/", { email, password });
  } catch (err) {
    if (err instanceof ApiTimeoutError) return "Login is taking too long. Please try again.";
    if (err instanceof ApiError) return "Invalid credentials.";
    throw err;
  }

  await setSession(tokens.access, tokens.refresh);
  redirect("/feed");
}

export async function registerAction(_prevState: string | null, formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (password !== confirmPassword) return "Passwords do not match.";

  try {
    await anonFetch("/auth/register/", {
      email,
      password,
      confirm_password: confirmPassword,
    });
  } catch (err) {
    if (err instanceof ApiTimeoutError) return "Account creation is taking too long. Please try again.";
    if (err instanceof ApiError) {
      const body = err.body as Record<string, string[]> | null;
      const first = body && Object.values(body)[0]?.[0];
      return first ?? "Could not create the account.";
    }
    throw err;
  }

  const tokens: { access: string; refresh: string } = await anonFetch("/auth/token/", {
    email,
    password,
  });
  await setSession(tokens.access, tokens.refresh);
  redirect("/feed");
}

export async function forgotPasswordAction(_prevState: string | null, formData: FormData) {
  const email = String(formData.get("email") ?? "");

  try {
    await anonFetch("/auth/forgot-password/", { email });
  } catch (err) {
    if (err instanceof ApiTimeoutError) return "Password reset is taking too long. Please try again.";
    if (err instanceof ApiError) return "Could not start password reset.";
    throw err;
  }

  return "If an account exists, password reset instructions were sent.";
}

export async function resetPasswordAction(_prevState: string | null, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (password !== confirmPassword) return "Passwords do not match.";

  try {
    await anonFetch("/auth/reset-password/", {
      uid: formData.get("uid"),
      token: formData.get("token"),
      password,
      confirm_password: confirmPassword,
    });
  } catch (err) {
    if (err instanceof ApiTimeoutError) return "Password reset is taking too long. Please try again.";
    if (err instanceof ApiError) {
      const body = err.body as Record<string, string[] | string> | null;
      const first = body && Object.values(body)[0];
      return Array.isArray(first) ? first[0] : first ?? "Could not reset password.";
    }
    throw err;
  }

  redirect("/login");
}

export async function logoutAction() {
  const refresh = await getRefreshToken();
  if (refresh) {
    try {
      await apiFetch("/auth/logout/", { method: "POST", body: { refresh } });
    } catch {
      // Best-effort: an already-invalid refresh token shouldn't block logout.
    }
  }
  await clearSession();
  redirect("/login");
}
