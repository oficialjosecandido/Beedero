"use server";

import { revalidatePath } from "next/cache";

import { apiFetch } from "@/lib/api";
import { fieldErrors } from "@/lib/billing-errors";

export type NexusResult<T = unknown> = { ok: boolean; data: T | null; error: string | null; errors: Record<string, string> };

/**
 * Every Nexus change goes through here: a path under /nexus/, a method and a
 * body. The API decides who may do what (admins vs staff) and records it in
 * the audit log; this only forwards, and refreshes the Nexus pages after.
 */
export async function nexusCall<T = unknown>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: Record<string, unknown>
): Promise<NexusResult<T>> {
  if (!path.startsWith("/nexus/") || path.includes("..")) {
    return { ok: false, data: null, error: "Unknown action.", errors: {} };
  }
  try {
    const data = await apiFetch<T>(path, { method, body });
    revalidatePath("/beedero-nexus", "layout");
    return { ok: true, data, error: null, errors: {} };
  } catch (err) {
    const errors = fieldErrors(err);
    return {
      ok: false,
      data: null,
      error: errors.detail ?? Object.values(errors)[0] ?? "That didn't work. Try again.",
      errors,
    };
  }
}
