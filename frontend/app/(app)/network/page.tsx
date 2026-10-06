import { redirect } from "next/navigation";

import { PageHeading } from "@/components/app-shell/ui";
import { ConnectionRequestsPanel } from "@/components/network/ConnectionRequestsPanel";
import { ConnectionsPanel } from "@/components/network/ConnectionsPanel";
import { NetworkPrinciples } from "@/components/network/NetworkPrinciples";
import { ApiError, apiFetch, safeFetch } from "@/lib/api";

import type { ConnectionRequestItem, SentConnectionRequestItem } from "../connections/actions";
import type { ConnectionItem, FollowItem } from "./actions";

export const dynamic = "force-dynamic";

/** Mirrors ProfileForm's visibility selector, which is where this links to. */
const VISIBILITY_LABELS: Record<string, string> = {
  public: "Public",
  verified_investors: "Verified only",
  connections: "Connections",
  private: "Private",
};

type Me = { investor_profile: { visibility?: Record<string, string> } | null };

/**
 * Visibility is per-section in Beedero, but the design shows a single value.
 * One label only when every section agrees; otherwise "Mixed", which is the
 * honest answer and still points at the settings that explain it.
 */
function visibilityLabel(visibility: Record<string, string> | undefined): string {
  const levels = new Set(Object.values(visibility ?? {}));
  if (levels.size === 0) return "Public"; // nothing overridden — model defaults
  if (levels.size > 1) return "Mixed";
  const [only] = [...levels];
  return VISIBILITY_LABELS[only] ?? only;
}

export default async function NetworkPage() {
  let requests: ConnectionRequestItem[];
  let sent: SentConnectionRequestItem[];
  let connections: ConnectionItem[];
  let following: FollowItem[];
  let me: Me | null;
  try {
    [{ items: requests }, { items: sent }, { items: connections }, { items: following }, me] =
      await Promise.all([
        safeFetch(apiFetch<{ items: ConnectionRequestItem[] }>("/connections/requests/pending/"), {
          items: [] as ConnectionRequestItem[],
        }),
        safeFetch(apiFetch<{ items: SentConnectionRequestItem[] }>("/connections/requests/sent/"), {
          items: [] as SentConnectionRequestItem[],
        }),
        apiFetch<{ items: ConnectionItem[] }>("/network/connections/"),
        safeFetch(apiFetch<{ items: FollowItem[] }>("/network/following/"), {
          items: [] as FollowItem[],
        }),
        safeFetch(apiFetch<Me>("/auth/me/"), null),
      ]);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect("/login");
    throw err;
  }

  return (
    <>
      <PageHeading eyebrow="Relationships" title="Your network." />

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="min-w-0">
          <ConnectionRequestsPanel items={requests} />
          <ConnectionsPanel items={connections} />
        </div>
        <NetworkPrinciples
          sent={sent}
          following={following}
          visibilityLabel={visibilityLabel(me?.investor_profile?.visibility)}
        />
      </div>
    </>
  );
}
