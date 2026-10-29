"use server";

import { publicPost } from "@/lib/api";

export async function unsubscribeAction(token: string): Promise<{ ok: boolean; email?: string }> {
  try {
    const result = await publicPost<{ unsubscribed: boolean; email: string }>("/newsletter/unsubscribe/", { token });
    return { ok: result.unsubscribed, email: result.email };
  } catch {
    return { ok: false };
  }
}
