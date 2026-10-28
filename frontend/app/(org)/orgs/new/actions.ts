"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";
import { fieldErrors } from "@/lib/billing-errors";
import type { PlanChoice } from "@/lib/billing";

export type CodeCheck = { valid: boolean; code?: string; free_days?: number; detail?: string };

export async function checkCodeAction(code: string): Promise<CodeCheck> {
  const trimmed = code.trim();
  if (!trimmed) return { valid: false };
  try {
    return await apiFetch<CodeCheck>(`/billing/codes/${encodeURIComponent(trimmed)}/`);
  } catch {
    // Not a verdict on the code — the submit checks it again.
    return { valid: false, detail: "Couldn't check the code right now. You can still continue." };
  }
}

export type OnboardingInput = {
  name: string;
  one_liner: string;
  sector: string;
  stage: string;
  geo: string;
  plan: PlanChoice;
  code: string;
  accept_terms: boolean;
  /** A co-founder match this organisation comes from, if any. */
  match: number | null;
};

export type OnboardingResult = {
  /** "workspace": an in-app path. "checkout": Stripe's page. */
  next: "workspace" | "checkout" | null;
  url: string | null;
  errors: Record<string, string>;
};

/**
 * The whole page in one request (`POST /api/org-onboarding/`). The backend
 * creates the organisation and answers where to go: the workspace when a code
 * gave the free year, Stripe Checkout otherwise.
 */
export async function createOrganisationAction(input: OnboardingInput): Promise<OnboardingResult> {
  let result: { slug: string; next: "workspace" | "checkout"; url: string };
  try {
    result = await apiFetch(`/org-onboarding/`, { method: "POST", body: input });
  } catch (err) {
    const errors = fieldErrors(err);
    if (Object.keys(errors).length === 0) errors.detail = "Could not create the organisation. Please try again.";
    return { next: null, url: null, errors };
  }
  // The new organisation has to reach the shell's org lists (sidebar, switcher)
  // and, when it came from a match, that match's card.
  revalidatePath("/feed");
  revalidatePath("/dashboard");
  revalidatePath("/profile");
  if (input.match !== null) revalidatePath("/cofounder");
  return { next: result.next, url: result.url, errors: {} };
}
