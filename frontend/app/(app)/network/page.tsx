import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShellLayout } from "@/components/AppShellLayout";
import { ConnectionRequestsList } from "@/components/ConnectionRequestsList";
import { ConnectionsList } from "@/components/network/ConnectionsList";
import { FollowingList } from "@/components/network/FollowingList";
import { ApiError, apiFetch, safeFetch } from "@/lib/api";

import type { ConnectionRequestItem } from "../connections/actions";
import type { ConnectionItem, FollowItem } from "./actions";

export const dynamic = "force-dynamic";

type Tab = "requests" | "connections" | "following";

const TABS: { key: Tab; label: string }[] = [
  { key: "requests", label: "Pedidos" },
  { key: "connections", label: "Conexões" },
  { key: "following", label: "A seguir & Seguidores" },
];

export default async function NetworkPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;

  let requests: ConnectionRequestItem[];
  let connections: ConnectionItem[];
  let following: FollowItem[];
  let followers: FollowItem[];
  try {
    [{ items: requests }, { items: connections }, { items: following }, { items: followers }] =
      await Promise.all([
        safeFetch(apiFetch<{ items: ConnectionRequestItem[] }>("/connections/requests/pending/"), {
          items: [] as ConnectionRequestItem[],
        }),
        safeFetch(apiFetch<{ items: ConnectionItem[] }>("/network/connections/"), {
          items: [] as ConnectionItem[],
        }),
        safeFetch(apiFetch<{ items: FollowItem[] }>("/network/following/"), {
          items: [] as FollowItem[],
        }),
        safeFetch(apiFetch<{ items: FollowItem[] }>("/network/followers/"), {
          items: [] as FollowItem[],
        }),
      ]);
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
    <AppShellLayout label="Rede" showMessagesInSidebar={false}>
      <div className="flex flex-col gap-4">
        <nav className="flex gap-2 overflow-x-auto">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/network?tab=${t.key}`}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${
                tab === t.key
                  ? "bg-beedero-black text-beedero-white"
                  : "border border-beedero-border text-beedero-black/70 hover:bg-zinc-50"
              }`}
            >
              {t.label}
              {t.key === "requests" && requests.length > 0 && ` (${requests.length})`}
            </Link>
          ))}
        </nav>

        {tab === "requests" && <ConnectionRequestsList items={requests} />}
        {tab === "connections" && <ConnectionsList items={connections} />}
        {tab === "following" && <FollowingList following={following} followers={followers} />}
      </div>
    </AppShellLayout>
  );
}
