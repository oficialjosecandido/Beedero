"use client";

import { useState } from "react";

import { ConnectionRequestsList } from "@/components/ConnectionRequestsList";
import { ConnectionsList } from "@/components/network/ConnectionsList";
import { FollowingList } from "@/components/network/FollowingList";

import type { ConnectionRequestItem } from "@/app/(app)/connections/actions";
import type { ConnectionItem, FollowItem } from "@/app/(app)/network/actions";

type Tab = "requests" | "connections" | "following";

const TABS: { key: Tab; label: string }[] = [
  { key: "requests", label: "Requests" },
  { key: "connections", label: "Connections" },
  { key: "following", label: "Following" },
];

export function NetworkTabs({
  initialTab,
  requests,
  connections,
  following,
}: {
  initialTab: Tab;
  requests: ConnectionRequestItem[];
  connections: ConnectionItem[];
  following: FollowItem[];
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  function selectTab(key: Tab) {
    setTab(key);
    window.history.replaceState(null, "", `/network?tab=${key}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => selectTab(t.key)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${
              tab === t.key
                ? "bg-beedero-black text-beedero-white"
                : "border border-beedero-border text-beedero-black/70 hover:bg-zinc-50"
            }`}
          >
            {t.label}
            {t.key === "requests" && requests.length > 0 && ` (${requests.length})`}
          </button>
        ))}
      </nav>

      {tab === "requests" && <ConnectionRequestsList items={requests} />}
      {tab === "connections" && <ConnectionsList items={connections} />}
      {tab === "following" && <FollowingList following={following} />}
    </div>
  );
}
