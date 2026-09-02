"use server";

import { revalidatePath } from "next/cache";

import { apiFetch, ApiError, ApiNetworkError, ApiTimeoutError } from "@/lib/api";

type ChecklistItem = { key: string; done: boolean; hint: string };
type WizardProgress = { completeness: number; checklist: ChecklistItem[] };
export type WizardResult = Partial<WizardProgress> & { error: string | null };

async function fetchOnboardingProgress(slug: string): Promise<WizardProgress> {
  const data = await apiFetch<{ completeness: number; checklist: ChecklistItem[] }>(
    `/orgs/${slug}/onboarding/`
  );
  return { completeness: data.completeness, checklist: data.checklist };
}

// The onboarding refresh is a nice-to-have read that runs after a mutation
// that already succeeded — a timeout or transient failure here must never
// become an uncaught exception (Next.js renders that as an unhandled 500 for
// the whole Server Action, even though the org/field/logo was saved fine).
async function safeOnboardingProgress(slug: string): Promise<Partial<WizardProgress>> {
  try {
    return await fetchOnboardingProgress(slug);
  } catch {
    return {};
  }
}

// Unlike firstErrorMessage (used by actions wired to a page-level error
// boundary), wizard actions must always resolve to a WizardResult and never
// throw — the stepper has no error boundary of its own to catch a rethrow.
function wizardErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const body = err.body as Record<string, string[] | string> | null;
    const detail = body?.detail;
    const first = Array.isArray(detail) ? detail[0] : (detail ?? (body && Object.values(body)[0]));
    const value = Array.isArray(first) ? first[0] : first;
    if (typeof value === "string") return value;
  }
  return fallback;
}

export async function createOrgWizardAction(
  name: string,
  oneLiner: string
): Promise<{ slug: string } & WizardResult> {
  let org: { slug: string };
  try {
    org = await apiFetch<{ slug: string }>("/orgs/", {
      method: "POST",
      body: { name, one_liner: oneLiner },
    });
  } catch (err) {
    return { slug: "", error: wizardErrorMessage(err, "Could not create the organization.") };
  }
  revalidatePath("/dashboard");
  revalidatePath("/feed");
  const progress = await safeOnboardingProgress(org.slug);
  return { slug: org.slug, error: null, ...progress };
}

export async function saveOrgLogoWizardAction(slug: string, logo: File): Promise<WizardResult> {
  try {
    const body = new FormData();
    body.set("logo", logo);
    await apiFetch(`/orgs/${slug}/logo/`, { method: "PUT", body });
  } catch (err) {
    return { error: wizardErrorMessage(err, "Could not upload the logo.") };
  }
  revalidatePath(`/dashboard/${slug}`);
  revalidatePath("/feed");
  const progress = await safeOnboardingProgress(slug);
  return { error: null, ...progress };
}

export async function saveOrgTextFieldWizardAction(
  slug: string,
  kind: string,
  key: string,
  value: string
): Promise<WizardResult> {
  try {
    await apiFetch(`/orgs/${slug}/sections/${kind}/fields/${key}/`, {
      method: "PUT",
      body: { value },
    });
  } catch (err) {
    return { error: wizardErrorMessage(err, "Could not save.") };
  }
  revalidatePath(`/dashboard/${slug}`);
  const progress = await safeOnboardingProgress(slug);
  return { error: null, ...progress };
}

export async function addOrgTeamMemberWizardAction(
  slug: string,
  member: { name: string; role: string; linkedin: string }
): Promise<WizardResult> {
  try {
    const key = `member_${Date.now()}`;
    await apiFetch(`/orgs/${slug}/sections/team/fields/${key}/`, {
      method: "PUT",
      body: { value: { ...member, joined_at: new Date().toISOString() } },
    });
  } catch (err) {
    return { error: wizardErrorMessage(err, "Could not add the team member.") };
  }
  revalidatePath(`/dashboard/${slug}`);
  const progress = await safeOnboardingProgress(slug);
  return { error: null, ...progress };
}

export async function updateOrgProfileAction(_prevState: string | null, formData: FormData) {
  const slug = String(formData.get("slug"));
  const body: Record<string, string> = {};
  for (const field of ["name", "one_liner", "stage", "sector", "geo"]) {
    const value = formData.get(field);
    if (value !== null) body[field] = String(value);
  }
  try {
    await apiFetch(`/orgs/${slug}/`, { method: "PATCH", body });
  } catch (err) {
    return firstErrorMessage(err, "Could not save changes.");
  }
  revalidatePath(`/dashboard/${slug}`);
  return "saved";
}

