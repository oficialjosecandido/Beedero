"use server";

import { apiFetch } from "@/lib/api";
import type { OrgSummary } from "@/lib/types";

type PersonSummary = {
  id: number;
  name: string;
  headline?: string;
  profile_picture?: string | null;
};

export async function loadMoreDiscoveryAction(
  query: string,
  offset: number
): Promise<{ items: OrgSummary[]; next_offset: number | null }> {
  const params = new URLSearchParams(query);
  params.set("offset", String(offset));
  return apiFetch(`/discovery/?${params.toString()}`);
}

export async function loadMorePeopleDiscoveryAction(
  query: string,
  offset: number
): Promise<{ items: PersonSummary[]; next_offset: number | null }> {
  const params = new URLSearchParams(query);
  params.set("offset", String(offset));
  return apiFetch(`/discovery/people/?${params.toString()}`);
}
