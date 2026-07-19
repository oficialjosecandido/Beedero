"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ApiError, apiFetch } from "@/lib/api";

export async function acceptInviteAction(_prevState: string | null, formData: FormData) {
  const token = String(formData.get("token"));
  let org: { slug: string; name: string };
  try {
    org = await apiFetch<{ slug: string; name: string }>(`/invites/${token}/accept/`, {
      method: "POST",
    });
  } catch (err) {
    if (err instanceof ApiError) {
      const body = err.body as Record<string, string> | null;
      return body?.detail ?? "This invite link is invalid or has expired.";
    }
    throw err;
  }
  revalidatePath("/dashboard");
  redirect(`/dashboard/${org.slug}`);
}
