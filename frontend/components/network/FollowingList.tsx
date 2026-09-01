"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { unfollowOrgAction, type FollowItem } from "@/app/(app)/network/actions";
import { EmptyState } from "@/components/EmptyState";
import { formatRelativeTime } from "@/lib/format";

function FollowRow({ item, onRemoved }: { item: FollowItem; onRemoved: (id: string) => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const name = item.target.name ?? "";

  function unfollow() {
    startTransition(async () => {
      const result = await unfollowOrgAction(item.id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onRemoved(item.id);
    });
  }

  return (
    <li className="flex items-center gap-3 rounded-2xl border-2 border-beedero-border bg-beedero-white p-4 shadow-sm">
      {item.target.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img loading="lazy" src={item.target.logo} alt="" className="size-11 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-beedero-yellow/30 text-lg font-extrabold text-beedero-black">
          {name.charAt(0)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <Link href={`/org/${item.target.slug}`} className="font-bold text-beedero-black hover:underline">
          {name}
        </Link>
        <p className="mt-1 text-xs text-subtle">Since {formatRelativeTime(item.created_at)}</p>
      </div>
      <button
        type="button"
        onClick={unfollow}
        disabled={isPending}
        className="shrink-0 rounded-full border border-beedero-border px-3 py-1.5 text-xs font-semibold text-zinc-500 hover:bg-zinc-50 disabled:opacity-50"
      >
        {isPending ? "…" : "Unfollow"}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </li>
  );
}

export function FollowingList({ following }: { following: FollowItem[] }) {
  const [removedIds, setRemovedIds] = useState<string[]>([]);

  const visibleFollowing = useMemo(
    () => following.filter((item) => !removedIds.includes(item.id)),
    [following, removedIds]
  );

  function remove(id: string) {
    setRemovedIds((current) => [...current, id]);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
        Following an organization fills your feed with its updates. To connect with a person,
        send a connection request from their profile.
      </p>

      <div className="overflow-hidden rounded-3xl border-2 border-beedero-border bg-beedero-white shadow-sm">
        <div className="border-b border-beedero-border px-5 py-4">
          <h2 className="text-lg font-extrabold text-beedero-black">Following</h2>
        </div>
        {visibleFollowing.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="You're not following any organizations yet"
              description="Follow organizations to fill your feed with their updates."
              action={{ href: "/discovery", label: "Discover organizations" }}
            />
          </div>
        ) : (
          <ul className="flex flex-col gap-4 p-5">
            {visibleFollowing.map((item) => (
              <FollowRow key={item.id} item={item} onRemoved={remove} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
