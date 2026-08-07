import { redirect } from "next/navigation";

import { AppShellLayout } from "@/components/AppShellLayout";
import { ConnectionRequestsList } from "@/components/ConnectionRequestsList";
import { ApiError, apiFetch, safeFetch } from "@/lib/api";

import type { ConnectionRequestItem } from "./actions";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
  let items: ConnectionRequestItem[];
  try {
    ({ items } = await safeFetch(
      apiFetch<{ items: ConnectionRequestItem[] }>("/connections/requests/pending/"),
      { items: [] as ConnectionRequestItem[] }
    ));
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  return (
    <AppShellLayout label="Connections" showMessagesInSidebar={false}>
      <ConnectionRequestsList items={items} />
    </AppShellLayout>
  );
}
