"use server";

import { apiFetch } from "@/lib/api";
import type { OrgSummary } from "@/lib/types";

type PersonSummary = {
  id: number;
  name: string;
  headline?: string;
  handle?: string | null;
  is_verified?: boolean;
  city?: string;
  profile_picture?: string | null;
  connection_status?: "none" | "pending_sent" | "pending_received" | "connected";
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
