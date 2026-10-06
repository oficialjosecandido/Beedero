/**
 * Per-section profile visibility. Shared because the settings form writes
 * these values and the profile sidebar summarises them.
 */
export const VISIBILITY_SECTIONS = [
  { key: "bio", label: "Bio", hint: "Your about text, manifesto, and links" },
  { key: "country", label: "Location", hint: "The country and city you're based in" },
  { key: "skills", label: "Skills", hint: "Your skills cloud" },
  { key: "posts", label: "Activity posts", hint: "Updates and milestones" },
  { key: "attestations", label: "Platform facts", hint: "Memberships and stats" },
  { key: "credentials", label: "Credentials", hint: "Your verified professional credentials" },
] as const;

export const VISIBILITY_OPTIONS = [
  { value: "public", label: "Public" },
  { value: "verified_investors", label: "Verified only" },
  { value: "connections", label: "Connections" },
  { value: "private", label: "Private" },
] as const;

/** The model default is `public`, so an unset section reads as public. */
export function visibilityLabel(value: string | undefined): string {
  if (!value) return "Public";
  return VISIBILITY_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
