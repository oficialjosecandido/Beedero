"use server";

import { apiFetch } from "@/lib/api";
import type { OrgSummary } from "@/lib/types";

type PersonSummary = {
  id: number;
  name: string;
  headline?: string;
  profile_picture?: string | null;
};

type AdvisorSummary = {
  id: number;
  name: string;
  headline?: string;
  handle?: string | null;
  is_verified?: boolean;
  profile_picture?: string | null;
  expertise: string[];
  verified_gig_count: number;
};

export async function loadMoreDiscoveryAction(
  query: string,
  offset: number
): Promise<{ items: OrgSummary[]; next_offset: number | null }> {
  const params = new URLSearchParams(query);
  params.set("offset", String(offset));
  return apiFetch<{ items: OrgSummary[]; next_offset: number | null }>(
    `/discovery/?${params.toString()}`
  );
}

export async function loadMorePeopleDiscoveryAction(
  query: string,
  offset: number
): Promise<{ items: PersonSummary[]; next_offset: number | null }> {
  const params = new URLSearchParams(query);
  params.set("offset", String(offset));
  return apiFetch<{ items: PersonSummary[]; next_offset: number | null }>(
    `/discovery/people/?${params.toString()}`
  );
}

export async function loadMoreAdvisorsDiscoveryAction(
  query: string,
  offset: number
): Promise<{ items: AdvisorSummary[]; next_offset: number | null }> {
  const params = new URLSearchParams(query);
  params.set("offset", String(offset));
  return apiFetch<{ items: AdvisorSummary[]; next_offset: number | null }>(
    `/discovery/advisors/?${params.toString()}`
  );
}
