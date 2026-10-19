"use server";

import { revalidatePath } from "next/cache";

import { apiFetch, ApiError } from "@/lib/api";

/**
 * One action per profile section. Each sends only its own fields to
 * PUT /investors/me/ (partial=True), so saving "About" can never blank the
 * headline — the failure mode the old all-in-one form had to guard against.
 * Visibility and attestation prefs are merged server-side
 * (InvestorProfileSerializer.update), so one-key updates are safe too.
 */

export type SectionResult = { ok: true } | { error: string; fields: Record<string, string> };

export type ProfileLink = { label: string; url: string };

export type VisibilityKey =
  | "bio"
  | "country"
  | "memberships"
  | "skills"
  | "posts"
  | "attestations"
  | "credentials";

export type VisibilityLevel = "public" | "connections" | "verified_investors" | "private";

const LEVELS: VisibilityLevel[] = ["public", "connections", "verified_investors", "private"];

function failure(err: unknown, fallback: string): SectionResult {
  const fields: Record<string, string> = {};
  if (err instanceof ApiError && err.body && typeof err.body === "object") {
    for (const [key, value] of Object.entries(err.body as Record<string, unknown>)) {
      const first = Array.isArray(value) ? value[0] : value;
      if (typeof first === "string") fields[key] = first;
    }
  }
  // Invoked directly from client components, so never rethrow: a thrown
  // error here would surface as an unhandled rejection, not a message.
  return { error: fields.detail ?? Object.values(fields)[0] ?? fallback, fields };
}

async function putProfile(fields: Record<string, unknown>, fallback: string): Promise<SectionResult> {
  try {
    await apiFetch("/investors/me/", { method: "PUT", body: fields });
  } catch (err) {
    return failure(err, fallback);
  }
  revalidatePath("/profile");
  return { ok: true };
}

const text = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

export async function saveIdentityAction(input: {
  full_name?: string;
  headline: string;
  city: string;
  country: string;
}): Promise<SectionResult> {
  const fields: Record<string, unknown> = {
    headline: text(input.headline, 200),
    city: text(input.city, 80),
    country: text(input.country, 2).toUpperCase(),
  };
  // Only ever sent while the name is still empty — the backend refuses to
  // change a name once set.
  if (input.full_name?.trim()) fields.full_name = text(input.full_name, 200);
  return putProfile(fields, "Could not save your details.");
}

export async function saveAboutAction(input: {
  bio: string;
  manifesto: string;
  links: ProfileLink[];
}): Promise<SectionResult> {
  return putProfile(
    {
      bio: text(input.bio, 2600),
      manifesto: text(input.manifesto, 600),
      links: input.links
        .map((link) => ({ label: text(link.label, 60), url: text(link.url, 500) }))
        .filter((link) => link.label && link.url),
    },
    "Could not save this section."
  );
}

export async function saveSkillsAction(input: { skills: string[] }): Promise<SectionResult> {
  return putProfile(
    { skills: input.skills.map((skill) => text(skill, 40)).filter(Boolean) },
    "Could not save your skills."
  );
}

export async function saveShowOnProfileAction(input: {
  show_memberships: boolean;
  show_posts_count: boolean;
}): Promise<SectionResult> {
  return putProfile({ attestation_prefs: input }, "Could not save this setting.");
}

export async function setSectionVisibilityAction(
  section: VisibilityKey,
  level: VisibilityLevel
): Promise<SectionResult> {
  if (!LEVELS.includes(level)) return { error: "Unknown audience.", fields: {} };
  return putProfile({ visibility: { [section]: level } }, "Could not change who sees this.");
}

export async function saveIntentsAction(intents: string[]): Promise<SectionResult> {
  try {
    await apiFetch("/onboarding/", { method: "POST", body: { step: "intents", intents } });
  } catch (err) {
    return failure(err, "Could not save what you're here for.");
  }
  revalidatePath("/profile");
  return { ok: true };
}

export async function saveInvestmentFocusAction(input: {
  stage_focus: string[];
  sector_focus: string[];
  geo_focus: string[];
  check_min: number | null;
  check_max: number | null;
}): Promise<SectionResult> {
  if (input.check_min !== null && input.check_max !== null && input.check_min > input.check_max) {
    return { error: "The minimum ticket is larger than the maximum.", fields: {} };
  }
  return putProfile(input, "Could not save your investment focus.");
}

export async function saveAdvisoryAction(input: {
  is_available: boolean;
  engagement_types: string[];
  expertise: string[];
  stages: string[];
  sectors: string[];
}): Promise<SectionResult> {
  try {
    await apiFetch("/advisory/me/", { method: "PUT", body: input });
  } catch (err) {
    return failure(err, "Could not save your availability.");
  }
  revalidatePath("/profile");
  return { ok: true };
}
