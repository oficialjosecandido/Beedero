import "server-only";

import { notFound } from "next/navigation";

import { ApiError, apiFetch } from "./api";

/** A Nexus read for a page: anything the person may not see (403 for staff
 *  on admin pages, 404 for a missing record) renders the not-found page. */
export async function nexusFetch<T>(path: string): Promise<T> {
  try {
    return await apiFetch<T>(path);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) notFound();
    throw err;
  }
}
