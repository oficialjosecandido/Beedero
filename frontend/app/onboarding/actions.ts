"use server";

import { redirect } from "next/navigation";

import { ApiError, apiFetch } from "@/lib/api";
import { dateBoundsError } from "@/lib/date-bounds";
import { firstScreenUrl } from "@/lib/onboarding";
import type { OnboardingState } from "@/lib/types";

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
 * Non-throwing sibling of `message`, for the suggestion cards: those actions
 * are called straight from a client component (via useTransition) rather than
 * bound to a form, where a rethrow escapes as an uncaught failure and takes
 * the whole screen down over one card. Same reasoning as
 * `actionErrorMessage` in dashboard/job-actions.ts.
 */
function softMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const body = err.body as Record<string, unknown> | null;
    for (const value of Object.values(body ?? {})) {
      if (typeof value === "string") return value;
      if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    }
  }
  return fallback;
}

/**
 * Step 1 — "Quem és: nome, handle, cidade, frase curta sobre ti" (§6.3).
 *
 * The handle is sent even when the person did not touch it: the backend treats
 * an unchanged value as "leave it alone", and it is the one chance they get to
 * pick it (accounts/onboarding.py).
 */
export async function saveIdentityAction(_prev: string | null, formData: FormData) {
  try {
    await apiFetch("/onboarding/", {
      method: "POST",
      body: {
        step: "identity",
        full_name: String(formData.get("full_name") ?? "").trim(),
        handle: String(formData.get("handle") ?? "").trim(),
        city: String(formData.get("city") ?? "").trim(),
        headline: String(formData.get("headline") ?? "").trim(),
      },
    });
  } catch (err) {
    return message(err, "Could not save this.");
  }
  redirect("/onboarding?step=intents");
}

/**
 * Step 2 — "O que te traz cá", private and multiple choice (§6.3).
 *
 * No answer is a valid answer: the question is skippable, and somebody who
 * ticks nothing simply gets §6.4's fallback screen rather than a blocked form.
 */
export async function saveIntentsAction(_prev: string | null, formData: FormData) {
  const intents = formData.getAll("intents").map(String).filter(Boolean);
  try {
    await apiFetch("/onboarding/", {
      method: "POST",
      body: { step: "intents", intents },
    });
  } catch (err) {
    return message(err, "Could not save this.");
  }
  redirect("/onboarding?step=experience");
}

/** Step 3 — one role, by hand. "Pode saltar-se", so there is a skip beside it. */
export async function addExperienceAction(_prev: string | null, formData: FormData) {
  const orgName = String(formData.get("org_name") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const startedOn = String(formData.get("started_on") ?? "").trim();

  if (!orgName || !role) {
    return "Add the company and your role, or skip this step.";
  }
  const startedErr = dateBoundsError(startedOn, "Start date");
  if (startedErr) return startedErr;

  try {
    await apiFetch("/experience/", {
      method: "POST",
      body: {
        org_name: orgName,
        role,
        // The API takes a date or nothing; an empty string is neither.
        ...(startedOn ? { started_on: startedOn } : {}),
      },
    });
  } catch (err) {
    return message(err, "Could not add this role.");
  }
  redirect("/onboarding?step=suggestions");
}

/**
 * Last step — mark the flow as seen and go to §6.4's first screen, unless the
 * person is still short of the ladder's gate: then their profile is the only
 * screen that can do anything for them, and it opens with the next step on it
 * (components/dashboard/ProfileAside.tsx).
 *
 * The destination is read back from the API rather than from the form: the
 * intents were saved two steps ago, and a hidden field carrying them this far
 * would be a second copy of the one thing that decides where somebody lands.
 */
export async function finishOnboardingAction() {
  let state: OnboardingState;
  try {
    state = await apiFetch<OnboardingState>("/onboarding/", {
      method: "POST",
      body: { step: "complete" },
    });
  } catch (err) {
    // Nothing to tell the person: they are done either way, and holding them
    // on a finished screen to report a failed flag-write would be worse than
    // sending them on. The next feed visit will route them here again.
    if (err instanceof ApiError) redirect("/feed");
    throw err;
  }
  if (!state.can_connect) redirect("/profile");
  redirect(firstScreenUrl(state.primary_intent, state.city));
}

/**
 * The suggestion cards' two actions. Both reuse the endpoints the rest of the
 * product uses, so limits, notifications and interest signals are the same
 * ones as everywhere else (see accounts/onboarding_views.py).
 */
export async function followOrgAction(slug: string): Promise<{ ok: true } | { error: string }> {
  try {
    await apiFetch(`/orgs/${slug}/follow/`, { method: "POST" });
  } catch (err) {
    return { error: softMessage(err, "Could not follow this organisation.") };
  }
  return { ok: true };
}

export async function connectWithPersonAction(
  userId: number
): Promise<{ ok: true } | { error: string }> {
  try {
    await apiFetch("/connections/requests/", {
      method: "POST",
      body: { recipient_id: userId, note: "" },
    });
  } catch (err) {
    return { error: softMessage(err, "Could not send this request.") };
  }
  return { ok: true };
}
