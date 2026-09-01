import { redirect } from "next/navigation";

import { AppShellLayout } from "@/components/AppShellLayout";
import { NetworkTabs } from "@/components/network/NetworkTabs";
import { ApiError, apiFetch, safeFetch } from "@/lib/api";

import type { ConnectionRequestItem } from "../connections/actions";
import type { ConnectionItem, FollowItem } from "./actions";

export const dynamic = "force-dynamic";

type Tab = "requests" | "connections" | "following";

export default async function NetworkPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;

  let requests: ConnectionRequestItem[];
  let connections: ConnectionItem[];
  let following: FollowItem[];
  try {
    [{ items: requests }, connections, { items: following }] = await Promise.all([
      safeFetch(apiFetch<{ items: ConnectionRequestItem[] }>("/connections/requests/pending/"), {
        items: [] as ConnectionRequestItem[],
      }),
      apiFetch<{ items: ConnectionItem[] }>("/network/connections/"),
      safeFetch(apiFetch<{ items: FollowItem[] }>("/network/following/"), {
        items: [] as FollowItem[],
      }),
    ]);
    connections = connections.items;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  const tab: Tab =
    tabParam === "connections" || tabParam === "following"
      ? tabParam
      : tabParam === "requests"
        ? "requests"
        : requests.length > 0
          ? "requests"
          : "connections";

  return (
    <AppShellLayout label="Network" showMessagesInSidebar={false}>
      <NetworkTabs
        initialTab={tab}
        requests={requests}
        connections={connections}
        following={following}
      />
    </AppShellLayout>
  );
}
