"use server";

import { redirect } from "next/navigation";

import { ApiError, apiFetch } from "@/lib/api";

function message(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const body = err.body as Record<string, unknown> | null;
    for (const value of Object.values(body ?? {})) {
      if (typeof value === "string") return value;
      if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    }
    return fallback;
  }
  throw err;
}

/**
 * Apply, filling in whatever the profile is missing in the same submit — §3.5:
 * "Quem chega por uma vaga não deve ter de preencher o perfil inteiro antes de
 * se candidatar."
 *
 * The three profile fields and the two application fields travel together
 * because they are one act for the person. On the server they split again: the
 * name, city and title go to their profile (blanks only — see
 * accounts/minimum_profile.py), the note and link to this application, since
 * they are what this org is being told rather than what the person publishes.
 */
export async function applyToJobAction(_prev: string | null, formData: FormData) {
  const jobId = String(formData.get("job_id") ?? "");
  const note = String(formData.get("note") ?? "").trim().slice(0, 1500);
  const externalLink = String(formData.get("external_link") ?? "").trim();

  const profile = {
    full_name: String(formData.get("full_name") ?? "").trim(),
    headline: String(formData.get("headline") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
  };
  const hasProfileFields = Object.values(profile).some(Boolean);

  try {
    await apiFetch(`/jobs/${jobId}/apply/`, {
      method: "POST",
      body: {
        note,
        external_link: externalLink,
        ...(hasProfileFields ? { profile } : {}),
      },
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      // The session expired while they were writing. Keep the destination so
      // the next sign-in lands back on this form rather than on a feed.
      redirect(`/register?next=${encodeURIComponent(`/jobs/${jobId}/apply`)}`);
    }
    return message(err, "We couldn't send your application. Try again in a moment.");
  }

  redirect(`/jobs/${jobId}/apply?sent=1`);
}