export async function activateOrgAction(_prevState: string | null, formData: FormData) {
  const slug = String(formData.get("slug"));
  try {
    await apiFetch(`/orgs/${slug}/activate/`, { method: "POST" });
  } catch (err) {
    return firstErrorMessage(err, "Could not publish the organization.");
  }
  revalidatePath(`/dashboard/${slug}`);
  return null;
}

export async function updateProfileAction(_prevState: string | null, formData: FormData) {
  const body = new FormData();
  const nameLocked = formData.get("name_locked") === "1";
  if (!nameLocked) {
    const fullName = formData.get("full_name");
    if (fullName !== null && String(fullName).trim()) {
      body.set("full_name", String(fullName).trim());
    }
  }
  body.set("headline", formData.get("headline") ?? "");
  body.set("bio", formData.get("bio") ?? "");
  body.set("manifesto", formData.get("manifesto") ?? "");
  body.set("country", formData.get("country") ?? "");

  const visibility: Record<string, string> = {};
  for (const key of ["bio", "country", "skills", "posts", "attestations", "credentials"]) {
    const value = formData.get(`visibility_${key}`);
    if (value) visibility[key] = String(value);
  }
  body.set("visibility", JSON.stringify(visibility));

  const attestationPrefs: Record<string, boolean> = {
    show_memberships: formData.get("show_memberships") === "on",
    show_posts_count: formData.get("show_posts_count") === "on",
  };
  body.set("attestation_prefs", JSON.stringify(attestationPrefs));

  const parseList = (name: string) =>
    formData
      .getAll(name)
      .map((value) => String(value).trim())
      .filter(Boolean);

  const stageFocus = parseList("stage_focus");
  const sectorFocus = parseList("sector_focus");
  const geoFocus = parseList("geo_focus");
  if (stageFocus.length) body.set("stage_focus", JSON.stringify(stageFocus));
  if (sectorFocus.length) body.set("sector_focus", JSON.stringify(sectorFocus));
  if (geoFocus.length) body.set("geo_focus", JSON.stringify(geoFocus));

  const linkLabels = formData.getAll("link_label").map((value) => String(value).trim());
  const linkUrls = formData.getAll("link_url").map((value) => String(value).trim());
  const links = linkLabels
    .map((label, index) => ({ label, url: linkUrls[index] ?? "" }))
    .filter((link) => link.label && link.url);
  body.set("links", JSON.stringify(links));

  const skills = parseList("skills");
  body.set("skills", JSON.stringify(skills));

  const checkMin = formData.get("check_min");
  const checkMax = formData.get("check_max");
  if (checkMin) body.set("check_min", String(checkMin));
  if (checkMax) body.set("check_max", String(checkMax));

  const picture = formData.get("profile_picture");
  if (picture instanceof File && picture.size > 0) {
    body.set("profile_picture", picture);
  }

  try {
    await apiFetch("/investors/me/", { method: "PUT", body });
  } catch (err) {
    return profileErrorMessage(err, "Could not save your profile.");
  }
  revalidatePath("/dashboard");
  return null;
}

export async function followOrgAction(formData: FormData) {
  const slug = String(formData.get("slug"));
  await apiFetch(`/orgs/${slug}/follow/`, { method: "POST" });
  revalidatePath("/dashboard");
  revalidatePath("/feed");
  revalidatePath(`/org/${slug}`);
}

export async function upsertFieldAction(_prevState: string | null, formData: FormData) {
  const slug = String(formData.get("slug"));
  const kind = String(formData.get("kind"));
  const key = String(formData.get("key"));
  const valueJson = formData.get("value_json");
  const value = valueJson ? JSON.parse(String(valueJson)) : String(formData.get("value"));
  const visibility = String(formData.get("visibility") ?? "");

  try {
    await apiFetch(`/orgs/${slug}/sections/${kind}/fields/${key}/`, {
      method: "PUT",
      body: { value, ...(visibility ? { visibility } : {}) },
    });
  } catch (err) {
    return firstErrorMessage(err, "Could not save.");
  }
  revalidatePath(`/dashboard/${slug}`);
  return null;
}

export async function deleteActivityAction(_prevState: string | null, formData: FormData) {
  const slug = String(formData.get("slug"));
  const activityId = String(formData.get("activity_id"));

  try {
    await apiFetch(`/orgs/${slug}/feed/${activityId}/`, { method: "DELETE" });
  } catch (err) {
    return firstErrorMessage(err, "Could not delete this post.");
  }
  revalidatePath(`/dashboard/${slug}`);
  revalidatePath("/feed");
  return null;
}

