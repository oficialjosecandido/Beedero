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
  // The sidebar's org list lives in the `(app)` layout, not in any page, so
  // revalidating "/profile" (a page path) never reached it — and "/dashboard"
  // has been a bare redirect to /profile since the personal profile moved.
  // Invalidating the root layout covers every layout and page beneath it,
  // which is exactly what a new membership changes.
  revalidatePath("/", "layout");
  redirect(`/dashboard/${org.slug}`);
}
