import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { NexusShell } from "@/components/nexus/NexusShell";
import { ApiError, apiFetch } from "@/lib/api";
import type { NexusMe } from "@/lib/nexus";
import { noIndexMetadata } from "@/lib/site-metadata";

export const metadata = { ...noIndexMetadata, title: "Nexus — Beedero" };

/**
 * Beedero Nexus: the dashboard for Beedero's own staff and admins. The API
 * answers 404 to everyone else, and so does this page: nothing to see.
 */
export default async function NexusLayout({ children }: { children: ReactNode }) {
  let me: NexusMe;
  try {
    me = await apiFetch<NexusMe>("/nexus/me/");
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    notFound();
  }
  return <NexusShell me={me}>{children}</NexusShell>;
}