export async function deleteFieldAction(_prevState: string | null, formData: FormData) {
  const slug = String(formData.get("slug"));
  const kind = String(formData.get("kind"));
  const key = String(formData.get("key"));

  try {
    await apiFetch(`/orgs/${slug}/sections/${kind}/fields/${key}/`, { method: "DELETE" });
  } catch (err) {
    return firstErrorMessage(err, "Could not remove.");
  }
  revalidatePath(`/dashboard/${slug}`);
  return null;
}

export async function openRoundAction(formData: FormData) {
  const slug = String(formData.get("slug"));
  await apiFetch(`/orgs/${slug}/rounds/`, {
    method: "POST",
    body: {
      stage: formData.get("stage"),
      valuation: Number(formData.get("valuation") || 0) || null,
      ask_amount: Number(formData.get("ask_amount") || 0) || null,
      use_of_funds: formData.get("use_of_funds") ?? "",
    },
  });
  revalidatePath(`/dashboard/${slug}`);
}

export async function closeRoundAction(formData: FormData) {
  const slug = String(formData.get("slug"));
  await apiFetch(`/orgs/${slug}/rounds/close/`, {
    method: "POST",
    body: {
      raised_amount: Number(formData.get("raised_amount") || 0) || null,
    },
  });
  revalidatePath(`/dashboard/${slug}`);
}

export async function submitVerificationAction(_prevState: string | null, formData: FormData) {
  const slug = String(formData.get("slug"));
  const body = new FormData();
  for (const [key, value] of formData.entries()) {
    if (key === "slug") continue;
    if (value instanceof File && value.size === 0) continue;
    body.set(key, value);
  }

  try {
    await apiFetch(`/orgs/${slug}/verifications/`, { method: "POST", body });
  } catch (err) {
    return firstErrorMessage(err, "Could not submit for verification.");
  }
  revalidatePath(`/dashboard/${slug}`);
  return null;
}

export async function submitCredentialAction(_prevState: string | null, formData: FormData) {
  try {
    await apiFetch("/credentials/", { method: "POST", body: formData });
  } catch (err) {
    return firstErrorMessage(err, "Could not submit credential.");
  }
  revalidatePath("/dashboard");
  return null;
}

export async function connectStripeTractionAction(_prevState: string | null, formData: FormData) {
  const slug = String(formData.get("slug"));
  try {
    await apiFetch(`/orgs/${slug}/traction/connect/`, { method: "POST" });
  } catch (err) {
    return firstErrorMessage(err, "Could not connect Stripe.");
  }
  revalidatePath(`/dashboard/${slug}`);
  return null;
}

function firstErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) throw err;
  const body = err.body as Record<string, string[] | string> | null;
  const detail = body?.detail;
  const first = Array.isArray(detail) ? detail[0] : detail ?? (body && Object.values(body)[0]);
  const value = Array.isArray(first) ? first[0] : first;
  return typeof value === "string" ? value : fallback;
}

function profileErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiTimeoutError) {
    return "The upload timed out — try a smaller photo or try again.";
  }
  if (err instanceof ApiNetworkError) {
    return err.message;
  }
  if (err instanceof ApiError) {
    return firstErrorMessage(err, fallback);
  }
  return fallback;
}

export async function postFeedAction(_prevState: string | null, formData: FormData) {
  const slug = String(formData.get("slug"));
  const rawKind = String(formData.get("kind"));
  const kindMap: Record<string, string> = {
    news: "update",
    milestones: "milestone",
    events: "event",
    update: "update",
    milestone: "milestone",
    event: "event",
  };
  const kind = kindMap[rawKind] ?? rawKind;
  const body = new FormData();
  body.set("kind", kind);
  body.set("title", String(formData.get("title") ?? ""));
  body.set("body", String(formData.get("body") ?? ""));

  if (kind === "event") {
    const startsAt = formData.get("starts_at");
    const endsAt = formData.get("ends_at");
    body.set("starts_at", new Date(String(startsAt)).toISOString());
    body.set("ends_at", new Date(String(endsAt)).toISOString());
    body.set("format", String(formData.get("format") ?? "online"));
    const location = formData.get("location");
    if (location) body.set("location", String(location));
    const registrationUrl = formData.get("registration_url");
    if (registrationUrl) body.set("registration_url", String(registrationUrl));
  } else if (kind === "milestone") {
    body.set("category", String(formData.get("category") ?? "other"));
    const occurredAt = formData.get("occurred_at");
    if (occurredAt) body.set("occurred_at", String(occurredAt));
  }

  if (kind === "event" || kind === "update") {
    const image = formData.get("image");
    if (image instanceof File && image.size > 0) {
      body.set("image", image);
    }
  }

  try {
    await apiFetch(`/orgs/${slug}/posts/`, { method: "POST", body });
  } catch (err) {
    return firstErrorMessage(err, "Could not publish the update.");
  }
  revalidatePath(`/dashboard/${slug}`);
  revalidatePath("/feed");
  revalidatePath("/discovery");
  return null;
}

