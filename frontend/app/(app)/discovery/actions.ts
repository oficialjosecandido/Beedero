"use server";

import { apiFetch } from "@/lib/api";
import type { OrgSummary } from "@/lib/types";

export async function loadMoreDiscoveryAction(
  query: string,
  offset: number
): Promise<{ items: OrgSummary[]; next_offset: number | null }> {
  const params = new URLSearchParams(query);
  params.set("offset", String(offset));
  return apiFetch(`/discovery/?${params.toString()}`);
}
