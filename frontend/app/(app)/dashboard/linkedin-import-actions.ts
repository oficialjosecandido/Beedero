"use server";

import { revalidatePath } from "next/cache";

import { apiFetch, ApiError } from "@/lib/api";
import type {
  LinkedInImportApplyPayload,
  LinkedInImportApplyResult,
  LinkedInImportPreview,
} from "@/lib/linkedin-import";

function actionErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    const body = err.body as Record<string, unknown> | null;
    const detail = body?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && typeof detail[0] === "string") return detail[0];
  }
  return fallback;
}

/** Parses the person's LinkedIn export on the backend and returns it for
 * review. Nothing is saved and the file isn't kept. */
export async function previewLinkedInImportAction(
  formData: FormData
): Promise<{ preview: LinkedInImportPreview } | { error: string }> {
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { error: "Choose the ZIP file LinkedIn sent you." };

  const body = new FormData();
  for (const file of files) body.append("files", file, file.name);
  try {
    const preview = await apiFetch<LinkedInImportPreview>("/profile/import/linkedin/preview/", {
      method: "POST",
      body,
    });
    return { preview };
  } catch (err) {
    return { error: actionErrorMessage(err, "We couldn't read that file. Please try again.") };
  }
}

/** Saves exactly what the person ticked on the review screen. */
export async function applyLinkedInImportAction(
  payload: LinkedInImportApplyPayload
): Promise<{ result: LinkedInImportApplyResult } | { error: string }> {
  try {
    const result = await apiFetch<LinkedInImportApplyResult>("/profile/import/linkedin/apply/", {
      method: "POST",
      body: payload,
    });
    revalidatePath("/dashboard");
    return { result };
  } catch (err) {
    return { error: actionErrorMessage(err, "Some of this couldn't be imported. Please try again.") };
  }
}