export async function uploadOrgLogoAction(_prevState: string | null, formData: FormData) {
  const slug = String(formData.get("slug"));
  const logo = formData.get("logo");
  if (!(logo instanceof File) || logo.size === 0) return null;

  const body = new FormData();
  body.set("logo", logo);
  try {
    await apiFetch(`/orgs/${slug}/logo/`, { method: "PUT", body });
  } catch (err) {
    return firstErrorMessage(err, "Could not upload the logo.");
  }
  revalidatePath(`/dashboard/${slug}`);
  revalidatePath("/feed");
  revalidatePath("/discovery");
  return "saved";
}

export async function createInviteAction(formData: FormData) {
  const slug = String(formData.get("slug"));
  await apiFetch(`/orgs/${slug}/invites/`, {
    method: "POST",
    body: { role: formData.get("role") },
  });
  revalidatePath(`/dashboard/${slug}`);
}

export async function revokeInviteAction(formData: FormData) {
  const slug = String(formData.get("slug"));
  const inviteId = String(formData.get("invite_id"));
  await apiFetch(`/orgs/${slug}/invites/${inviteId}/`, { method: "DELETE" });
  revalidatePath(`/dashboard/${slug}`);
}

export async function updateMemberTitleAction(formData: FormData) {
  const slug = String(formData.get("slug"));
  const memberId = String(formData.get("member_id"));
  const title = String(formData.get("title") ?? "").trim();
  await apiFetch(`/orgs/${slug}/members/${memberId}/`, {
    method: "PATCH",
    body: { title },
  });
  revalidatePath(`/dashboard/${slug}`);
}

export async function updateMemberRoleAction(formData: FormData) {
  const slug = String(formData.get("slug"));
  const memberId = String(formData.get("member_id"));
  await apiFetch(`/orgs/${slug}/members/${memberId}/`, {
    method: "PATCH",
    body: { role: formData.get("role") },
  });
  revalidatePath(`/dashboard/${slug}`);
}

export async function removeMemberAction(_prevState: string | null, formData: FormData) {
  const slug = String(formData.get("slug"));
  const memberId = String(formData.get("member_id"));
  try {
    await apiFetch(`/orgs/${slug}/members/${memberId}/`, { method: "DELETE" });
  } catch (err) {
    return firstErrorMessage(err, "Could not remove this member.");
  }
  revalidatePath(`/dashboard/${slug}`);
  return null;
}

export async function createInvestorPostAction(_prevState: string | null, formData: FormData) {
  const kind = String(formData.get("kind"));
  const body = new FormData();
  body.set("kind", kind);
  body.set("title", String(formData.get("title")));
  body.set("body", String(formData.get("body") ?? ""));
  body.set("occurred_at", new Date().toISOString());
  if (kind === "update") {
    const image = formData.get("image");
    if (image instanceof File && image.size > 0) {
      body.set("image", image);
    }
  }

  try {
    await apiFetch("/investors/me/posts/", { method: "POST", body });
  } catch (err) {
    return firstErrorMessage(err, "Could not publish your post.");
  }
  revalidatePath("/dashboard");
  revalidatePath("/feed");
  return null;
}

export async function createGrantAction(formData: FormData) {
  const slug = String(formData.get("slug"));
  const section = formData.get("section");
  const field = formData.get("field");
  await apiFetch(`/orgs/${slug}/grants/`, {
    method: "POST",
    body: {
      section: section || null,
      field: field || null,
      principal_type: formData.get("principal_type"),
      principal_id: formData.get("principal_id"),
    },
  });
  revalidatePath(`/dashboard/${slug}`);
  revalidatePath(`/dashboard/${slug}/access`);
}

export async function deleteGrantAction(_prevState: string | null, formData: FormData) {
  const slug = String(formData.get("slug"));
  const grantId = String(formData.get("grant_id"));
  try {
    await apiFetch(`/orgs/${slug}/grants/${grantId}/`, { method: "DELETE" });
  } catch (err) {
    return firstErrorMessage(err, "Could not revoke this grant.");
  }
  revalidatePath(`/dashboard/${slug}`);
  revalidatePath(`/dashboard/${slug}/access`);
  return null;
}
