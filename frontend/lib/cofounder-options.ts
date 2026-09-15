/** Mirrors cofounder.models.Strength / BuilderProfile.Commitment. The labels
 * are deliberately plain: this is a working partnership, not a personality
 * quiz. */

import { SECTOR_OPTIONS } from "@/lib/org-filters";

export const STRENGTH_OPTIONS = [
  { value: "technical", label: "Technical", description: "You build the thing" },
  { value: "business", label: "Business", description: "Sales, fundraising, operations" },
  { value: "product", label: "Product", description: "What to build, and why" },
  { value: "design", label: "Design", description: "How it looks and feels" },
  { value: "other", label: "Other", description: "Something the list above misses" },
] as const;

export const COMMITMENT_OPTIONS = [
  {
    value: "exploring",
    label: "Exploring ideas",
    description: "Talking to people, nothing full-time yet",
  },
  {
    value: "nights",
    label: "Nights & weekends",
    description: "Building alongside a job",
  },
  {
    value: "full_time",
    label: "Full-time",
    description: "All in, or ready to be",
  },
] as const;

/** The three prompts on the card (doc §1). Order matters — it's the order
 * they're written in and the order they're read in. */
export const PROMPT_FIELDS = [
  {
    key: "why_building",
    label: "Why are you building?",
    placeholder: "The reason you'd still do this if nobody was watching.",
  },
  {
    key: "superpower",
    label: "What's your superpower?",
    placeholder: "The thing you're genuinely better at than most people you know.",
  },
  {
    key: "ideal_cofounder",
    label: "Who's your ideal co-founder?",
    placeholder: "Not a job spec — the person you'd want next to you at the worst moment.",
  },
] as const;

export const PROMPT_MAX_LENGTH = 280;

export type BuilderProfile = {
  is_active: boolean;
  adult_confirmed: boolean;
  primary_strength: string;
  looking_for: string[];
  commitment: string;
  sectors: string[];
  has_idea: boolean;
  idea_pitch: string;
  prompts: Record<string, string>;
  is_complete: boolean;
  updated_at: string;
};

export type BuilderCard = {
  id: number;
  name: string;
  handle: string | null;
  headline: string;
  profile_picture: string | null;
  reputation_tier: string;
  attestations: { kind: string; label: string; detail: string; org_slug?: string }[];
  is_verified: boolean;
  country: string;
  skills: string[];
  primary_strength: string;
  primary_strength_label: string;
  looking_for: string[];
  commitment: string;
  commitment_label: string;
  sectors: string[];
  has_idea: boolean;
  idea_pitch: string;
  prompts: Record<string, string>;
};

export type CofounderMatch = {
  id: number;
  other: BuilderCard;
  outcome: string;
  outcome_label: string;
  conversation_id: number | null;
  org: { slug: string; name: string } | null;
  created_at: string;
};

export type CofounderStatus = {
  market: string;
  active_builders: number;
  threshold: number;
  gate_met: boolean;
  is_active: boolean;
  is_complete: boolean;
  show_entry_point: boolean;
};

export function strengthLabel(value: string): string {
  return STRENGTH_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

/** Sectors are the same vocabulary organizations use — a builder's sectors
 * and an org's sector have to mean the same thing for the match to lead
 * anywhere. */
export function sectorLabel(value: string): string {
  return SECTOR_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
